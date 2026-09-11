import { Link } from "react-router-dom";
import { Clock, Sparkles } from "lucide-react";
import { useCompanyStore } from "../../store/companyStore";
import { getTrialState } from "../../lib/trial";

/**
 * Thin status strip for the card-free Starter trial.
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
          Your Starter trial has ended — you&rsquo;re now on Basic.
        </span>
        <Link
          to="/settings/billing#available-plans"
          className="font-medium text-ember underline underline-offset-2 hover:no-underline"
        >
          Choose a plan
        </Link>
      </div>
    );
  }

  const urgent = daysRemaining <= 2;

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
        on your free Starter trial
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
        Choose a plan
      </Link>
    </div>
  );
}
