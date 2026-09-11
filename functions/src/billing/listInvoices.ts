import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getStripe } from "./stripeClient";
import { STRIPE_SECRETS } from "./stripeConfig";

const BILLING_ROLES = ["super_admin", "hr_admin"];

/** Shape returned to the client — a deliberately small slice of the Stripe invoice. */
export interface InvoiceSummary {
  id: string;
  number: string | null;
  status: string | null;
  /** Seconds since epoch, as Stripe reports it. */
  created: number;
  /** Amount actually owed for the period, in the smallest currency unit. */
  amountDue: number;
  amountPaid: number;
  currency: string;
  description: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: number | null;
  periodEnd: number | null;
}

const MAX_LIMIT = 24;
const DEFAULT_LIMIT = 12;

/**
 * Lists the company's Stripe invoices for the Billing page.
 *
 * The invoice history panel used to be a hard-coded "No invoices yet", so a
 * paying customer saw nothing and had to open the Stripe portal to find out
 * what they had been charged. Stripe stays the source of truth — nothing is
 * mirrored into Firestore — and only the fields the table renders are
 * returned, so a stale copy can never disagree with the real ledger.
 *
 * Drafts are filtered out: an invoice Stripe has not finalised has no number,
 * no PDF, and may never be charged.
 */
export const listInvoices = functions
  .runWith({ secrets: [...STRIPE_SECRETS] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const db = admin.firestore();
    const userData = (await db.collection("users").doc(context.auth.uid).get()).data();

    if (!userData?.companyId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No company associated with this user."
      );
    }

    if (!BILLING_ROLES.includes(userData.role as string)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only team admins can view billing history."
      );
    }

    const companyData = (
      await db.collection("companies").doc(userData.companyId as string).get()
    ).data();

    const customerId = companyData?.stripeCustomerId as string | undefined;
    // Not an error: a company on the free trial has no Stripe customer yet,
    // and the page renders that as an empty history rather than a failure.
    if (!customerId) {
      return { invoices: [] as InvoiceSummary[], hasMore: false };
    }

    const { limit, startingAfter } = (data ?? {}) as {
      limit?: unknown;
      startingAfter?: unknown;
    };

    const pageSize =
      typeof limit === "number" && Number.isFinite(limit)
        ? Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT)
        : DEFAULT_LIMIT;

    try {
      const stripe = getStripe();
      const result = await stripe.invoices.list({
        customer: customerId,
        limit: pageSize,
        ...(typeof startingAfter === "string" && startingAfter
          ? { starting_after: startingAfter }
          : {}),
      });

      const invoices: InvoiceSummary[] = result.data
        .filter((invoice) => invoice.status !== "draft")
        .map((invoice) => ({
          id: invoice.id ?? "",
          number: invoice.number ?? null,
          status: invoice.status ?? null,
          created: invoice.created,
          amountDue: invoice.amount_due ?? 0,
          amountPaid: invoice.amount_paid ?? 0,
          currency: invoice.currency ?? "usd",
          description:
            invoice.description ??
            invoice.lines?.data?.[0]?.description ??
            null,
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          invoicePdf: invoice.invoice_pdf ?? null,
          periodStart: invoice.period_start ?? null,
          periodEnd: invoice.period_end ?? null,
        }));

      return { invoices, hasMore: result.has_more };
    } catch (err) {
      functions.logger.error("Could not list Stripe invoices.", err);
      throw new functions.https.HttpsError(
        "internal",
        "Could not load your invoice history. Please try again."
      );
    }
  });
