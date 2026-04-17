import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { Button } from "../ui/Button";

interface UpgradeGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  usedCount: number;
  limit: number;
}

export function UpgradeGateModal({
  isOpen,
  onClose,
  usedCount,
  limit,
}: UpgradeGateModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    navigate("/settings/billing");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-navy/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-teal/10 rounded-full p-3 flex items-center justify-center">
            <Zap size={40} className="text-teal" />
          </div>
        </div>

        {/* Heading */}
        <h2 className="font-display text-xl text-navy text-center">
          You've reached your free plan limit
        </h2>

        {/* Subtext */}
        <p className="text-sm text-mist text-center mt-2">
          You've used {usedCount} of {limit} free offboardings this year. Upgrade
          to run unlimited offboardings and unlock all features.
        </p>

        {/* Usage bar */}
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-xs text-mist">
            <span>Free plan usage</span>
            <span>
              {usedCount}/{limit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-navy/10 overflow-hidden">
            <div
              className="h-full bg-ember rounded-full"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex flex-col gap-3">
          <Button variant="primary" fullWidth onClick={handleUpgrade}>
            Upgrade Plan
          </Button>
          <Button variant="outline" fullWidth onClick={onClose}>
            Maybe later
          </Button>
        </div>

        {/* Footer text */}
        <p className="text-xs text-mist text-center mt-4">
          Annual plans available — save 2 months.
        </p>
      </div>
    </div>
  );
}
