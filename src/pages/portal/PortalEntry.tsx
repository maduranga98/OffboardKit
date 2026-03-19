import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  ClipboardList,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { where, limit as firestoreLimit } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { format, isPast } from "date-fns";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { queryDocuments } from "../../lib/firestore";
import type { OffboardFlow, FlowTask } from "../../types/offboarding.types";
import ExitInterviewPortal from "./ExitInterviewPortal";
import KnowledgePortal from "./KnowledgePortal";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

function OffboardKitLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="#0D9E8A" />
      <path d="M7 8h8v12H7V8z" stroke="white" strokeWidth="2" fill="none" />
      <path
        d="M15 12l4 2-4 2"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M19 14h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type PortalTab = "tasks" | "knowledge" | "interview";

const TABS: { value: PortalTab; label: string; icon: React.ReactNode }[] = [
  { value: "tasks", label: "Tasks", icon: <ClipboardList size={16} /> },
  { value: "knowledge", label: "Knowledge", icon: <BookOpen size={16} /> },
  { value: "interview", label: "Interview", icon: <MessageSquare size={16} /> },
];

function TasksList({ flow }: { flow: OffboardFlow }) {
  const [tasks, setTasks] = useState<FlowTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await queryDocuments<FlowTask>("flowTasks", [
          where("flowId", "==", flow.id),
          where("assigneeRole", "==", "employee"),
        ]);
        setTasks(data);
      } catch {
        // Error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [flow.id]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No tasks assigned"
          description="You don't have any tasks to complete for your offboarding."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const dueDate = toDate(task.dueDate);
        const overdue =
          dueDate &&
          isPast(dueDate) &&
          task.status !== "completed" &&
          task.status !== "skipped";

        return (
          <div
            key={task.id}
            className="flex items-center gap-3 px-4 py-3 bg-white border border-navy/5 rounded-lg"
          >
            <div
              className={clsx(
                "h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                task.status === "completed"
                  ? "bg-teal border-teal text-white"
                  : "border-navy/20"
              )}
            >
              {task.status === "completed" && (
                <svg
                  width="10"
                  height="8"
                  viewBox="0 0 10 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 4l3 3 5-6" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={clsx(
                  "text-sm font-medium",
                  task.status === "completed"
                    ? "text-mist line-through"
                    : "text-navy"
                )}
              >
                {task.title}
              </p>
              {task.description && (
                <p className="text-xs text-mist truncate">{task.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {dueDate && (
                <span
                  className={clsx(
                    "text-xs",
                    overdue ? "text-ember font-medium" : "text-mist"
                  )}
                >
                  {format(dueDate, "MMM d")}
                </span>
              )}
              <Badge
                variant={
                  task.status === "completed"
                    ? "teal"
                    : task.status === "overdue"
                      ? "ember"
                      : "mist"
                }
              >
                {task.status === "completed"
                  ? "Done"
                  : task.status === "overdue"
                    ? "Overdue"
                    : "Pending"}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PortalEntry() {
  const { token } = useParams<{ token: string }>();
  const [flow, setFlow] = useState<OffboardFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [portalTab, setPortalTab] = useState<PortalTab>("tasks");

  useEffect(() => {
    if (!token) {
      setError("No portal token provided.");
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const flows = await queryDocuments<OffboardFlow>("offboardFlows", [
          where("portalToken", "==", token),
          firestoreLimit(1),
        ]);
        if (flows.length === 0) {
          setError("This portal link is invalid or has expired.");
        } else {
          setFlow(flows[0]);
        }
      } catch {
        setError("Something went wrong. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-warm/30 flex items-center justify-center">
        <div className="text-sm text-mist">Loading portal...</div>
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="min-h-screen bg-warm/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <EmptyState
            title="Portal Unavailable"
            description={error || "This portal link is invalid."}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm/30">
      {/* Top bar */}
      <div className="bg-white border-b border-navy/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <OffboardKitLogo />
            <span className="font-display text-navy text-lg">OffboardKit</span>
          </div>
          <span className="text-sm text-mist">
            {flow.employeeName}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        {portalTab === "tasks" && (
          <>
            <h1 className="text-xl font-display text-navy mb-6">Your Tasks</h1>
            <TasksList flow={flow} />
          </>
        )}
        {portalTab === "knowledge" && (
          <>
            <KnowledgePortal flow={flow} />
          </>
        )}
        {portalTab === "interview" && (
          <>
            <h1 className="text-xl font-display text-navy mb-6">
              Exit Interview
            </h1>
            <ExitInterviewPortal flow={flow} />
          </>
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-navy/10">
        <div className="max-w-2xl mx-auto flex">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setPortalTab(tab.value)}
              className={clsx(
                "flex-1 py-3 text-sm font-medium flex flex-col items-center gap-1 transition-colors",
                portalTab === tab.value
                  ? "text-teal"
                  : "text-mist hover:text-navy"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
