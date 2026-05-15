import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  Search,
  History,
  Laptop,
  ExternalLink,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { where, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { queryDocuments } from "../../lib/firestore";
import type { Asset, AssetStatus } from "../../types/asset.types";
import type { OffboardFlow } from "../../types/offboarding.types";

type StatusFilter = "all" | AssetStatus;

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") {
    return (ts as Timestamp).toDate();
  }
  return null;
}

function fmt(ts: Timestamp | null | undefined): string {
  const d = toDate(ts);
  return d ? format(d, "MMM d, yyyy") : "—";
}

function statusBadge(status: AssetStatus) {
  const map: Record<
    AssetStatus,
    { label: string; variant: "teal" | "mist" | "ember" | "amber" }
  > = {
    assigned: { label: "Awaiting return", variant: "mist" },
    returned: { label: "Awaiting verification", variant: "amber" },
    verified: { label: "Verified", variant: "teal" },
    wiped: { label: "Wiped & complete", variant: "teal" },
  };
  const s = map[status] ?? map.assigned;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

interface AssetEvent {
  label: string;
  at: Timestamp | null;
  by: string;
}

function buildHistory(asset: Asset): AssetEvent[] {
  const events: AssetEvent[] = [];
  if (asset.assignedAt) {
    events.push({
      label: `Assigned to ${asset.assignedTo || "employee"}`,
      at: asset.assignedAt,
      by: asset.assignedTo,
    });
  }
  if (asset.returnedAt) {
    events.push({
      label: "Marked returned",
      at: asset.returnedAt,
      by: asset.returnedBy,
    });
  }
  if (asset.verifiedAt) {
    events.push({
      label: "Verified by IT",
      at: asset.verifiedAt,
      by: asset.verifiedBy,
    });
  }
  if (asset.wipeCompletedAt) {
    events.push({
      label: "Data wipe completed",
      at: asset.wipeCompletedAt,
      by: asset.wipeCompletedBy,
    });
  }
  return events.sort((a, b) => {
    const aT = toDate(a.at)?.getTime() ?? 0;
    const bT = toDate(b.at)?.getTime() ?? 0;
    return aT - bT;
  });
}

export default function Assets() {
  const { companyId } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [flows, setFlows] = useState<Record<string, OffboardFlow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      try {
        const [assetResults, flowResults] = await Promise.all([
          queryDocuments<Asset>("assets", [
            where("companyId", "==", companyId),
            orderBy("createdAt", "desc"),
          ]),
          queryDocuments<OffboardFlow>("offboardFlows", [
            where("companyId", "==", companyId),
          ]),
        ]);
        setAssets(assetResults);
        const flowMap: Record<string, OffboardFlow> = {};
        flowResults.forEach((f) => {
          flowMap[f.id] = f;
        });
        setFlows(flowMap);
      } catch (err) {
        console.error("Failed to load assets", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const assetTypes = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => a.type && set.add(a.type));
    return Array.from(set).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (!q) return true;
      const flow = flows[a.flowId];
      return (
        a.name.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.assignedTo.toLowerCase().includes(q) ||
        (flow?.employeeName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [assets, flows, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = assets.length;
    const assigned = assets.filter((a) => a.status === "assigned").length;
    const returned = assets.filter((a) => a.status === "returned").length;
    const verified = assets.filter(
      (a) => a.status === "verified" || a.status === "wiped"
    ).length;
    return { total, assigned, returned, verified };
  }, [assets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-navy">Assets</h1>
        <p className="text-sm text-mist mt-1">
          Every asset ever issued across offboardings. Click an asset to see
          its full history.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-mist">Total</p>
          <p className="text-2xl font-display text-navy mt-1">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-mist">Outstanding</p>
          <p className="text-2xl font-display text-navy mt-1">
            {stats.assigned}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-mist">Awaiting Verification</p>
          <p className="text-2xl font-display text-navy mt-1">
            {stats.returned}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-mist">Verified / Wiped</p>
          <p className="text-2xl font-display text-navy mt-1">
            {stats.verified}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-mist"
            />
            <Input
              placeholder="Search by asset, serial, or employee"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border border-warm rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="all">All statuses</option>
            <option value="assigned">Awaiting return</option>
            <option value="returned">Awaiting verification</option>
            <option value="verified">Verified</option>
            <option value="wiped">Wiped & complete</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-warm rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="all">All types</option>
            {assetTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package size={32} />}
          title="No assets found"
          description={
            assets.length === 0
              ? "Assets show up here once you log them on an offboarding."
              : "Try a different filter or search term."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-warm/40 text-mist">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Asset</th>
                  <th className="text-left px-4 py-3 font-medium">Employee</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Returned</th>
                  <th className="text-left px-4 py-3 font-medium">Verified</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const flow = flows[a.flowId];
                  return (
                    <tr
                      key={a.id}
                      className="border-t border-warm/60 hover:bg-warm/20"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Laptop size={16} className="text-mist" />
                          <div>
                            <p className="font-medium text-navy">{a.name}</p>
                            <p className="text-xs text-mist">
                              {a.type}
                              {a.serialNumber ? ` · ${a.serialNumber}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {flow ? (
                          <Link
                            to={`/offboardings/${a.flowId}`}
                            className="text-teal hover:underline inline-flex items-center gap-1"
                          >
                            {flow.employeeName}
                            <ExternalLink size={12} />
                          </Link>
                        ) : (
                          <span className="text-mist">
                            {a.assignedTo || "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{statusBadge(a.status)}</td>
                      <td className="px-4 py-3 text-mist">
                        {fmt(a.returnedAt)}
                      </td>
                      <td className="px-4 py-3 text-mist">
                        {fmt(a.verifiedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setHistoryAsset(a)}
                          className={clsx(
                            "inline-flex items-center gap-1 text-sm",
                            "text-teal hover:underline"
                          )}
                        >
                          <History size={14} />
                          History
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={!!historyAsset}
        onClose={() => setHistoryAsset(null)}
        title={historyAsset ? `${historyAsset.name} — history` : "Asset history"}
      >
        {historyAsset && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase text-mist">Type</p>
                <p className="text-navy">{historyAsset.type}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-mist">Serial</p>
                <p className="text-navy">{historyAsset.serialNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-mist">Condition</p>
                <p className="text-navy capitalize">{historyAsset.condition}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-mist">Status</p>
                <div>{statusBadge(historyAsset.status)}</div>
              </div>
              {flows[historyAsset.flowId] && (
                <div className="col-span-2">
                  <p className="text-xs uppercase text-mist">Offboarding</p>
                  <Link
                    to={`/offboardings/${historyAsset.flowId}`}
                    className="text-teal hover:underline inline-flex items-center gap-1"
                  >
                    {flows[historyAsset.flowId].employeeName}
                    <ExternalLink size={12} />
                  </Link>
                </div>
              )}
              {historyAsset.notes && (
                <div className="col-span-2">
                  <p className="text-xs uppercase text-mist">Notes</p>
                  <p className="text-navy">{historyAsset.notes}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs uppercase text-mist mb-2">Timeline</p>
              {buildHistory(historyAsset).length === 0 ? (
                <p className="text-sm text-mist">No events recorded yet.</p>
              ) : (
                <ol className="space-y-3 border-l-2 border-warm pl-4">
                  {buildHistory(historyAsset).map((ev, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-teal" />
                      <p className="text-sm text-navy font-medium">
                        {ev.label}
                      </p>
                      <p className="text-xs text-mist">
                        {fmt(ev.at)}
                        {ev.by ? ` · ${ev.by}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
