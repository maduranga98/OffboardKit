import { useState, useEffect } from "react";
import { Plus, Trash2, Check, ShieldCheck, HardDrive } from "lucide-react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../shared/EmptyState";
import {
  queryDocuments,
  setDocument,
  updateDocument,
  deleteDocument,
  serverTimestamp,
  where,
} from "../../lib/firestore";
import { showToast } from "../ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import type {
  Asset,
  AssetCondition,
  AssetStatus,
  AssetWipeStatus,
} from "../../types/asset.types";
import { WIPE_REQUIRED_TYPES } from "../../types/asset.types";

interface AssetReturnTrackerProps {
  flowId: string;
  companyId: string;
  onScoreUpdate?: (newScore: number) => void;
}

const ASSET_TYPES = [
  "Laptop",
  "Monitor",
  "Keyboard",
  "Mouse",
  "Phone",
  "Tablet",
  "Badge",
  "Access Card",
  "Keys",
  "Equipment",
  "Other",
];

const CONDITIONS: { value: AssetCondition; label: string }[] = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "damaged", label: "Damaged" },
  { value: "missing", label: "Missing" },
];

function wipeRequired(type: string): boolean {
  return WIPE_REQUIRED_TYPES.includes(type);
}

// Each asset contributes 1 point per required step it has completed,
// divided by its total required steps. A laptop's full path is
// returned → verified → wiped (3 steps); a badge's is returned → verified
// (2 steps).
function assetCompletionFraction(a: Asset): number {
  const requiresWipe = wipeRequired(a.type);
  const totalSteps = requiresWipe ? 3 : 2;
  let done = 0;
  if (a.returnedAt || a.status === "returned" || a.status === "verified" || a.status === "wiped") done++;
  if (a.verifiedAt || a.status === "verified" || a.status === "wiped") done++;
  if (requiresWipe && (a.wipeStatus === "completed" || a.status === "wiped")) done++;
  return done / totalSteps;
}

