import { useState, useEffect } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
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
import type { Asset } from "../../types/asset.types";

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
  "Badge",
  "Access Card",
  "Keys",
  "Equipment",
  "Other",
];

const CONDITIONS = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "damaged", label: "Damaged" },
  { value: "missing", label: "Missing" },
];

export default function AssetReturnTracker({
  flowId,
  companyId,
  onScoreUpdate,
}: AssetReturnTrackerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "Laptop",
    serialNumber: "",
    condition: "good" as const,
    notes: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await queryDocuments<Asset>("assets", [
          where("flowId", "==", flowId),
        ]);
        setAssets(data);
        const returned = data.filter((a) => a.returnedAt).length;
        const percent = data.length > 0 ? Math.round((returned / data.length) * 100) : 0;
        onScoreUpdate?.(percent);
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [flowId, onScoreUpdate]);

  const handleAddAsset = async () => {
    if (!formData.name.trim()) {
      showToast("error", "Asset name is required");
      return;
    }

    try {
      const newId = crypto.randomUUID();
      const newAsset: Asset = {
        id: newId,
        companyId,
        flowId,
        name: formData.name,
        type: formData.type,
        serialNumber: formData.serialNumber,
        condition: formData.condition,
        notes: formData.notes,
        returnedAt: null,
        returnedBy: "",
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      await setDocument("assets", newId, {
        ...newAsset,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setAssets((prev) => [...prev, newAsset]);
      setFormData({
        name: "",
        type: "Laptop",
        serialNumber: "",
        condition: "good",
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
        returnedAt: serverTimestamp(),
        returnedBy: "employee",
      });

      setAssets((prev) =>
        prev.map((a) =>
          a.id === asset.id
            ? { ...a, returnedAt: new Date() as any, returnedBy: "employee" }
            : a
        )
      );

      const returned = assets.filter((a) => a.id !== asset.id && a.returnedAt).length + 1;
      const percent = Math.round((returned / assets.length) * 100);
      onScoreUpdate?.(percent);
      showToast("success", "Asset marked as returned");
    } catch {
      showToast("error", "Failed to update asset");
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await deleteDocument("assets", assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
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
            description="Assets will appear here once added."
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
            {assets.map((asset) => (
              <Card key={asset.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-navy">
                          {asset.name}
                        </p>
                        <span className="text-xs bg-navy/10 text-navy px-2 py-0.5 rounded">
                          {asset.type}
                        </span>
                      </div>
                      {asset.serialNumber && (
                        <p className="text-xs text-mist mt-1">
                          Serial: {asset.serialNumber}
                        </p>
                      )}
                      {asset.notes && (
                        <p className="text-xs text-mist mt-1">{asset.notes}</p>
                      )}
                    </div>
                    {asset.returnedAt ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Check size={16} className="text-teal" />
                        <span className="text-xs text-teal font-medium">
                          Returned
                        </span>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleMarkReturned(asset)}
                          className="whitespace-nowrap"
                        >
                          Mark Returned
                        </Button>
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="p-1 text-mist hover:text-ember transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-mist">Condition</label>
                    <select
                      value={asset.condition}
                      onChange={(e) => {
                        const newAssets = assets.map((a) =>
                          a.id === asset.id
                            ? {
                                ...a,
                                condition: e.target.value as "good" | "fair" | "damaged" | "missing",
                              }
                            : a
                        );
                        setAssets(newAssets);
                        updateDocument("assets", asset.id, {
                          condition: e.target.value,
                        });
                      }}
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
            ))}
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
              placeholder="e.g., MacBook Pro"
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
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Serial Number (optional)"
              placeholder="e.g., SN123456"
              value={formData.serialNumber}
              onChange={(e) =>
                setFormData({ ...formData, serialNumber: e.target.value })
              }
            />
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Notes (optional)
              </label>
              <textarea
                placeholder="Add any notes about this asset..."
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
