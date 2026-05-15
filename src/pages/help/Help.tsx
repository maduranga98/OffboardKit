import { useState } from "react";
import {
  BookOpen,
  PlayCircle,
  Users,
  ShieldCheck,
  Package,
  GitBranch,
  TrendingUp,
  Webhook,
  Bell,
  CreditCard,
  FileText,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    title: "Getting started",
    icon: PlayCircle,
    body: (
      <>
        <p>
          HRExitFlow walks a departing employee through every step of leaving
          your company — tasks, knowledge transfer, exit interview, asset
          return, and access revocation — and gives HR a real-time view of
          how each offboarding is progressing.
        </p>
        <ol className="list-decimal list-inside space-y-2 mt-3 text-sm">
          <li>
            <strong>Invite your team</strong> from{" "}
            <code>Settings → Team &amp; Roles</code>. Assign roles: HR
            admins start &amp; manage flows, IT admins handle access &amp;
            assets, managers approve and own their team's tasks.
          </li>
          <li>
            <strong>Create a template</strong> under{" "}
            <code>Templates</code>. Each template is a reusable checklist of
            tasks with assignees, due dates (offset from last working day),
            and optional dependencies.
          </li>
          <li>
            <strong>Start an offboarding</strong> from{" "}
            <code>Offboardings → New</code>. Pick the employee, last working
            day, template, and (optionally) approvers. The employee receives
            their portal link by email once any required approvals clear.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "starting-offboarding",
    title: "Starting an offboarding",
    icon: Users,
    body: (
      <>
        <p>
          On the New Offboarding screen, fill in the employee's details, pick
          the template that matches their role, and set the last working day.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Portal link</strong> — a unique URL is generated and
            emailed to the employee. It expires 7 days after their last day.
          </li>
          <li>
            <strong>Approvers (optional)</strong> — tick one or more team
            members to require sequential sign-off before the portal email is
            released. Order is set by the order you tick them.
          </li>
          <li>
            <strong>Task creation</strong> — tasks are created in a single
            atomic batch with usage counters; if anything fails, nothing is
            saved (no orphan flows).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "approvals",
    title: "Approval workflow",
    icon: ShieldCheck,
    body: (
      <>
        <p>
          When approvers are selected, the flow starts in{" "}
          <Badge variant="amber">Pending Approval</Badge>. The first approver
          is emailed (and gets an in-app notification). After they approve,
          the next person in the chain is notified — sequentially.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            Only the current approver sees Approve / Reject buttons in the
            <strong> Approval Chain</strong> card.
          </li>
          <li>
            If anyone rejects, the flow moves to{" "}
            <Badge variant="ember">Rejected</Badge> and HR is notified by
            email + in-app.
          </li>
          <li>
            Once the chain completes, the employee portal email goes out
            automatically.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "assets",
    title: "Asset return &amp; verification",
    icon: Package,
    body: (
      <>
        <p>
          Track every laptop, phone, badge, and access card through a
          four-state lifecycle: assigned → returned → verified → wiped.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Mark Returned</strong> — employee said it's back.
          </li>
          <li>
            <strong>Verify Return</strong> — IT physically inspected and
            accepted it (locks the condition rating).
          </li>
          <li>
            <strong>Mark Wiped</strong> — only shown for Laptop / Phone /
            Tablet. Records who performed the sanitization and when.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          The asset score on the offboarding header is weighted across all
          completed steps, so a verified-but-not-wiped laptop is only 2/3
          done.
        </p>
      </>
    ),
  },
  {
    id: "dependencies",
    title: "Task dependencies (DAG view)",
    icon: GitBranch,
    body: (
      <>
        <p>
          Open <code>Offboardings → [flow] → Dependencies</code> to see the
          tasks as a left-to-right graph.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Critical path</strong> (teal) — the longest chain of
            dependent tasks; if anything on it slips, the whole flow slips.
          </li>
          <li>
            <strong>Cycle warning</strong> (red) — if you accidentally make
            task A depend on B which depends on A, those tasks land in a
            trailing column flagged with a Cycle badge.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          Dependencies are defined on the template (
          <code>dependsOnTaskId</code>) and carried into every flow created
          from that template.
        </p>
      </>
    ),
  },
  {
    id: "audit-log",
    title: "Audit log (Activity tab)",
    icon: FileText,
    body: (
      <>
        <p>
          Every offboarding has an immutable activity log on the{" "}
          <strong>Activity</strong> tab. Entries cover flow creation,
          approval decisions, status changes, portal accesses, task updates,
          exit interview submissions, knowledge items added, and the asset
          lifecycle.
        </p>
        <p className="mt-3 text-sm">
          Writes come from Cloud Functions only — clients can't modify or
          delete entries, which makes the log usable as evidence for
          compliance (GDPR, SOX).
        </p>
      </>
    ),
  },
  {
    id: "trends",
    title: "Trend dashboard",
    icon: TrendingUp,
    body: (
      <>
        <p>
          <code>Analytics → Trends</code> rolls up every submitted exit
          interview:
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>Sentiment over time (line chart, monthly average).</li>
          <li>Positive / neutral / negative breakdown by department.</li>
          <li>
            Top themes ranked by frequency, each tagged with average
            sentiment.
          </li>
          <li>Top AI-extracted risk flags.</li>
          <li>3m / 6m / 12m / all-time range toggle.</li>
        </ul>
      </>
    ),
  },
  {
    id: "notifications",
    title: "Notifications &amp; escalation",
    icon: Bell,
    body: (
      <>
        <p>
          The bell icon in the top bar shows your recent notifications. For
          actionable items — overdue tasks, approval requests, risk flags —
          you'll see an "Acknowledge — I'll handle this" button.
        </p>
        <p className="mt-3 text-sm">
          Acknowledging is stronger than reading: it tells the system you're
          taking responsibility. If an actionable notification isn't acked
          within 3 days, it auto-escalates to every super admin (email +
          in-app) and is tagged <Badge variant="ember">Escalated</Badge>.
        </p>
      </>
    ),
  },
  {
    id: "webhooks",
    title: "HRIS webhooks",
    icon: Webhook,
    body: (
      <>
        <p>
          Configure outbound webhooks at{" "}
          <code>Settings → HRIS Webhooks</code> to push offboarding events
          into your HRIS or identity provider.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            Each delivery is a JSON POST:{" "}
            <code>{`{ event, occurredAt, data }`}</code>.
          </li>
          <li>
            If you set a shared secret, the request body is signed and the
            signature arrives in the <code>X-HRExitFlow-Signature</code>{" "}
            header (HMAC-SHA256).
          </li>
          <li>
            Events: <code>flow_completed</code>, <code>flow_cancelled</code>,{" "}
            <code>approval_completed</code>, <code>asset_wiped</code>.
          </li>
          <li>
            Last delivery status and error are shown on each webhook so you
            can debug from the UI without checking logs.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "billing",
    title: "Billing &amp; plans",
    icon: CreditCard,
    body: (
      <>
        <p>
          Plans are managed at <code>Settings → Billing</code>. Only team
          admins (HR admin or super admin) can change the subscription.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Free</strong> — limited offboardings per year; counter
            resets automatically on January 1.
          </li>
          <li>
            Upgrades go through Stripe Checkout. Your plan updates within
            ~30 seconds of payment (the page polls automatically).
          </li>
          <li>
            Cancelling a subscription in Stripe drops the company back to
            free at the end of the billing period.
          </li>
          <li>
            Failed payments trigger an automatic downgrade — you'll see a{" "}
            <Badge variant="ember">past_due</Badge> status until the card is
            updated in Stripe.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "compliance-reports",
    title: "Monthly compliance reports",
    icon: FileText,
    body: (
      <>
        <p>
          On the 1st of each month, super admins and HR admins receive a CSV
          summary of every offboarding closed the prior month — employee,
          role, department, status, task completion %, approval status, and
          dates. The CSV is attached to the email and the run is logged in{" "}
          <code>complianceReports</code> for the audit trail.
        </p>
      </>
    ),
  },
  {
    id: "faq",
    title: "FAQ",
    icon: HelpCircle,
    body: (
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-medium text-navy">
            Why didn't the employee receive their portal email?
          </dt>
          <dd className="text-mist mt-1">
            Most likely the flow is in <code>pending_approval</code> — the
            email is held until the approval chain completes. Check the
            Approval Chain card on the flow detail page.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            Can the portal link be used after the last working day?
          </dt>
          <dd className="text-mist mt-1">
            Yes, for 7 days after the last working day. After that the
            <code>portalExpiresAt</code> guard in Firestore rules blocks
            further access.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            Who can see the activity log?
          </dt>
          <dd className="text-mist mt-1">
            Any signed-in member of the company can read the log; nobody
            (including admins) can write to it from the client.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            What happens if an asset is marked missing?
          </dt>
          <dd className="text-mist mt-1">
            It still counts toward the asset return score, but you can flag
            its condition as "missing" so the audit log records it. Combine
            with an HRIS webhook on <code>flow_completed</code> to trigger
            downstream loss-prevention.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            How do I rotate the webhook secret?
          </dt>
          <dd className="text-mist mt-1">
            Edit the webhook entry under <code>Settings → HRIS Webhooks</code>
            , paste a new secret, and rotate it on the receiving end. There's
            no overlap window — coordinate the change.
          </dd>
        </div>
      </dl>
    ),
  },
];

export default function Help() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  const onJump = (id: string) => {
    setActive(id);
    const el = document.getElementById(`help-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-6">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card padding="sm">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <BookOpen size={16} className="text-teal" />
            <p className="text-sm font-semibold text-navy">Help &amp; guides</p>
          </div>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => onJump(s.id)}
                  className={clsx(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left",
                    active === s.id
                      ? "bg-teal/10 text-teal"
                      : "text-mist hover:text-navy hover:bg-navy/5"
                  )}
                >
                  <Icon size={14} />
                  <span dangerouslySetInnerHTML={{ __html: s.title }} />
                </button>
              );
            })}
          </nav>
        </Card>
      </aside>

      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="text-2xl font-display text-navy">Help &amp; Instructions</h1>
          <p className="text-sm text-mist mt-1">
            How HRExitFlow works, end to end. Use the sidebar to jump to a
            section.
          </p>
        </div>

        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.id} id={`help-${s.id}`} className="scroll-mt-6">
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={18} className="text-teal" />
                  <h2
                    className="text-lg font-semibold text-navy"
                    dangerouslySetInnerHTML={{ __html: s.title }}
                  />
                </div>
                <div className="text-sm text-navy/80 space-y-2 leading-relaxed">
                  {s.body}
                </div>
              </Card>
            </section>
          );
        })}

        <Card className="border-teal/30 bg-teal/5">
          <div className="flex items-start gap-3">
            <HelpCircle size={20} className="text-teal mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-navy">
                Still stuck?
              </p>
              <p className="text-sm text-mist mt-1">
                Email{" "}
                <a
                  href="mailto:support@hrexitflow.com"
                  className="text-teal hover:underline inline-flex items-center gap-1"
                >
                  support@hrexitflow.com <ExternalLink size={12} />
                </a>{" "}
                with the flow ID and a brief description of what you expected
                to happen.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
