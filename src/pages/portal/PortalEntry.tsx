import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { where, limit as firestoreLimit } from "firebase/firestore";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/shared/EmptyState";
import { queryDocuments } from "../../lib/firestore";
import type { OffboardFlow } from "../../types/offboarding.types";
import ExitInterviewPortal from "./ExitInterviewPortal";

function OffboardKitLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="#0D9E8A" />
      <path d="M7 8h8v12H7V8z" stroke="white" strokeWidth="2" fill="none" />
      <path
        d="M15 12l4 2-4 2"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M19 14h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function PortalEntry() {
  const { token } = useParams<{ token: string }>();
  const [flow, setFlow] = useState<OffboardFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No portal token provided.");
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const flows = await queryDocuments<OffboardFlow>("offboardFlows", [
          where("portalToken", "==", token),
          firestoreLimit(1),
        ]);
        if (flows.length === 0) {
          setError("This portal link is invalid or has expired.");
        } else {
          setFlow(flows[0]);
        }
      } catch {
        setError("Something went wrong. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-warm/30 flex items-center justify-center">
        <div className="text-sm text-mist">Loading portal...</div>
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="min-h-screen bg-warm/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <EmptyState
            title="Portal Unavailable"
            description={error || "This portal link is invalid."}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm/30">
      {/* Top bar */}
      <div className="bg-white border-b border-navy/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <OffboardKitLogo />
            <span className="font-display text-navy text-lg">OffboardKit</span>
          </div>
          <span className="text-sm text-mist">
            {flow.employeeName}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-display text-navy mb-6">
          Exit Interview
        </h1>
        <ExitInterviewPortal flow={flow} />
      </div>
    </div>
  );
}
