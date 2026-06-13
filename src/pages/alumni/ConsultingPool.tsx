import { useState, useEffect, useCallback } from "react";
import { Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { SendGigModal } from "../../components/alumni/SendGigModal";
import {
  queryDocuments,
  updateDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import { useAuth } from "../../hooks/useAuth";
import type { AlumniProfile } from "../../types/alumni.types";
import type { GigRequest, GigStatus } from "../../types/gigRequests.types";
import { GIG_STATUS_CONFIG, ENGAGEMENT_TYPE_LABELS } from "../../types/gigRequests.types";
import { Timestamp } from "firebase/firestore";

interface Props {
  companyId: string;
}

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

function fmtBudget(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Budget not specified";
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `From ${fmt(min)}`;
  if (max != null) return `Up to ${fmt(max)}`;
  return "Budget not specified";
}

function fmtTenure(exitDate: Timestamp | null): string {
  const d = toDate(exitDate);
  if (!d) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(diffDays / 30);
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const ago = formatDistanceToNow(d, { addSuffix: true });
  if (years > 0) return `${years}y ${remMonths}m tenure · Left ${ago}`;
  return `${months}m tenure · Left ${ago}`;
}

const STATUS_TABS: { value: GigStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "completed", label: "Completed" },
];

export default function ConsultingPool({ companyId }: Props) {
  const { appUser } = useAuth();
  const [alumni, setAlumni] = useState<AlumniProfile[]>([]);
  const [gigs, setGigs] = useState<GigRequest[]>([]);
  const [loadingAlumni, setLoadingAlumni] = useState(true);
  const [loadingGigs, setLoadingGigs] = useState(true);
  const [search, setSearch] = useState("");
  const [gigStatusFilter, setGigStatusFilter] = useState<GigStatus | "all">("all");
  const [sendModal, setSendModal] = useState<{ alumni: AlumniProfile } | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadAlumni = useCallback(async () => {
    try {
      const data = await queryDocuments<AlumniProfile>("alumniProfiles", [
        where("companyId", "==", companyId),
        where("openToConsulting", "==", true),
        orderBy("name", "asc"),
      ]);
      setAlumni(data);
    } catch { /* ignore */ }
    finally { setLoadingAlumni(false); }
  }, [companyId]);

  const loadGigs = useCallback(async () => {
    try {
      const data = await queryDocuments<GigRequest>("gigRequests", [
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc"),
      ]);
      setGigs(data);
    } catch { /* ignore */ }
    finally { setLoadingGigs(false); }
  }, [companyId]);

  useEffect(() => { loadAlumni(); }, [loadAlumni]);
  useEffect(() => { loadGigs(); }, [loadGigs]);

  const filteredAlumni = alumni.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.department.toLowerCase().includes(q) ||
      (a.consultingSkills ?? []).some((s) => s.toLowerCase().includes(q))
    );
  });

  const filteredGigs = gigs.filter((g) =>
    gigStatusFilter === "all" ? true : g.status === gigStatusFilter
  );

  async function handleMarkComplete(gig: GigRequest) {
    setActionLoading((p) => ({ ...p, [gig.id]: true }));
    try {
      await updateDocument("gigRequests", gig.id, {
        status: "completed",
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setGigs((prev) => prev.map((g) => g.id === gig.id ? { ...g, status: "completed" as GigStatus } : g));
    } catch { /* ignore */ }
    finally { setActionLoading((p) => ({ ...p, [gig.id]: false })); }
  }

  async function handleCancel(gig: GigRequest) {
    if (!window.confirm(`Cancel gig request "${gig.title}"?`)) return;
    setActionLoading((p) => ({ ...p, [gig.id]: true }));
    try {
      await updateDocument("gigRequests", gig.id, {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
      setGigs((prev) => prev.map((g) => g.id === gig.id ? { ...g, status: "cancelled" as GigStatus } : g));
    } catch { /* ignore */ }
    finally { setActionLoading((p) => ({ ...p, [gig.id]: false })); }
  }

  async function handleSaveNotes(gig: GigRequest) {
    const notes = editingNotes[gig.id] ?? gig.hrNotes;
    setSavingNotes((p) => ({ ...p, [gig.id]: true }));
    try {
      await updateDocument("gigRequests", gig.id, { hrNotes: notes, updatedAt: serverTimestamp() });
      setGigs((prev) => prev.map((g) => g.id === gig.id ? { ...g, hrNotes: notes } : g));
    } catch { /* ignore */ }
    finally { setSavingNotes((p) => ({ ...p, [gig.id]: false })); }
  }

  function handleGigSent(gig: GigRequest) {
    setGigs((prev) => [gig, ...prev]);
  }

  if (loadingAlumni && loadingGigs) {
    return <div className="py-24 flex justify-center"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-display text-navy">Consulting Pool</h2>
          <p className="text-sm text-mist mt-1">Alumni available for freelance and consulting engagements</p>
        </div>
        <span className="text-sm text-mist self-start mt-1">{alumni.length} alumni available</span>
      </div>

      {/* Two-panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Alumni pool */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-navy">Available Alumni</h3>
          <input
            type="text"
            placeholder="Search by name, department, skill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
          />
          {filteredAlumni.length === 0 ? (
            <Card>
              <p className="text-sm text-mist py-4 text-center">
                {alumni.length === 0
                  ? "No alumni are currently available for consulting. Alumni can enable this in their portal profile."
                  : "No alumni match your search."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAlumni.map((a) => {
                const skills = a.consultingSkills ?? [];
                const visibleSkills = skills.slice(0, 3);
                const extra = skills.length - 3;
                return (
                  <div key={a.id} className="bg-white border border-navy/10 rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-navy">{a.name}</p>
                        {a.department && (
                          <span className="inline-block text-xs bg-navy/5 text-navy px-2 py-0.5 rounded-full mt-0.5">
                            {a.department}
                          </span>
                        )}
                      </div>
                    </div>
                    {(a.currentRole || a.currentCompany) && (
                      <p className="text-xs text-mist">
                        {[a.currentRole, a.currentCompany].filter(Boolean).join(" at ")}
                      </p>
                    )}
                    {visibleSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {visibleSkills.map((s) => (
                          <span key={s} className="bg-navy/5 text-navy text-xs px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                        {extra > 0 && (
                          <span className="bg-navy/5 text-navy text-xs px-2 py-0.5 rounded-full">+{extra} more</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-mist">{fmtTenure(a.exitDate)}</p>
                    <Button
                      size="sm"
                      onClick={() => setSendModal({ alumni: a })}
                    >
                      Send Gig Request
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Gig requests */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-navy">Gig Requests</h3>
            <div className="flex gap-1 bg-navy/5 rounded-md p-0.5">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setGigStatusFilter(tab.value)}
                  className={clsx(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                    gigStatusFilter === tab.value ? "bg-white text-navy shadow-sm" : "text-mist hover:text-navy"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loadingGigs ? (
            <div className="py-12 flex justify-center"><LoadingSpinner /></div>
          ) : filteredGigs.length === 0 ? (
            <Card>
              <p className="text-sm text-mist py-4 text-center">No gig requests yet. Send a request from the alumni panel on the left.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredGigs.map((gig) => {
                const cfg = GIG_STATUS_CONFIG[gig.status];
                const createdDate = toDate(gig.createdAt);
                const updatedDate = toDate(gig.updatedAt);
                const currentNotes = editingNotes[gig.id] ?? gig.hrNotes;
                return (
                  <div key={gig.id} className="bg-white border border-navy/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm text-navy">{gig.title}</p>
                        <p className="text-xs text-mist">To: {gig.alumniName}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-navy/5 text-navy">
                          {ENGAGEMENT_TYPE_LABELS[gig.engagementType]}
                        </span>
                        <span className={clsx("text-xs px-2 py-0.5 rounded-full", cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mist">
                      <span>{fmtBudget(gig.budgetMin, gig.budgetMax)}</span>
                      {gig.timelineWeeks && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {gig.timelineWeeks} weeks
                        </span>
                      )}
                      {createdDate && <span>Sent {format(createdDate, "MMM d, yyyy")}</span>}
                      {updatedDate && <span>· Updated {formatDistanceToNow(updatedDate, { addSuffix: true })}</span>}
                    </div>

                    {gig.status === "accepted" && (
                      <div className="px-3 py-2 bg-teal/5 border border-teal/20 rounded-lg text-xs text-teal">
                        ✓ {gig.alumniName} accepted
                        {gig.alumniNote && <span className="text-mist ml-1">— "{gig.alumniNote}"</span>}
                      </div>
                    )}
                    {gig.status === "declined" && gig.alumniNote && (
                      <div className="px-3 py-2 bg-navy/5 rounded-lg text-xs text-mist">
                        Declined: "{gig.alumniNote}"
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {gig.status === "accepted" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkComplete(gig)}
                          loading={actionLoading[gig.id]}
                        >
                          Mark Complete
                        </Button>
                      )}
                      {gig.status === "sent" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-ember hover:text-ember hover:bg-ember/5"
                          onClick={() => handleCancel(gig)}
                          loading={actionLoading[gig.id]}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>

                    {/* HR notes inline */}
                    <div>
                      <label className="text-xs text-mist block mb-1">Internal notes</label>
                      <textarea
                        rows={2}
                        value={currentNotes}
                        onChange={(e) => setEditingNotes((p) => ({ ...p, [gig.id]: e.target.value }))}
                        onBlur={() => handleSaveNotes(gig)}
                        placeholder="Add internal notes..."
                        className="w-full px-2.5 py-1.5 text-xs border border-navy/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal/50 focus:border-teal resize-none"
                      />
                      {savingNotes[gig.id] && <p className="text-xs text-mist">Saving…</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {sendModal && (
        <SendGigModal
          isOpen={true}
          onClose={() => setSendModal(null)}
          companyId={companyId}
          alumniId={sendModal.alumni.id}
          alumniName={sendModal.alumni.name}
          alumniEmail={sendModal.alumni.email}
          alumniSkills={sendModal.alumni.consultingSkills ?? []}
          createdBy={appUser?.id ?? ""}
          createdByName={appUser?.displayName ?? ""}
          onSent={handleGigSent}
        />
      )}
    </div>
  );
}
