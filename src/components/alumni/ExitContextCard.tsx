import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import type { Timestamp } from "firebase/firestore";
import { useExitContext } from "../../hooks/useExitContext";

interface ExitContextCardProps {
  flowId: string | undefined;
  companyId: string;
  alumniName: string;
}

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

export function ExitContextCard({ flowId, companyId }: ExitContextCardProps) {
  const { data, loading } = useExitContext({ flowId, companyId });
  const [summaryOpen, setSummaryOpen] = useState(false);

  if (loading) {
    return (
      <div className="bg-white border border-navy/10 rounded-xl p-4 animate-pulse space-y-3">
        <div className="h-3.5 w-24 bg-navy/10 rounded" />
        <div className="h-3 w-40 bg-navy/5 rounded" />
        <div className="border-t border-navy/5 my-3" />
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-navy/5 rounded" />
          <div className="h-5 w-20 bg-navy/5 rounded-full" />
        </div>
        <div className="border-t border-navy/5 my-3" />
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-navy/5 rounded" />
          <div className="h-3 w-28 bg-navy/5 rounded" />
        </div>
      </div>
    );
  }

  if (!flowId) {
    return (
      <div className="bg-white border border-navy/10 rounded-xl p-4">
        <p className="text-sm text-mist">No exit interview data linked to this alumni profile.</p>
        <p className="text-xs text-mist mt-1">Link this alumni to an offboarding flow to see their exit context.</p>
      </div>
    );
  }

  if (!data || !data.hasData) {
    return (
      <div className="bg-white border border-navy/10 rounded-xl p-4">
        <p className="text-sm text-mist">No exit interview data linked to this alumni profile.</p>
      </div>
    );
  }

  const submittedDate = toDate(data.submittedAt);

  function sentimentBadge() {
    const label = data!.sentimentLabel;
    const score = data!.sentimentScore;
    const scoreText = score !== null ? ` (${score}/100)` : "";

    if (label === "positive") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
          Positive{scoreText}
        </span>
      );
    }
    if (label === "negative") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-ember/10 text-ember">
          Negative{scoreText}
        </span>
      );
    }
    if (label === "neutral") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
          Neutral{scoreText}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-navy/5 text-mist">
        Not analyzed
      </span>
    );
  }

  function npsChip(score: number) {
    if (score >= 9) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
          Promoter ({score}/10)
        </span>
      );
    }
    if (score >= 7) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
          Passive ({score}/10)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-ember/10 text-ember">
        Detractor ({score}/10)
      </span>
    );
  }

  return (
    <div className="bg-white border border-navy/10 rounded-xl p-4">
      {/* Header */}
      <div>
        <p className="font-semibold text-sm text-navy">Exit Context</p>
        {submittedDate && (
          <p className="text-xs text-mist mt-0.5">
            From exit interview completed {format(submittedDate, "MMM d, yyyy")}
          </p>
        )}
      </div>

      {/* Sentiment */}
      <div className="border-t border-navy/5 my-3" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-mist">Sentiment</span>
        {sentimentBadge()}
      </div>

      {/* Left Because */}
      <div className="border-t border-navy/5 my-3" />
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-mist flex-shrink-0">Left Because</span>
        <span className="text-sm text-navy capitalize text-right">
          {data.primaryExitReason ?? "—"}
        </span>
      </div>

      {/* Would Return */}
      {data.wouldRehire !== null && (
        <>
          <div className="border-t border-navy/5 my-3" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-mist">Would Return</span>
            {data.wouldRehire ? (
              <span className="flex items-center gap-1 text-sm text-teal">
                <CheckCircle2 size={14} />
                Yes
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-mist">
                <XCircle size={14} />
                No
              </span>
            )}
          </div>
        </>
      )}

      {/* NPS */}
      {data.npsScore !== null && (
        <>
          <div className="border-t border-navy/5 my-3" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-mist">Recommends Company</span>
            {npsChip(data.npsScore)}
          </div>
        </>
      )}

      {/* Key Themes */}
      {data.keyThemes.length > 0 && (
        <>
          <div className="border-t border-navy/5 my-3" />
          <p className="text-xs text-mist mb-1">Key Themes</p>
          <div className="flex flex-wrap gap-1.5">
            {data.keyThemes.map((theme) => (
              <span
                key={theme}
                className="bg-navy/5 text-navy text-xs px-2 py-0.5 rounded-full"
              >
                {theme}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Risk Flags */}
      {data.riskFlags.length > 0 && (
        <>
          <div className="border-t border-navy/5 my-3" />
          <p className="text-xs text-mist mb-1">Risk Flags</p>
          <div className="flex flex-wrap gap-1.5">
            {data.riskFlags.map((flag) => (
              <span
                key={flag}
                className="bg-ember/10 text-ember text-xs px-2 py-0.5 rounded-full"
              >
                ⚠ {flag}
              </span>
            ))}
          </div>
        </>
      )}

      {/* AI Summary */}
      {data.aiSummary !== null && (
        <>
          <div className="border-t border-navy/5 my-3" />
          <button
            onClick={() => setSummaryOpen((v) => !v)}
            className="text-xs text-teal cursor-pointer hover:underline"
          >
            {summaryOpen ? "Hide AI Summary ↑" : "View AI Summary ↓"}
          </button>
          {summaryOpen && (
            <div className="mt-2 bg-navy/[0.03] rounded-lg p-3 text-xs text-mist italic">
              {data.aiSummary}
            </div>
          )}
        </>
      )}
    </div>
  );
}
