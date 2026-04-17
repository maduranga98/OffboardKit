import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertCircle,
  Search,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  where,
  orderBy,
} from "../../lib/firestore";
import type {
  KnowledgeItem,
  GapSeverity,
} from "../../types/knowledge.types";

const GAP_SEVERITY_COLORS: Record<GapSeverity, string> = {
  critical: "bg-ember/10 text-ember border-ember/30",
  high: "bg-orange-50 text-orange-600 border-orange-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  low: "bg-blue-50 text-blue-600 border-blue-200",
};

const GAP_SEVERITY_BADGE: Record<GapSeverity, string> = {
  critical: "bg-ember/10 text-ember",
  high: "bg-orange-50 text-orange-600",
  medium: "bg-amber-50 text-amber-600",
  low: "bg-blue-50 text-blue-600",
};

export default function KnowledgeGaps() {
  const { companyId } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<GapSeverity | "all">("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await queryDocuments<KnowledgeItem>("knowledgeItems", [
        where("companyId", "==", companyId),
        where("hasGap", "==", true),
        orderBy("createdAt", "desc"),
      ]);
      setItems(data);
    } catch {
      // Error loading
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const departments = useMemo(() => {
    const depts = [...new Set(items.map((i) => i.employeeDepartment).filter(Boolean))];
    return depts.sort();
  }, [items]);

  const filtered = items.filter((item) => {
    if (severityFilter !== "all" && item.gapSeverity !== severityFilter) return false;
    if (departmentFilter !== "all" && item.employeeDepartment !== departmentFilter)
      return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.gapReason?.toLowerCase().includes(q) ||
        item.employeeName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const bySeverity = useMemo(() => {
    const severities: Record<GapSeverity, KnowledgeItem[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    filtered.forEach((item) => {
      const severity = item.gapSeverity || "low";
      severities[severity].push(item);
    });
    return severities;
  }, [filtered]);

  const stats = {
    total: items.length,
    critical: items.filter((i) => i.gapSeverity === "critical").length,
    high: items.filter((i) => i.gapSeverity === "high").length,
    medium: items.filter((i) => i.gapSeverity === "medium").length,
    low: items.filter((i) => i.gapSeverity === "low").length,
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-display text-navy">Knowledge Gaps</h1>
          {stats.total > 0 && (
            <Badge variant="mist">{stats.total} items</Badge>
          )}
        </div>
        <p className="text-sm text-mist mt-1">
          Identified knowledge gaps in offboarding documentation
        </p>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <div className="space-y-1">
              <p className="text-xs font-medium text-mist">Total Gaps</p>
              <p className="text-2xl font-semibold text-navy">{stats.total}</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-1">
              <p className="text-xs font-medium text-mist">Critical</p>
              <p className={clsx(
                "text-2xl font-semibold",
                stats.critical > 0 ? "text-ember" : "text-navy"
              )}>{stats.critical}</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-1">
              <p className="text-xs font-medium text-mist">High</p>
              <p className={clsx(
                "text-2xl font-semibold",
                stats.high > 0 ? "text-orange-600" : "text-navy"
              )}>{stats.high}</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-1">
              <p className="text-xs font-medium text-mist">Medium</p>
              <p className={clsx(
                "text-2xl font-semibold",
                stats.medium > 0 ? "text-amber-600" : "text-navy"
              )}>{stats.medium}</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-1">
              <p className="text-xs font-medium text-mist">Low</p>
              <p className={clsx(
                "text-2xl font-semibold",
                stats.low > 0 ? "text-blue-600" : "text-navy"
              )}>{stats.low}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-mist"
          />
          <input
            type="text"
            placeholder="Search by title, reason, or employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) =>
            setSeverityFilter(e.target.value as GapSeverity | "all")
          }
          className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white flex items-center gap-2"
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={items.length === 0 ? "No knowledge gaps identified" : "No matching gaps"}
            description={items.length === 0 ? "Once gaps are detected, they will appear here." : "Try adjusting your filters."}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {(["critical", "high", "medium", "low"] as const).map((severity) => {
            const severityItems = bySeverity[severity];
            if (severityItems.length === 0) return null;

            return (
              <div key={severity}>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={16} className={clsx(
                    "text-2xl",
                    severity === "critical" ? "text-ember" :
                    severity === "high" ? "text-orange-600" :
                    severity === "medium" ? "text-amber-600" :
                    "text-blue-600"
                  )} />
                  <h2 className={clsx(
                    "text-sm font-semibold uppercase tracking-wide",
                    severity === "critical" ? "text-ember" :
                    severity === "high" ? "text-orange-600" :
                    severity === "medium" ? "text-amber-600" :
                    "text-blue-600"
                  )}>
                    {severity} ({severityItems.length})
                  </h2>
                </div>

                <Card padding="none">
                  <div className="divide-y divide-navy/5">
                    {severityItems.map((item) => (
                      <div key={item.id}>
                        <div
                          className={clsx(
                            "flex items-start gap-3 px-6 py-4 cursor-pointer hover:bg-navy/[0.02]",
                            GAP_SEVERITY_COLORS[severity]
                          )}
                          onClick={() =>
                            setExpandedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            })
                          }
                        >
                          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-navy">{item.title}</p>
                              <Badge variant={GAP_SEVERITY_BADGE[severity] as any}>
                                {severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-mist mt-1">{item.employeeName} · {item.employeeDepartment}</p>
                          </div>
                        </div>

                        {/* Expansion Details */}
                        {expandedIds.has(item.id) && (
                          <div className="bg-navy/[0.02] px-6 py-4 border-t border-navy/5 space-y-3">
                            <div>
                              <p className="text-xs font-medium text-mist mb-1">Gap Reason</p>
                              <p className="text-sm text-navy bg-white rounded-lg p-3 border border-navy/5">
                                {item.gapReason || "No details provided"}
                              </p>
                            </div>
                            {item.description && (
                              <div>
                                <p className="text-xs font-medium text-mist mb-1">Item Description</p>
                                <p className="text-sm text-navy bg-white rounded-lg p-3 border border-navy/5 line-clamp-2">
                                  {item.description}
                                </p>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="font-medium text-mist">Status</p>
                                <Badge variant={
                                  item.status === "reviewed" ? "teal" :
                                  item.status === "submitted" ? "amber" :
                                  "mist"
                                }>
                                  {item.status}
                                </Badge>
                              </div>
                              <div>
                                <p className="font-medium text-mist">Verification</p>
                                <Badge variant={
                                  item.managerVerified ? "teal" :
                                  item.managerVerificationStatus === "pending" ? "amber" :
                                  "mist"
                                }>
                                  {item.managerVerified ? "Verified" : "Pending"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
