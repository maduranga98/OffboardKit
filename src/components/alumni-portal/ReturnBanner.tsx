import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "../ui/Button";
import { updateDocument, serverTimestamp } from "../../lib/firestore";
import type { AlumniProfile } from "../../types/alumni.types";

interface Props {
  alumniProfile: AlumniProfile;
  companyName: string;
  onUpdate: (openToReturn: boolean) => void;
}

export function ReturnBanner({ alumniProfile, companyName, onUpdate }: Props) {
  const [openToReturn, setOpenToReturn] = useState<boolean | null | undefined>(
    alumniProfile.openToReturn
  );
  const [saving, setSaving] = useState<"yes" | "no" | "reset" | null>(null);

  if (
    alumniProfile.rehirePriority !== "high" &&
    alumniProfile.rehirePriority !== "medium"
  ) {
    return null;
  }

  async function handleRespond(value: boolean) {
    setSaving(value ? "yes" : "no");
    try {
      await updateDocument("alumniProfiles", alumniProfile.id, {
        openToReturn: value,
        updatedAt: serverTimestamp(),
      });
      setOpenToReturn(value);
      onUpdate(value);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  }

  async function handleReset() {
    setSaving("reset");
    try {
      await updateDocument("alumniProfiles", alumniProfile.id, {
        openToReturn: null,
        updatedAt: serverTimestamp(),
      });
      setOpenToReturn(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  }

  if (openToReturn === true) {
    return (
      <div className="bg-teal/5 border border-teal/20 rounded-xl p-4">
        <p className="text-sm text-teal">✓ You've expressed interest in returning. We'll be in touch.</p>
        <button
          onClick={handleReset}
          disabled={saving === "reset"}
          className="text-xs text-mist underline mt-1 hover:text-navy transition-colors disabled:opacity-50"
        >
          {saving === "reset" ? "Updating..." : "Change my response"}
        </button>
      </div>
    );
  }

  if (openToReturn === false) {
    return (
      <div className="bg-navy/[0.03] border border-navy/10 rounded-xl p-4">
        <p className="text-sm text-mist">You've indicated you're not looking right now.</p>
        <button
          onClick={handleReset}
          disabled={saving === "reset"}
          className="text-xs text-mist underline mt-1 hover:text-navy transition-colors disabled:opacity-50"
        >
          {saving === "reset" ? "Updating..." : "Change my response"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-teal/5 border border-teal/20 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Building2 size={20} className="text-teal flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-navy">
              {companyName} may be interested in reconnecting.
            </p>
            <p className="text-xs text-mist mt-0.5">
              Let us know if you're open to exploring opportunities — no commitment required.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            size="sm"
            onClick={() => handleRespond(true)}
            loading={saving === "yes"}
            disabled={saving !== null}
          >
            I'm Open to Return
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRespond(false)}
            loading={saving === "no"}
            disabled={saving !== null}
          >
            Not Right Now
          </Button>
        </div>
      </div>
    </div>
  );
}
