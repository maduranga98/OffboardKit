import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, X } from "lucide-react";
import clsx from "clsx";
import { useCompanyStore } from "../../store/companyStore";
import { getTrialState } from "../../lib/trial";
import { PLAN_CONFIG, type PlanKey } from "../../lib/plans";

/**
 * Dashboard prompt to subscribe while the free trial runs.
 *
 * Signup no longer asks for a package — the company is dropped straight into
 * the product on a card-free trial — so this is where the choice is actually
 * offered, alongside the thin strip in the app chrome.
 *
 * Dismissal is per browser and per remaining day: closing it clears the card
 * for today, and it returns as the deadline gets closer rather than being
 * silenced for good.
 */
export function TrialUpgradeCard() {
  const company = useCompanyStore((s) => s.company);
  const { isActive, daysRemaining, endsAt } = getTrialState(company);

  const dismissKey = company ? `trialCard:${company.id}:${daysRemaining}` : "";
  const [dismissed, setDismissed] = useState(() => {
    try {
      return !!dismissKey && localStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });

  if (!isActive || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      // Private mode / blocked storage — hiding it for this render is enough.
    }
    setDismissed(true);
  };

  const urgent = daysRemaining <= 2;
  const trialPlan = (company?.trialPlan ?? company?.plan ?? "starter") as PlanKey;
  const planLabel = PLAN_CONFIG[trialPlan]?.label ?? PLAN_CONFIG.starter.label;

  return (
    <div
      className={clsx(
        "relative flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between",
        urgent ? "border-amber/30 bg-amber/5" : "border-teal/20 bg-teal/5"
      )}
    >
      <div className="flex items-start gap-3 pr-8 sm:pr-0">
        <span
          className={clsx(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
            urgent ? "bg-amber/15" : "bg-teal/10"
          )}
        >
          <Sparkles size={17} className={urgent ? "text-amber" : "text-teal"} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-navy">
            {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left on your
            free trial
          </p>
          <p className="mt-1 text-xs leading-relaxed text-mist">
            You are trying {planLabel}
            {endsAt && ` until ${endsAt.toLocaleDateString()}`}. Subscribe any
            time to keep going — or switch packages for free while the trial
            runs.
          </p>
        </div>
      </div>

      <Link
        to="/settings/billing#available-plans"
        className={clsx(
          "inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90",
          urgent ? "bg-amber" : "bg-teal"
        )}
      >
        View plans
        <ArrowRight size={15} aria-hidden />
      </Link>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss for today"
        className="absolute right-3 top-3 text-mist transition-colors hover:text-navy sm:static"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