function statusBadge(a: Asset) {
  const map: Record<AssetStatus, { label: string; variant: "teal" | "mist" | "ember" | "amber" }> = {
    assigned: { label: "Awaiting return", variant: "mist" },
    returned: { label: "Awaiting verification", variant: "amber" },
    verified: { label: "Verified", variant: "teal" },
    wiped: { label: "Wiped & complete", variant: "teal" },
  };
  const s = map[a.status] ?? map.assigned;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export default function AssetReturnTracker({
  flowId,
  companyId,
  onScoreUpdate,
}: AssetReturnTrackerProps) {
  const { appUser } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "Laptop",
    serialNumber: "",
    condition: "good" as AssetCondition,
    assignedTo: "",
    estimatedValue: "",
    notes: "",
  });

  const recomputeScore = (list: Asset[]) => {
    const score =
      list.length === 0
        ? 0
        : Math.round(
            list.reduce((sum, a) => sum + assetCompletionFraction(a), 0) / list.length * 100
          );
    onScoreUpdate?.(score);
    // Persist the score to Firestore so analytics picks it up
    updateDocument("offboardFlows", flowId, {
      "completionScores.assets": score,
    }).catch(() => {});
  };

  useEffect(() => {
    const load = async () => {
      try {
        const data = await queryDocuments<Asset>("assets", [
          where("companyId", "==", companyId),
          where("flowId", "==", flowId),
        ]);
        // Backfill defaults for docs created before the workflow extension
        // so the UI doesn't have to special-case missing fields.
        const normalized = data.map<Asset>((a) => ({
          ...a,
          status:
            a.status ||
            (a.returnedAt ? "returned" : "assigned"),
          wipeStatus:
            a.wipeStatus ||
            (wipeRequired(a.type) ? "pending" : "not_required"),
          assignedTo: a.assignedTo ?? "",
          assignedAt: a.assignedAt ?? null,
          verifiedAt: a.verifiedAt ?? null,
          verifiedBy: a.verifiedBy ?? "",
          wipeCompletedAt: a.wipeCompletedAt ?? null,
          wipeCompletedBy: a.wipeCompletedBy ?? "",
          estimatedValue: a.estimatedValue ?? null,
        }));
        setAssets(normalized);
        recomputeScore(normalized);
      } catch (err) {
        console.error("AssetReturnTracker load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, companyId]);

  const handleAddAsset = async () => {
    if (!formData.name.trim()) {
      showToast("error", "Asset name is required");
      return;
    }
    const estimatedValue = formData.estimatedValue
      ? Number(formData.estimatedValue)
      : null;
    if (
      formData.estimatedValue &&
      (Number.isNaN(estimatedValue) || (estimatedValue ?? -1) < 0)
    ) {
      showToast("error", "Estimated value must be a positive number");
      return;
    }

    try {
      const newId = crypto.randomUUID();
      const requiresWipe = wipeRequired(formData.type);
      const wipeStatus: AssetWipeStatus = requiresWipe
        ? "pending"
        : "not_required";

      await setDocument("assets", newId, {
        id: newId,
        companyId,
        flowId,
        name: formData.name.trim(),
        type: formData.type,
        serialNumber: formData.serialNumber.trim(),
        condition: formData.condition,
        notes: formData.notes.trim(),
        assignedTo: formData.assignedTo.trim(),
        assignedAt: serverTimestamp(),
        estimatedValue,
        status: "assigned" as AssetStatus,
        returnedAt: null,
        returnedBy: "",
        verifiedAt: null,
        verifiedBy: "",
        wipeStatus,
        wipeCompletedAt: null,
        wipeCompletedBy: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Optimistic local insert with approximate timestamp so the row
      // appears immediately; the next reload reconciles.
      const optimistic: Asset = {
        id: newId,
        companyId,
        flowId,
        name: formData.name.trim(),
        type: formData.type,
        serialNumber: formData.serialNumber.trim(),
        condition: formData.condition,
        notes: formData.notes.trim(),
        assignedTo: formData.assignedTo.trim(),
        assignedAt: Timestamp.now(),
        estimatedValue,
        status: "assigned",
        returnedAt: null,
        returnedBy: "",
        verifiedAt: null,
        verifiedBy: "",
        wipeStatus,
        wipeCompletedAt: null,
        wipeCompletedBy: "",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      const next = [...assets, optimistic];
      setAssets(next);
      recomputeScore(next);
      setFormData({
        name: "",
        type: "Laptop",
        serialNumber: "",
        condition: "good",
        assignedTo: "",
        estimatedValue: "",
        notes: "",
      });
      setShowForm(false);
      showToast("success", "Asset added");
    } catch {
      showToast("error", "Failed to add asset");
    }
  };

  const handleMarkReturned = async (asset: Asset) => {
    try {
      await updateDocument("assets", asset.id, {
        status: "returned",
        returnedAt: serverTimestamp(),
        returnedBy: appUser?.id || "",
        updatedAt: serverTimestamp(),
      });
      const next = assets.map((a) =>
        a.id === asset.id
          ? {
              ...a,
              status: "returned" as AssetStatus,
              returnedAt: Timestamp.now(),
              returnedBy: appUser?.id || "",
            }
          : a
      );
      setAssets(next);
      recomputeScore(next);
      showToast("success", "Asset marked as returned");
    } catch {
      showToast("error", "Failed to update asset");
    }
  };

  const handleVerify = async (asset: Asset) => {
    try {
      const nextStatus: AssetStatus = wipeRequired(asset.type) && asset.wipeStatus !== "completed"
        ? "verified"
        : "verified";
      await updateDocument("assets", asset.id, {
        status: nextStatus,
        verifiedAt: serverTimestamp(),
        verifiedBy: appUser?.id || "",
        // If condition wasn't set when returned, leave whatever IT picked.
        updatedAt: serverTimestamp(),
      });
      const next = assets.map((a) =>
        a.id === asset.id
          ? {
              ...a,
              status: nextStatus,
              verifiedAt: Timestamp.now(),
              verifiedBy: appUser?.id || "",
            }
          : a
      );
      setAssets(next);
      recomputeScore(next);
      showToast("success", "Return verified");
    } catch {
      showToast("error", "Failed to verify asset");
    }
  };

  const handleMarkWiped = async (asset: Asset) => {
    try {
      await updateDocument("assets", asset.id, {
        status: "wiped",
        wipeStatus: "completed",
        wipeCompletedAt: serverTimestamp(),
        wipeCompletedBy: appUser?.id || "",
        updatedAt: serverTimestamp(),
      });
      const next = assets.map((a) =>
        a.id === asset.id
          ? {
              ...a,
              status: "wiped" as AssetStatus,
              wipeStatus: "completed" as AssetWipeStatus,
              wipeCompletedAt: Timestamp.now(),
              wipeCompletedBy: appUser?.id || "",
            }
          : a
      );
      setAssets(next);
      recomputeScore(next);
      showToast("success", "Wipe recorded");
    } catch {
      showToast("error", "Failed to record wipe");
    }
  };

  const handleConditionChange = async (
    asset: Asset,
    condition: AssetCondition
  ) => {
    const next = assets.map((a) =>
      a.id === asset.id ? { ...a, condition } : a
    );
    setAssets(next);
    try {
      await updateDocument("assets", asset.id, {
        condition,
        updatedAt: serverTimestamp(),
      });
    } catch {
      showToast("error", "Failed to update condition");
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await deleteDocument("assets", assetId);
      const next = assets.filter((a) => a.id !== assetId);
      setAssets(next);
      recomputeScore(next);
      showToast("success", "Asset removed");
    } catch {
      showToast("error", "Failed to delete asset");
    }
  };

  if (loading) {
    return <div className="text-sm text-mist">Loading assets...</div>;
  }

  return (
    <div className="space-y-4">
      {assets.length === 0 ? (
        <Card>
          <EmptyState
            title="No assets to return"
            description="Track laptops, phones, badges, and other company property."
            action={
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus size={14} className="mr-1" />
                Add Asset
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {assets.map((asset) => {
              const requiresWipe = wipeRequired(asset.type);
              const assignedAtDate = asset.assignedAt?.toDate?.();
              const returnedAtDate = asset.returnedAt?.toDate?.();
              const verifiedAtDate = asset.verifiedAt?.toDate?.();
              const wipedAtDate = asset.wipeCompletedAt?.toDate?.();
              return (
                <Card key={asset.id}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-navy">
                            {asset.name}
                          </p>
                          <span className="text-xs bg-navy/10 text-navy px-2 py-0.5 rounded">
                            {asset.type}
                          </span>
                          {statusBadge(asset)}
                          {requiresWipe && (
                            <span className="inline-flex items-center gap-1 text-xs text-navy/70">
                              <HardDrive size={12} />
                              Wipe required
                            </span>
                          )}
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-mist">
                          {asset.serialNumber && (
                            <div>
                              <dt className="inline font-medium text-navy/70">
                                Serial:
                              </dt>{" "}
                              <dd className="inline">{asset.serialNumber}</dd>
                            </div>
                          )}
                          {asset.assignedTo && (
                            <div>
                              <dt className="inline font-medium text-navy/70">
                                Assigned to:
                              </dt>{" "}
                              <dd className="inline">{asset.assignedTo}</dd>
                            </div>
                          )}
                          {assignedAtDate && (
                            <div>
                              <dt className="inline font-medium text-navy/70">
                                Checked out:
                              </dt>{" "}
                              <dd className="inline">
                                {format(assignedAtDate, "MMM d, yyyy")}
                              </dd>
                            </div>
                          )}
                          {returnedAtDate && (
                            <div>
                              <dt className="inline font-medium text-navy/70">
                                Returned:
                              </dt>{" "}
                              <dd className="inline">
                                {format(returnedAtDate, "MMM d, yyyy")}
                              </dd>
                            </div>
                          )}
                          {verifiedAtDate && (
                            <div>
                              <dt className="inline font-medium text-navy/70">
                                Verified:
                              </dt>{" "}
                              <dd className="inline">
                                {format(verifiedAtDate, "MMM d, yyyy")}
                              </dd>
                            </div>
                          )}
                          {wipedAtDate && (
                            <div>
                              <dt className="inline font-medium text-navy/70">
                                Wiped:
                              </dt>{" "}
                              <dd className="inline">
                                {format(wipedAtDate, "MMM d, yyyy")}
                              </dd>
                            </div>
                          )}
                          {asset.estimatedValue != null && (
                            <div>
                              <dt className="inline font-medium text-navy/70">
                                Value:
                              </dt>{" "}
                              <dd className="inline">
                                ${asset.estimatedValue.toLocaleString()}
                              </dd>
                            </div>
                          )}
                        </dl>
                        {asset.notes && (
                          <p className="text-xs text-mist mt-2">{asset.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {asset.status === "assigned" && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkReturned(asset)}
                          >
                            Mark Returned
                          </Button>
                        )}
                        {asset.status === "returned" && (
                          <Button
                            size="sm"
                            onClick={() => handleVerify(asset)}
                          >
                            <ShieldCheck size={14} className="mr-1" />
                            Verify Return
                          </Button>
                        )}
                        {asset.status === "verified" && requiresWipe && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkWiped(asset)}
                          >
                            <HardDrive size={14} className="mr-1" />
                            Mark Wiped
                          </Button>
                        )}
                        {(asset.status === "verified" && !requiresWipe) ||
                        asset.status === "wiped" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-teal font-medium">
                            <Check size={14} />
                            Complete
                          </span>
                        ) : null}
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="p-1 text-mist hover:text-ember transition-colors self-end"
                          title="Remove asset"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-mist">Condition</label>
                      <select
                        value={asset.condition}
                        onChange={(e) =>
                          handleConditionChange(
                            asset,
                            e.target.value as AssetCondition
                          )
                        }
                        className="w-full mt-1 rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {!showForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
              className="w-full"
            >
              <Plus size={14} className="mr-1" />
              Add Asset
            </Button>
          )}
        </>
      )}

      {showForm && (
        <Card className="border-teal/30 bg-teal/5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-navy">Add Asset</h3>
            <Input
              label="Asset Name"
              placeholder="e.g., MacBook Pro 14&quot;"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                    {wipeRequired(t) ? " (wipe required)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Serial Number (optional)"
              placeholder="e.g., C02XK1JZJG5J"
              value={formData.serialNumber}
              onChange={(e) =>
                setFormData({ ...formData, serialNumber: e.target.value })
              }
            />
            <Input
              label="Assigned to (optional)"
              placeholder="Employee name or ID"
              value={formData.assignedTo}
              onChange={(e) =>
                setFormData({ ...formData, assignedTo: e.target.value })
              }
            />
            <Input
              label="Estimated value (USD, optional)"
              placeholder="e.g., 2200"
              type="number"
              value={formData.estimatedValue}
              onChange={(e) =>
                setFormData({ ...formData, estimatedValue: e.target.value })
              }
            />
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Notes (optional)
              </label>
              <textarea
                placeholder="Charger included? Accessories? Known issues?"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={2}
                className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddAsset} className="flex-1">
                Add Asset
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
