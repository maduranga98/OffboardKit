import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  UserCheck,
  XCircle,
  CheckCircle,
  ClipboardCheck,
  MessageSquare,
  BookOpen,
  Eye,
  PlayCircle,
  Package,
  ShieldCheck,
  HardDrive,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { queryDocuments, orderBy } from "../../lib/firestore";
import type { AuditLogEntry, AuditAction } from "../../types/offboarding.types";

interface Props {
  flowId: string;
}

const ACTION_META: Record<
  AuditAction,
  { label: string; icon: React.ReactNode; tone: "teal" | "ember" | "mist" }
> = {
  flow_created: { label: "Flow Created", icon: <PlayCircle size={14} />, tone: "teal" },
  flow_status_changed: { label: "Status Changed", icon: <Activity size={14} />, tone: "mist" },
  flow_cancelled: { label: "Cancelled", icon: <XCircle size={14} />, tone: "ember" },
  flow_completed: { label: "Completed", icon: <CheckCircle size={14} />, tone: "teal" },
  portal_accessed: { label: "Portal Access", icon: <Eye size={14} />, tone: "mist" },
  task_status_changed: { label: "Task Update", icon: <ClipboardCheck size={14} />, tone: "mist" },
  exit_interview_submitted: { label: "Exit Interview", icon: <MessageSquare size={14} />, tone: "teal" },
  knowledge_item_added: { label: "Knowledge", icon: <BookOpen size={14} />, tone: "teal" },
  asset_assigned: { label: "Asset Assigned", icon: <Package size={14} />, tone: "mist" },
  asset_returned: { label: "Asset Returned", icon: <Package size={14} />, tone: "mist" },
  asset_verified: { label: "Asset Verified", icon: <ShieldCheck size={14} />, tone: "teal" },
  asset_wiped: { label: "Asset Wiped", icon: <HardDrive size={14} />, tone: "teal" },
  asset_status_changed: { label: "Asset Update", icon: <Package size={14} />, tone: "mist" },
  approval_requested: { label: "Approval Requested", icon: <Activity size={14} />, tone: "mist" },
  approval_approved: { label: "Approved", icon: <CheckCircle size={14} />, tone: "teal" },
  approval_rejected: { label: "Rejected", icon: <XCircle size={14} />, tone: "ember" },
  approval_completed: { label: "Approval Complete", icon: <CheckCircle size={14} />, tone: "teal" },
};

function actorLabel(entry: AuditLogEntry): string {
  if (entry.actorType === "portal") return "Employee (portal)";
  if (entry.actorType === "system") return "System";
  return entry.actorName || "Team member";
}

export default function AuditLogTab({ flowId }: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await queryDocuments<AuditLogEntry>(
          `offboardFlows/${flowId}/auditLog`,
          [orderBy("createdAt", "desc")]
        );
        if (!cancelled) setEntries(rows);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load audit log"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-ember py-8 text-center">{error}</p>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <p className="text-sm text-mist py-8 text-center">
          No activity yet. Entries will appear here as the offboarding progresses.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <ul className="divide-y divide-navy/5">
        {entries.map((entry) => {
          const meta = ACTION_META[entry.action] ?? {
            label: entry.action,
            icon: <Activity size={14} />,
            tone: "mist" as const,
          };
          const when = entry.createdAt?.toDate
            ? format(entry.createdAt.toDate(), "MMM d, yyyy 'at' h:mm a")
            : "—";
          return (
            <li key={entry.id} className="px-6 py-4 flex items-start gap-4">
              <div className="mt-0.5 text-navy">{meta.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={meta.tone}>{meta.label}</Badge>
                  <span className="text-xs text-mist">{when}</span>
                </div>
                <p className="mt-1 text-sm text-navy">{entry.summary}</p>
                <p className="mt-0.5 text-xs text-mist flex items-center gap-1">
                  <UserCheck size={12} />
                  {actorLabel(entry)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
