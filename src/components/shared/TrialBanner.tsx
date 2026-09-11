import { Link } from "react-router-dom";
import { Clock, Sparkles } from "lucide-react";
import { useCompanyStore } from "../../store/companyStore";
import { getTrialState } from "../../lib/trial";
import { PLAN_CONFIG, type PlanKey } from "../../lib/plans";

/**
 * Thin status strip for the card-free trial.
 *
 * No package is picked at signup — every new company simply gets the trial —
 * so this is the running prompt to subscribe: it names the package currently
 * being tried, how long is left, and links straight to Billing where the
 * company can switch packages for free or buy one.
 *
 * Shown only while a trial is running or in the window after it lapsed, so it
 * stays out of the way for paying companies and for anyone who never had one.
 */
export function TrialBanner() {
  const company = useCompanyStore((s) => s.company);
  const { isActive, hasExpired, daysRemaining, endsAt } = getTrialState(company);

  if (!isActive && !hasExpired) return null;

  if (hasExpired) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-ember/20 bg-ember/5 px-4 py-2 text-sm">
        <Clock size={15} className="text-ember" aria-hidden />
        <span className="text-navy">
          Your free trial has ended — OffboardKit is locked until you pick a
          plan.
        </span>
        <Link
          to="/settings/billing#available-plans"
          className="font-medium text-ember underline underline-offset-2 hover:no-underline"
        >
          Subscribe now
        </Link>
      </div>
    );
  }

  const urgent = daysRemaining <= 2;
  const trialPlan = (company?.trialPlan ?? company?.plan ?? "starter") as PlanKey;
  const planLabel = PLAN_CONFIG[trialPlan]?.label ?? PLAN_CONFIG.starter.label;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm ${
        urgent ? "border-amber/30 bg-amber/10" : "border-teal/20 bg-teal/5"
      }`}
    >
      <Sparkles size={15} className={urgent ? "text-amber" : "text-teal"} aria-hidden />
      <span className="text-navy">
        <strong className="font-semibold">
          {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
        </strong>{" "}
        on your free trial &middot; trying {planLabel}
        {endsAt && (
          <span className="text-mist">
            {" "}
            &middot; ends {endsAt.toLocaleDateString()}
          </span>
        )}
      </span>
      <Link
        to="/settings/billing#available-plans"
        className={`font-medium underline underline-offset-2 hover:no-underline ${
          urgent ? "text-amber" : "text-teal"
        }`}
      >
        {urgent ? "Subscribe now" : "View plans & subscribe"}
      </Link>
    </div>
  );
}
