import { useState, useEffect, useCallback } from "react";
import { Briefcase } from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import {
  queryDocuments,
  updateDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type { GigRequest, GigStatus } from "../../types/gigRequests.types";
import { GIG_STATUS_CONFIG, ENGAGEMENT_TYPE_LABELS } from "../../types/gigRequests.types";
import { Timestamp } from "firebase/firestore";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

function fmtBudget(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Unspecified";
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `From ${fmt(min)}`;
  if (max != null) return `Up to ${fmt(max)}`;
  return "Unspecified";
}

const FILTER_TABS: { value: GigStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sent", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

function GigCard({
  gig,
  notes,
  actionLoading,
  onRespond,
  onReconsider,
  onNoteChange,
}: {
  gig: GigRequest;
  notes: Record<string, string>;
  actionLoading: Record<string, boolean>;
  onRespond: (gig: GigRequest, status: "accepted" | "declined") => void;
  onReconsider: (gig: GigRequest) => void;
  onNoteChange: (id: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = GIG_STATUS_CONFIG[gig.status];
  const sentDate = toDate(gig.createdAt);
  const respondedDate = toDate(gig.respondedAt);
  const canReconsider =
    gig.status === "declined" &&
    respondedDate &&
    Date.now() - respondedDate.getTime() < 86_400_000;
  const scopeExpanded = (gig.scope ?? "").length > 150;

  return (
    <div className="bg-white border border-navy/10 rounded-xl p-5 space-y-3">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-navy">{gig.title}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs bg-navy/5 text-navy px-2 py-0.5 rounded-full">
            {ENGAGEMENT_TYPE_LABELS[gig.engagementType]}
          </span>
          <span className={clsx("text-xs px-2 py-0.5 rounded-full", cfg.color)}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Scope */}
      <p className="text-sm text-mist">
        {scopeExpanded && !expanded
          ? gig.scope.slice(0, 150) + "…"
          : gig.scope}
        {scopeExpanded && (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="ml-1 text-teal text-xs hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </p>

      {/* Skills */}
      {gig.requiredSkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {gig.requiredSkills.map((s) => (
            <span key={s} className="bg-navy/5 text-navy text-xs px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      )}

      {/* Details */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mist">
        {gig.timelineWeeks && <span>Timeline: {gig.timelineWeeks} weeks</span>}
        <span>Budget: {fmtBudget(gig.budgetMin, gig.budgetMax)}</span>
        {sentDate && <span>Sent {format(sentDate, "MMM d, yyyy")}</span>}
      </div>

      {/* Status banners */}
      {gig.status === "accepted" && (
        <div className="px-3 py-2.5 bg-teal/5 border border-teal/20 rounded-lg text-sm text-teal">
          ✓ You accepted this request. {gig.createdByName} will reach out to coordinate.
          {gig.alumniNote && (
            <p className="mt-1 text-xs text-mist">Your note: "{gig.alumniNote}"</p>
          )}
        </div>
      )}
      {gig.status === "declined" && (
        <div className="px-3 py-2.5 bg-navy/5 rounded-lg text-sm text-mist flex items-center justify-between">
          <span>You declined this request.</span>
          {canReconsider && (
            <button
              type="button"
              onClick={() => onReconsider(gig)}
              disabled={actionLoading[gig.id]}
              className="text-xs text-teal hover:underline ml-2"
            >
              Reconsider?
            </button>
          )}
        </div>
      )}
      {gig.status === "completed" && (
        <div className="px-3 py-2.5 bg-teal/10 rounded-lg">
          <span className="text-xs text-teal font-medium">Completed</span>
        </div>
      )}

      {/* Pending actions */}
      {gig.status === "sent" && (
        <div className="space-y-2 pt-1 border-t border-navy/5">
          <textarea
            rows={2}
            value={notes[gig.id] ?? ""}
            onChange={(e) => onNoteChange(gig.id, e.target.value)}
            placeholder="Optional: Add a note to your response..."
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => onRespond(gig, "accepted")}
              loading={actionLoading[gig.id]}
              size="sm"
            >
              Accept Request
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRespond(gig, "declined")}
              disabled={actionLoading[gig.id]}
            >
              Decline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


  const { alumniProfile } = useAlumniAuth();
  const [gigs, setGigs] = useState<GigRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GigStatus | "all">("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [companyName, setCompanyName] = useState("");

  const loadGigs = useCallback(async () => {
    if (!alumniProfile) return;
    try {
      const data = await queryDocuments<GigRequest>("gigRequests", [
        where("alumniId", "==", alumniProfile.id),
        where("companyId", "==", alumniProfile.companyId),
        orderBy("createdAt", "desc"),
      ]);
      setGigs(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [alumniProfile]);

  useEffect(() => { loadGigs(); }, [loadGigs]);

  useEffect(() => {
    if (!alumniProfile?.companyId) return;
    import("../../lib/firestore").then(({ getDocument }) => {
      getDocument<{ name: string }>("companies", alumniProfile.companyId)
        .then((c) => { if (c?.name) setCompanyName(c.name); })
        .catch(() => {});
    });
  }, [alumniProfile]);

  async function handleRespond(gig: GigRequest, status: "accepted" | "declined") {
    const note = notes[gig.id] ?? "";
    setActionLoading((p) => ({ ...p, [gig.id]: true }));
    setGigs((prev) => prev.map((g) => g.id === gig.id ? { ...g, status, alumniNote: note || null } : g));
    try {
      await updateDocument("gigRequests", gig.id, {
        status,
        alumniNote: note || null,
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      setGigs((prev) => prev.map((g) => g.id === gig.id ? { ...g, status: "sent" as GigStatus } : g));
    } finally {
      setActionLoading((p) => ({ ...p, [gig.id]: false }));
    }
  }

  async function handleReconsider(gig: GigRequest) {
    const respondedAt = toDate(gig.respondedAt);
    if (respondedAt && Date.now() - respondedAt.getTime() > 86_400_000) return;
    setActionLoading((p) => ({ ...p, [gig.id]: true }));
    setGigs((prev) => prev.map((g) => g.id === gig.id ? { ...g, status: "sent" as GigStatus } : g));
    try {
      await updateDocument("gigRequests", gig.id, {
        status: "sent",
        alumniNote: null,
        respondedAt: null,
        updatedAt: serverTimestamp(),
      });
    } catch {
      setGigs((prev) => prev.map((g) => g.id === gig.id ? { ...g, status: "declined" as GigStatus } : g));
    } finally {
      setActionLoading((p) => ({ ...p, [gig.id]: false }));
    }
  }

  const filtered = gigs.filter((g) => filter === "all" ? true : g.status === filter);

  if (loading) return <div className="py-24 flex justify-center"><LoadingSpinner size="lg" /></div>;
  if (!alumniProfile) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-display text-navy">Consulting Requests</h1>
        <p className="text-sm text-mist mt-0.5">
          Gig requests from {companyName || "your former company"}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-navy/5 rounded-md p-1 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              filter === tab.value ? "bg-white text-navy shadow-sm" : "text-mist hover:text-navy"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="py-10 text-center space-y-2">
            <Briefcase size={28} className="text-mist mx-auto" />
            <p className="text-sm font-medium text-navy">No consulting requests yet.</p>
            <p className="text-xs text-mist max-w-xs mx-auto">
              Once you mark yourself available for consulting in your profile, opportunities may appear here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((gig) => (
            <GigCard
              key={gig.id}
              gig={gig}
              notes={notes}
              actionLoading={actionLoading}
              onRespond={handleRespond}
              onReconsider={handleReconsider}
              onNoteChange={(id, value) => setNotes((p) => ({ ...p, [id]: value }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
