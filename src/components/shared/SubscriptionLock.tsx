import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight, RefreshCw, LogOut } from "lucide-react";
import { Button } from "../ui/Button";
import { useAuth } from "../../hooks/useAuth";
import { TRIAL_DAYS } from "../../lib/trial";
import logo from "../../assets/logo.png";

interface SubscriptionLockProps {
  /** Locked because the free trial ran out, rather than a cancelled plan. */
  afterTrial: boolean;
  /** Re-reads the company document — used after paying in another tab. */
  onRefresh: () => Promise<void>;
}

/**
 * Full-screen block shown to a company with no trial and no subscription.
 *
 * Data is never deleted and stays readable to the server; what stops is the
 * product. The only ways out are subscribing and signing out, so the screen
 * offers exactly those two.
 */
export function SubscriptionLock({ afterTrial, onRefresh }: SubscriptionLockProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-warm/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <img src={logo} alt="OffboardKit" className="h-8 mx-auto mb-8" />

        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm p-8">
          <div className="flex justify-center">
            <div className="rounded-full bg-ember/10 p-3">
              <Lock size={28} className="text-ember" aria-hidden />
            </div>
          </div>

          <h1 className="font-display text-xl text-navy text-center mt-6">
            {afterTrial
              ? `Your ${TRIAL_DAYS}-day free trial has ended`
              : "Your subscription is no longer active"}
          </h1>

          <p className="text-sm text-mist text-center mt-3 leading-relaxed">
            {afterTrial
              ? "Choose a plan to unlock OffboardKit again. Your offboardings, knowledge and alumni data are all safe — nothing was deleted."
              : "Renew or choose a plan to unlock OffboardKit again. All of your data is exactly where you left it."}
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate("/settings/billing#available-plans")}
            >
              Choose a plan
              <ArrowRight size={16} className="ml-2" aria-hidden />
            </Button>
            <Button
              variant="outline"
              fullWidth
              loading={refreshing}
              onClick={handleRefresh}
            >
              <RefreshCw size={16} className="mr-2" aria-hidden />
              I&rsquo;ve already paid
            </Button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-mist">
          <a
            href="mailto:hello@offboardkit.com"
            className="hover:text-navy transition-colors"
          >
            Talk to us
          </a>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 hover:text-navy transition-colors"
          >
            <LogOut size={13} aria-hidden />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
