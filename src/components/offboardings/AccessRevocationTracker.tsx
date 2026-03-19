import { useState, useEffect, useRef, useCallback } from "react";
import { ShieldCheck, RotateCcw, Shield, Settings, FileText } from "lucide-react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { where } from "firebase/firestore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import {
  setDocument,
  updateDocument,
  queryDocuments,
  serverTimestamp,
} from "../../lib/firestore";
import { useAuth } from "../../hooks/useAuth";
import type { OffboardFlow } from "../../types/offboarding.types";
import type {
  AccessRevocation,
  RevocationStatus,
  SystemCatalogItem,
} from "../../types/revocation.types";

interface AccessRevocationTrackerProps {
  flow: OffboardFlow;
  onScoreUpdate?: (newScore: number) => void;
}

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

export default function AccessRevocationTracker({
  flow,
  onScoreUpdate,
}: AccessRevocationTrackerProps) {
  const { appUser } = useAuth();
  const [revocations, setRevocations] = useState<AccessRevocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);

  const calculateAndUpdateScore = useCallback(
    async (items: AccessRevocation[]) => {
      const total = items.length;
      if (total === 0) return;
      const done = items.filter(
        (r) => r.status === "revoked" || r.status === "not_applicable"
      ).length;
      const percent = Math.round((done / total) * 100);

      try {
        await updateDocument("offboardFlows", flow.id, {
          "completionScores.accessRevocation": percent,
        });
      } catch (err) {
        console.error("Failed to update flow score:", err);
      }

      onScoreUpdate?.(percent);
    },
    [flow.id, onScoreUpdate]
  );

  useEffect(() => {
    if (initializedRef.current) return;

    async function init() {
      try {
        const [catalogItems, existingRevocations] = await Promise.all([
          queryDocuments<SystemCatalogItem>("systemCatalog", [
            where("companyId", "==", flow.companyId),
          ]),
          queryDocuments<AccessRevocation>("accessRevocations", [
            where("flowId", "==", flow.id),
          ]),
        ]);

        const activeTools = catalogItems.filter((t) => t.isActive);
        const existingMap = new Map(
          existingRevocations.map((r) => [r.toolName, r])
        );

        // Create missing revocation records
        const newRevocations: AccessRevocation[] = [];
        for (const tool of activeTools) {
          if (!existingMap.has(tool.name)) {
            const id = crypto.randomUUID();
            const newRev: AccessRevocation = {
              id,
              flowId: flow.id,
              companyId: flow.companyId,
              toolName: tool.name,
              status: "pending",
              revokedAt: null,
              revokedBy: "",
              revokedByName: "",
              notes: "",
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            };
            newRevocations.push(newRev);

            try {
              await setDocument("accessRevocations", id, {
                ...newRev,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              console.error("Failed to create revocation:", err);
            }
          }
        }

        const merged = [...existingRevocations, ...newRevocations].sort(
          (a, b) => a.toolName.localeCompare(b.toolName)
        );
        setRevocations(merged);
        initializedRef.current = true;
      } catch (err) {
        console.error("Failed to load revocation data:", err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [flow.id, flow.companyId]);

  async function handleStatusChange(
    revocation: AccessRevocation,
    newStatus: RevocationStatus
  ) {
    if (!appUser) return;

    setUpdatingIds((prev) => new Set(prev).add(revocation.id));

    // Optimistic update
    const updated = revocations.map((r) =>
      r.id === revocation.id
        ? {
            ...r,
            status: newStatus,
            revokedAt:
              newStatus === "revoked" ? Timestamp.now() : null,
            revokedBy:
              newStatus === "revoked" ? appUser.id : "",
            revokedByName:
              newStatus === "revoked"
                ? appUser.displayName || appUser.email
                : "",
          }
        : r
    );
    setRevocations(updated);

    try {
      if (newStatus === "revoked") {
        await updateDocument("accessRevocations", revocation.id, {
          status: "revoked",
          revokedAt: serverTimestamp(),
          revokedBy: appUser.id,
          revokedByName: appUser.displayName || appUser.email,
          updatedAt: serverTimestamp(),
        });
      } else if (newStatus === "not_applicable") {
        await updateDocument("accessRevocations", revocation.id, {
          status: "not_applicable",
          revokedAt: null,
          revokedBy: appUser.id,
          revokedByName: appUser.displayName || appUser.email,
          updatedAt: serverTimestamp(),
        });
      } else {
        // pending (undo)
        await updateDocument("accessRevocations", revocation.id, {
          status: "pending",
          revokedAt: null,
          revokedBy: "",
          revokedByName: "",
          updatedAt: serverTimestamp(),
        });
      }

      await calculateAndUpdateScore(updated);
    } catch (err) {
      console.error("Failed to update revocation:", err);
      // Revert
      setRevocations(revocations);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(revocation.id);
        return next;
      });
    }
  }

  function handleOpenNote(revocation: AccessRevocation) {
    setEditingNoteId(revocation.id);
    setNoteText(revocation.notes || "");
    setTimeout(() => noteRef.current?.focus(), 0);
  }

  async function handleSaveNote(revocationId: string) {
    setEditingNoteId(null);

    const prev = revocations.find((r) => r.id === revocationId);
    if (!prev || prev.notes === noteText) return;

    setRevocations((items) =>
      items.map((r) =>
        r.id === revocationId ? { ...r, notes: noteText } : r
      )
    );

    try {
      await updateDocument("accessRevocations", revocationId, {
        notes: noteText,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to save note:", err);
    }
  }

  function handleNoteKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    _revocationId: string
  ) {
    if (e.key === "Escape") {
      setEditingNoteId(null);
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (revocations.length === 0) {
    return (
      <EmptyState
        icon={<Settings size={48} strokeWidth={1.5} />}
        title="No systems configured"
        description="Add your tech stack in Settings → Integrations."
      />
    );
  }

  const totalCount = revocations.length;
  const doneCount = revocations.filter(
    (r) => r.status === "revoked" || r.status === "not_applicable"
  ).length;
  const progressPercent =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-display text-navy">
            System Access Revocation
          </h2>
          <span className="text-sm text-mist">
            {doneCount} of {totalCount} systems revoked
          </span>
        </div>
        <div className="w-full bg-navy/10 rounded-full h-2">
          <div
            className="bg-teal h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Tool list */}
      <Card padding="none">
        <div className="divide-y divide-navy/5">
          {revocations.map((rev) => {
            const isUpdating = updatingIds.has(rev.id);
            const revokedDate = toDate(rev.revokedAt);

            return (
              <div key={rev.id}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-6 py-3">
                  {/* Left: tool name + badge */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Shield size={16} className="text-mist flex-shrink-0" />
                    <span className="text-sm font-medium text-navy truncate">
                      {rev.toolName}
                    </span>
                    {rev.status === "pending" && (
                      <Badge variant="mist">Pending</Badge>
                    )}
                    {rev.status === "revoked" && (
                      <Badge variant="teal">Revoked</Badge>
                    )}
                    {rev.status === "not_applicable" && (
                      <Badge variant="mist">N/A</Badge>
                    )}
                  </div>

                  {/* Center: revocation info */}
                  <div className="flex-1 min-w-0">
                    {rev.status === "revoked" && rev.revokedByName && (
                      <span className="text-xs text-mist">
                        Revoked by {rev.revokedByName}
                        {revokedDate
                          ? ` on ${format(revokedDate, "MMM d, yyyy")}`
                          : ""}
                      </span>
                    )}
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {rev.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          loading={isUpdating}
                          onClick={() => handleStatusChange(rev, "revoked")}
                        >
                          <ShieldCheck size={14} className="mr-1.5" />
                          Mark Revoked
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-mist"
                          disabled={isUpdating}
                          onClick={() =>
                            handleStatusChange(rev, "not_applicable")
                          }
                        >
                          N/A
                        </Button>
                      </>
                    )}
                    {(rev.status === "revoked" ||
                      rev.status === "not_applicable") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isUpdating}
                        loading={isUpdating}
                        onClick={() => handleStatusChange(rev, "pending")}
                      >
                        <RotateCcw size={14} className="mr-1.5" />
                        Undo
                      </Button>
                    )}
                    <button
                      className="text-xs text-teal hover:text-teal-light transition-colors"
                      onClick={() =>
                        editingNoteId === rev.id
                          ? setEditingNoteId(null)
                          : handleOpenNote(rev)
                      }
                    >
                      <FileText size={14} className="inline mr-1" />
                      {rev.notes ? "Edit note" : "Add note"}
                    </button>
                  </div>
                </div>

                {/* Inline note editor */}
                {editingNoteId === rev.id && (
                  <div className="px-6 pb-3">
                    <textarea
                      ref={noteRef}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onBlur={() => handleSaveNote(rev.id)}
                      onKeyDown={(e) => handleNoteKeyDown(e, rev.id)}
                      placeholder="Add a note..."
                      rows={2}
                      className="w-full text-sm text-navy bg-navy/[0.02] border border-navy/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
                    />
                    <p className="text-xs text-mist mt-1">
                      Auto-saves on blur. Press Escape to cancel.
                    </p>
                  </div>
                )}

                {/* Show existing note if not editing */}
                {editingNoteId !== rev.id && rev.notes && (
                  <div className="px-6 pb-3">
                    <p className="text-xs text-mist bg-navy/[0.02] rounded-md px-3 py-2">
                      {rev.notes}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
