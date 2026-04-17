import { useState } from "react";
import { CheckCircle, User, Briefcase, Building, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { OffboardFlow } from "../../types/offboarding.types";
import { Button } from "../ui/Button";

interface CompleteOffboardingModalProps {
  isOpen: boolean;
  flow: OffboardFlow | null;
  onConfirm: (addToAlumni: boolean) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

export function CompleteOffboardingModal({
  isOpen,
  flow,
  onConfirm,
  onClose,
  loading,
}: CompleteOffboardingModalProps) {
  const [addToAlumni, setAddToAlumni] = useState(true);

  if (!isOpen || !flow) return null;

  const lwdDate = flow.lastWorkingDay.toDate();

  const handleConfirm = async () => {
    await onConfirm(addToAlumni);
  };

  return (
    <div className="fixed inset-0 bg-navy/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-xl overflow-hidden">
        {/* Header with icon */}
        <div className="p-8 text-center border-b border-navy/5">
          <div className="flex justify-center mb-4">
            <div className="bg-teal/10 rounded-full p-3 flex items-center justify-center">
              <CheckCircle size={40} className="text-teal" />
            </div>
          </div>
          <h2 className="font-display text-xl text-navy">
            Mark offboarding complete?
          </h2>
          <p className="text-sm text-mist mt-2">
            Confirm that {flow.employeeName}'s offboarding process is fully
            complete and their last day has passed.
          </p>
        </div>

        {/* Completion summary */}
        <div className="p-8 space-y-4 border-b border-navy/5">
          <div className="flex items-center gap-3">
            <User size={16} className="text-mist flex-shrink-0" />
            <span className="text-sm text-mist">Employee</span>
            <span className="text-sm font-medium text-navy">{flow.employeeName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Briefcase size={16} className="text-mist flex-shrink-0" />
            <span className="text-sm text-mist">Role</span>
            <span className="text-sm font-medium text-navy">{flow.employeeRole}</span>
          </div>
          <div className="flex items-center gap-3">
            <Building size={16} className="text-mist flex-shrink-0" />
            <span className="text-sm text-mist">Department</span>
            <span className="text-sm font-medium text-navy">
              {flow.employeeDepartment}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar size={16} className="text-mist flex-shrink-0" />
            <span className="text-sm text-mist">Last day</span>
            <span className="text-sm font-medium text-navy">
              {format(lwdDate, "MMMM d, yyyy")}
            </span>
          </div>
        </div>

        {/* Alumni opt-in */}
        <div className="p-8 border-b border-navy/5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-navy block">
                Add to alumni network?
              </label>
              <p className="text-xs text-mist mt-1">
                Former employees in the alumni network can be considered for
                rehire and referrals.
              </p>
            </div>

            {/* Toggle switch */}
            <button
              onClick={() => setAddToAlumni(!addToAlumni)}
              className="flex-shrink-0"
            >
              <div
                className={`w-11 h-6 rounded-full transition-colors ${
                  addToAlumni ? "bg-teal" : "bg-navy/20"
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    addToAlumni ? "translate-x-5" : "translate-x-0.5"
                  }`}
                  style={{ marginTop: "2px" }}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="p-8 flex flex-col gap-3">
          <Button
            variant="primary"
            fullWidth
            onClick={handleConfirm}
            loading={loading}
            disabled={loading}
          >
            Confirm & Complete
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
