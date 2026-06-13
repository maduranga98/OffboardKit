import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { format, differenceInMonths } from "date-fns";
import { Timestamp } from "firebase/firestore";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { AddToPipelineModal } from "../../components/alumni/AddToPipelineModal";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  updateDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type { AlumniProfile } from "../../types/alumni.types";
import {
  BOOMERANG_STAGE_ORDER,
  BOOMERANG_STAGE_LABELS,
  type BoomerangStage,
} from "../../types/alumni";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

function formatTenure(exitDate: Date): string {
  const months = differenceInMonths(new Date(), exitDate);
  if (months < 12) return `${months}m`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m` : `${years}y`;
}

function formatLastActive(ts: Timestamp | null | undefined): string {
  if (!ts) return "Never logged in";
  const d = toDate(ts);
  if (!d) return "Never logged in";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Active today";
  return `Active ${days}d ago`;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-ember/10 text-ember",
  medium: "bg-yellow-50 text-yellow-700",
  low: "bg-navy/5 text-mist",
};

interface CardProps {
  profile: AlumniProfile;
  stageIndex: number;
  totalStages: number;
  onMove: (id: string, direction: "forward" | "back") => Promise<void>;
  moving: boolean;
}

function BoomerangCard({ profile, stageIndex, totalStages, onMove, moving }: CardProps) {
  const exitDate = toDate(profile.exitDate);
  const isFirst = stageIndex === 0;
  const isLast = stageIndex === totalStages - 1;
  const nextLabel = isLast ? null : BOOMERANG_STAGE_LABELS[BOOMERANG_STAGE_ORDER[stageIndex + 1]];

  return (
    <div
      className={clsx(
        "bg-white border border-navy/10 rounded-xl p-4 shadow-sm hover:shadow transition relative",
        moving && "opacity-60 pointer-events-none"
      )}
    >
      {moving && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {/* Row 1: Name + priority */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-sm text-navy leading-tight">{profile.name}</p>
        {profile.rehirePriority !== "none" && (
          <span
            className={clsx(
              "text-xs px-2 py-0.5 rounded font-medium flex-shrink-0",
              PRIORITY_STYLES[profile.rehirePriority] ?? "bg-navy/5 text-mist"
            )}
          >
            {profile.rehirePriority.charAt(0).toUpperCase() + profile.rehirePriority.slice(1)}
          </span>
        )}
      </div>

      {/* Row 2: role · department */}
      <p className="text-xs text-mist truncate mb-1">
        {profile.role}
        {profile.department ? ` · ${profile.department}` : ""}
      </p>

      {/* Row 3: Tenure */}
      {exitDate && (
        <p className="text-xs text-mist mb-1">Tenure: {formatTenure(exitDate)}</p>
      )}

      {/* Row 4: Exit type */}
      <p className="text-xs text-mist mb-1">
        {profile.exitType
          ? profile.exitType.charAt(0).toUpperCase() + profile.exitType.slice(1).toLowerCase()
          : "—"}
      </p>

      {/* Row 5: openToReturn chip */}
      <div className="mb-1">
        {profile.openToReturn === true ? (
          <span className="inline-flex items-center gap-1 text-xs bg-teal/10 text-teal rounded-full px-2 py-0.5">
            ✓ Open to Return
          </span>
        ) : profile.openToReturn === false ? (
          <span className="inline-flex items-center text-xs bg-navy/5 text-mist rounded-full px-2 py-0.5">
            Not Looking
          </span>
        ) : (
          <span className="inline-flex items-center text-xs bg-navy/5 text-mist/70 rounded-full px-2 py-0.5">
            No Response
          </span>
        )}
      </div>

      {/* Row 6: Last active */}
      <p className="text-xs text-mist">{formatLastActive(profile.lastActiveAlumniDate)}</p>

      {/* Action row */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-navy/5">
        <button
          onClick={() => onMove(profile.id, "back")}
          disabled={isFirst || moving}
          className={clsx(
            "text-xs transition-colors",
            isFirst
              ? "invisible"
              : "text-mist hover:text-navy"
          )}
        >
          ← Back
        </button>

        {isLast ? (
          <span className="text-xs bg-teal/10 text-teal px-2 py-0.5 rounded-full font-medium">
            ✓ Rehired
          </span>
        ) : (
          <Button size="sm" onClick={() => onMove(profile.id, "forward")} disabled={moving}>
            {nextLabel} →
          </Button>
        )}
      </div>
    </div>
  );
}

export default function BoomerangPipeline() {
  const { companyId } = useAuth();
  const [profiles, setProfiles] = useState<AlumniProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [returnFilter, setReturnFilter] = useState<string>("all");
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      const all = await queryDocuments<AlumniProfile>("alumniProfiles", [
        where("companyId", "==", companyId),
        orderBy("updatedAt", "desc"),
      ]);

      const inPipeline = all.filter(
        (p) =>
          (p.boomerangStage && p.boomerangStage !== "none") ||
          p.rehirePriority === "high" ||
          p.rehirePriority === "medium"
      );

      setProfiles(
        inPipeline.map((p) => ({
          ...p,
          boomerangStage:
            p.boomerangStage && p.boomerangStage !== "none"
              ? p.boomerangStage
              : "potential",
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allDepartments = useMemo(
    () => [...new Set(profiles.map((p) => p.department).filter(Boolean))].sort(),
    [profiles]
  );

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q)) return false;
      }
      if (deptFilter !== "all" && p.department !== deptFilter) return false;
      if (priorityFilter !== "all" && p.rehirePriority !== priorityFilter) return false;
      if (returnFilter === "open" && p.openToReturn !== true) return false;
      if (returnFilter === "not" && p.openToReturn !== false) return false;
      if (returnFilter === "none" && p.openToReturn != null) return false;
      return true;
    });
  }, [profiles, search, deptFilter, priorityFilter, returnFilter]);

  async function handleMove(id: string, direction: "forward" | "back") {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;

    const currentStage = (profile.boomerangStage ?? "potential") as BoomerangStage;
    const idx = BOOMERANG_STAGE_ORDER.indexOf(currentStage);
    const nextIdx = direction === "forward" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= BOOMERANG_STAGE_ORDER.length) return;

    const nextStage = BOOMERANG_STAGE_ORDER[nextIdx];
    setMovingIds((prev) => new Set(prev).add(id));

    try {
      await updateDocument("alumniProfiles", id, {
        boomerangStage: nextStage,
        updatedAt: serverTimestamp(),
      });
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, boomerangStage: nextStage } : p))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setMovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function toggleCol(stage: string) {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  const alreadyInPipeline = useMemo(() => profiles.map((p) => p.id), [profiles]);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display text-navy">Boomerang Pipeline</h1>
          <p className="text-sm text-mist mt-1">Former employees open to returning</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus size={14} className="mr-1.5" />
          Add to Pipeline
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-4 pr-4 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
        >
          <option value="all">All Departments</option>
          {allDepartments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={returnFilter}
          onChange={(e) => setReturnFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
        >
          <option value="all">All</option>
          <option value="open">Open to Return</option>
          <option value="not">Not Looking</option>
          <option value="none">Not Responded</option>
        </select>
      </div>

      {/* Stage stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BOOMERANG_STAGE_ORDER.map((stage) => {
          const count = filtered.filter((p) => p.boomerangStage === stage).length;
          return (
            <div
              key={stage}
              className="bg-white border border-navy/10 rounded-xl p-3"
            >
              <p className="text-xs text-mist font-medium mb-1">
                {BOOMERANG_STAGE_LABELS[stage]}
              </p>
              <p className="text-xl font-semibold text-navy">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Kanban */}
      {/* Desktop: horizontal grid; Mobile: stacked sections */}
      <div className="hidden md:grid md:grid-cols-4 md:gap-4">
        {BOOMERANG_STAGE_ORDER.map((stage, stageIndex) => {
          const cols = filtered.filter((p) => p.boomerangStage === stage);
          return (
            <div key={stage} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-navy">
                  {BOOMERANG_STAGE_LABELS[stage]}
                </span>
                <span className="bg-teal/10 text-teal text-xs px-2 py-0.5 rounded-full">
                  {cols.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3 min-h-[200px]">
                {cols.length === 0 ? (
                  <div className="border-2 border-dashed border-navy/10 rounded-xl p-6 text-center text-sm text-mist">
                    No alumni here
                  </div>
                ) : (
                  cols.map((p) => (
                    <BoomerangCard
                      key={p.id}
                      profile={p}
                      stageIndex={stageIndex}
                      totalStages={BOOMERANG_STAGE_ORDER.length}
                      onMove={handleMove}
                      moving={movingIds.has(p.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile stacked */}
      <div className="md:hidden space-y-4">
        {BOOMERANG_STAGE_ORDER.map((stage, stageIndex) => {
          const cols = filtered.filter((p) => p.boomerangStage === stage);
          const collapsed = collapsedCols.has(stage);
          return (
            <div key={stage} className="border border-navy/10 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCol(stage)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-navy">
                    {BOOMERANG_STAGE_LABELS[stage]}
                  </span>
                  <span className="bg-teal/10 text-teal text-xs px-2 py-0.5 rounded-full">
                    {cols.length}
                  </span>
                </div>
                {collapsed ? (
                  <ChevronDown size={16} className="text-mist" />
                ) : (
                  <ChevronUp size={16} className="text-mist" />
                )}
              </button>
              {!collapsed && (
                <div className="p-4 space-y-3 bg-navy/[0.02]">
                  {cols.length === 0 ? (
                    <div className="border-2 border-dashed border-navy/10 rounded-xl p-6 text-center text-sm text-mist">
                      No alumni here
                    </div>
                  ) : (
                    cols.map((p) => (
                      <BoomerangCard
                        key={p.id}
                        profile={p}
                        stageIndex={stageIndex}
                        totalStages={BOOMERANG_STAGE_ORDER.length}
                        onMove={handleMove}
                        moving={movingIds.has(p.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AddToPipelineModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        companyId={companyId ?? ""}
        onAdded={loadData}
        alreadyInPipeline={alreadyInPipeline}
      />
    </div>
  );
}
