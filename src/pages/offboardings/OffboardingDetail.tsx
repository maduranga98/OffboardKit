import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  Calendar,
  Shield,
  MessageSquare,
  Package,
  BookOpen,
  ClipboardList,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { format, differenceInDays, isPast } from "date-fns";
import { where, orderBy } from "firebase/firestore";
import clsx from "clsx";
import AccessRevocationTracker from "../../components/offboardings/AccessRevocationTracker";
import KnowledgeTracker from "../../components/offboardings/KnowledgeTracker";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Progress } from "../../components/ui/Progress";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import {
  getDocument,
  queryDocuments,
  updateDocument,
  serverTimestamp,
} from "../../lib/firestore";
import type {
  OffboardFlow,
  FlowTask,
  FlowStatus,
  TaskStatus,
} from "../../types/offboarding.types";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

function statusBadge(status: FlowStatus) {
  const map: Record<FlowStatus, { label: string; variant: "teal" | "mist" | "ember" }> = {
    not_started: { label: "Not Started", variant: "mist" },
    in_progress: { label: "In Progress", variant: "teal" },
    completed: { label: "Completed", variant: "teal" },
    cancelled: { label: "Cancelled", variant: "ember" },
  };
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function taskStatusBadge(status: TaskStatus) {
  const map: Record<TaskStatus, { label: string; variant: "teal" | "mist" | "ember" }> = {
    pending: { label: "Pending", variant: "mist" },
    in_progress: { label: "In Progress", variant: "teal" },
    completed: { label: "Completed", variant: "teal" },
    overdue: { label: "Overdue", variant: "ember" },
    skipped: { label: "Skipped", variant: "mist" },
  };
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function scoreColor(value: number): "ember" | "amber" | "teal" {
  if (value <= 40) return "ember";
  if (value <= 79) return "amber";
  return "teal";
}

const ROLE_SECTIONS: { role: string; label: string }[] = [
  { role: "hr_admin", label: "HR Tasks" },
  { role: "it_admin", label: "IT Tasks" },
  { role: "manager", label: "Manager Tasks" },
  { role: "employee", label: "Employee Tasks" },
];

const SCORE_CARDS: {
  key: keyof OffboardFlow["completionScores"];
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "tasks", label: "Tasks", icon: <ClipboardList size={16} /> },
  { key: "knowledge", label: "Knowledge", icon: <BookOpen size={16} /> },
  { key: "accessRevocation", label: "Access Revocation", icon: <Shield size={16} /> },
  { key: "exitInterview", label: "Exit Interview", icon: <MessageSquare size={16} /> },
  { key: "assets", label: "Assets", icon: <Package size={16} /> },
];

export default function OffboardingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();

  const [flow, setFlow] = useState<OffboardFlow | null>(null);
  const [tasks, setTasks] = useState<FlowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "access" | "knowledge">("tasks");

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [flowData, taskData] = await Promise.all([
        getDocument<OffboardFlow>("offboardFlows", id),
        queryDocuments<FlowTask>("flowTasks", [
          where("flowId", "==", id),
          orderBy("dueDate", "asc"),
        ]),
      ]);
      if (!flowData) {
        setError("Offboarding not found");
        return;
      }
      setFlow(flowData);
      setTasks(taskData);
    } catch {
      setError("Failed to load offboarding details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCopyPortalLink() {
    if (!flow) return;
    const link = `${window.location.origin}/portal/${flow.portalToken}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  async function handleMarkComplete() {
    if (!flow || !id) return;
    setCompleting(true);
    try {
      await updateDocument("offboardFlows", id, {
        status: "completed",
        completedAt: serverTimestamp(),
        progressPercent: 100,
        "completionScores.tasks": 100,
      });
      navigate("/offboardings");
    } catch {
      setCompleting(false);
    }
  }

  async function handleCancel() {
    if (!flow || !id) return;
    const confirmed = window.confirm(
      `Are you sure you want to cancel ${flow.employeeName}'s offboarding? This action cannot be undone.`
    );
    if (!confirmed) return;
    setCancelling(true);
    try {
      await updateDocument("offboardFlows", id, {
        status: "cancelled",
      });
      setFlow({ ...flow, status: "cancelled" });
    } catch {
      // Error
    } finally {
      setCancelling(false);
    }
  }

  async function handleToggleTask(task: FlowTask) {
    if (!flow || !id || !appUser) return;
    const newStatus: TaskStatus =
      task.status === "completed" ? "pending" : "completed";
    const isCompleting = newStatus === "completed";

    // Optimistic update
    const updatedTasks = tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            status: newStatus,
            completedAt: isCompleting ? Timestamp.now() : null,
            completedBy: isCompleting ? appUser.id : "",
          }
        : t
    );
    setTasks(updatedTasks);

    // Calculate new progress
    const completedCount = updatedTasks.filter(
      (t) => t.status === "completed"
    ).length;
    const totalCount = updatedTasks.length;
    const progressPercent =
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Update flow locally
    let newFlowStatus = flow.status;
    if (flow.status === "not_started" && completedCount > 0) {
      newFlowStatus = "in_progress";
    }

    setFlow({
      ...flow,
      progressPercent,
      status: newFlowStatus,
      completionScores: { ...flow.completionScores, tasks: progressPercent },
    });

    try {
      // Update task
      await updateDocument("flowTasks", task.id, isCompleting
        ? { status: "completed", completedAt: serverTimestamp(), completedBy: appUser.id }
        : { status: "pending", completedAt: null, completedBy: "" }
      );

      // Update flow
      if (newFlowStatus !== flow.status) {
        await updateDocument("offboardFlows", id, {
          progressPercent,
          "completionScores.tasks": progressPercent,
          status: newFlowStatus,
        });
      } else {
        await updateDocument("offboardFlows", id, {
          progressPercent,
          "completionScores.tasks": progressPercent,
        });
      }
    } catch {
      // Revert on error
      loadData();
    }
  }

  // TODO: Add onSnapshot listener for real-time score updates
  const handleKnowledgeScoreUpdate = (newScore: number) => {
    setFlow((prev) =>
      prev
        ? {
            ...prev,
            completionScores: {
              ...prev.completionScores,
              knowledge: newScore,
            },
          }
        : prev
    );
  };

  const handleRevocationScoreUpdate = (newScore: number) => {
    setFlow((prev) =>
      prev
        ? {
            ...prev,
            completionScores: {
              ...prev.completionScores,
              accessRevocation: newScore,
            },
          }
        : prev
    );
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="space-y-4">
        <Link
          to="/offboardings"
          className="inline-flex items-center gap-1 text-sm text-mist hover:text-navy transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Offboardings
        </Link>
        <Card>
          <div className="py-12 text-center">
            <p className="text-sm text-ember font-medium">
              {error || "Offboarding not found"}
            </p>
            <Link to="/offboardings">
              <Button variant="outline" className="mt-4">
                Go Back
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const lwdDate = toDate(flow.lastWorkingDay);
  const daysLeft = lwdDate ? differenceInDays(lwdDate, new Date()) : null;
  const isOverdue = lwdDate ? isPast(lwdDate) : false;
  const canAct =
    !!appUser &&
    flow !== null &&
    flow.status !== "completed" &&
    flow.status !== "cancelled";

  // Group tasks by role
  const tasksByRole = ROLE_SECTIONS.map((section) => ({
    ...section,
    tasks: tasks.filter((t) => t.assigneeRole === section.role),
  })).filter((section) => section.tasks.length > 0);

  return (
    <div className="space-y-6">
      {/* Section 1: Header */}
      <div className="space-y-4">
        <Link
          to="/offboardings"
          className="inline-flex items-center gap-1 text-sm text-mist hover:text-navy transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Offboardings
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full bg-teal/10 flex items-center justify-center text-teal font-display text-xl flex-shrink-0">
              {flow.employeeName.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-display text-navy">
                {flow.employeeName}
              </h1>
              <p className="text-sm text-mist mt-0.5">
                {flow.employeeRole} · {flow.employeeDepartment}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {statusBadge(flow.status)}
                <div className="flex items-center gap-1.5 text-xs text-mist">
                  <Calendar size={12} />
                  {lwdDate ? format(lwdDate, "MMM d, yyyy") : "—"}
                </div>
                {daysLeft !== null && (
                  <span
                    className={clsx(
                      "text-xs font-medium",
                      isOverdue ? "text-ember" : daysLeft <= 7 ? "text-amber-600" : "text-teal"
                    )}
                  >
                    {isOverdue
                      ? `${Math.abs(daysLeft)} days ago`
                      : `${daysLeft} days remaining`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleCopyPortalLink}>
              <LinkIcon size={14} className="mr-1.5" />
              {copied ? "Copied!" : "Copy Portal Link"}
            </Button>
            {canAct && (
              <>
                <Button
                  size="sm"
                  onClick={handleMarkComplete}
                  loading={completing}
                >
                  <CheckCircle size={14} className="mr-1.5" />
                  Mark Complete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  loading={cancelling}
                  className="text-ember hover:text-ember hover:bg-ember/5"
                >
                  <XCircle size={14} className="mr-1.5" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Completion Scores */}
      <div className="flex gap-4 overflow-x-auto pb-1">
        {SCORE_CARDS.map((card) => {
          const value = flow.completionScores[card.key];
          const color = scoreColor(value);
          const colorMap = {
            ember: "text-ember",
            amber: "text-amber-600",
            teal: "text-teal",
          };
          const progressColor = color === "amber" ? "amber" as const : color;

          return (
            <Card key={card.key} className="min-w-[140px] flex-1">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-mist">
                  {card.icon}
                  <span className="text-xs font-medium">{card.label}</span>
                </div>
                <p className={clsx("text-2xl font-semibold", colorMap[color])}>
                  {value}
                  <span className="text-sm font-normal">%</span>
                  {card.key === "knowledge" && flow.knowledgeGapAnalysis?.analyzedAt && (
                    <span className="text-[10px] text-teal ml-1">AI</span>
                  )}
                </p>
                <Progress value={value} size="sm" color={progressColor} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Section 3: Tabs */}
      <div className="flex gap-1 bg-navy/5 rounded-md p-1 w-fit">
        <button
          onClick={() => setActiveTab("tasks")}
          className={clsx(
            "px-4 py-2 text-sm font-medium rounded-md transition-colors",
            activeTab === "tasks"
              ? "bg-white text-navy shadow-sm"
              : "text-mist hover:text-navy"
          )}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveTab("access")}
          className={clsx(
            "px-4 py-2 text-sm font-medium rounded-md transition-colors",
            activeTab === "access"
              ? "bg-white text-navy shadow-sm"
              : "text-mist hover:text-navy"
          )}
        >
          Access Revocation
        </button>
        <button
          onClick={() => setActiveTab("knowledge")}
          className={clsx(
            "px-4 py-2 text-sm font-medium rounded-md transition-colors",
            activeTab === "knowledge"
              ? "bg-white text-navy shadow-sm"
              : "text-mist hover:text-navy"
          )}
        >
          Knowledge
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          <h2 className="text-lg font-display text-navy">Tasks</h2>

          {tasksByRole.length === 0 ? (
            <Card>
              <p className="text-sm text-mist text-center py-8">
                No tasks found for this offboarding.
              </p>
            </Card>
          ) : (
            tasksByRole.map((section) => {
              const completedInSection = section.tasks.filter(
                (t) => t.status === "completed"
              ).length;

              return (
                <Card key={section.role} padding="none">
                  {/* Section header */}
                  <div className="flex items-center justify-between px-6 py-3 border-b border-navy/5 bg-navy/[0.02]">
                    <h3 className="text-sm font-semibold text-navy">
                      {section.label}{" "}
                      <span className="font-normal text-mist">
                        · {completedInSection}/{section.tasks.length} completed
                      </span>
                    </h3>
                  </div>

                  {/* Task rows */}
                  <div className="divide-y divide-navy/5">
                    {section.tasks.map((task) => {
                      const taskDueDate = toDate(task.dueDate);
                      const taskOverdue =
                        taskDueDate &&
                        isPast(taskDueDate) &&
                        task.status !== "completed" &&
                        task.status !== "skipped";

                      return (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 px-6 py-3"
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleTask(task)}
                            disabled={!canAct}
                            className={clsx(
                              "mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                              task.status === "completed"
                                ? "bg-teal border-teal text-white"
                                : "border-navy/20 hover:border-teal",
                              !canAct && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {task.status === "completed" && (
                              <CheckCircle size={12} />
                            )}
                          </button>

                          {/* Content */}
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
                              <p className="text-xs text-mist mt-0.5 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Meta */}
                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                            {task.isRequired && (
                              <Badge variant="amber">Required</Badge>
                            )}
                            {taskDueDate && (
                              <span
                                className={clsx(
                                  "text-xs",
                                  taskOverdue
                                    ? "text-ember font-medium"
                                    : "text-mist"
                                )}
                              >
                                {format(taskDueDate, "MMM d")}
                              </span>
                            )}
                            {taskStatusBadge(task.status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === "access" && (
        <AccessRevocationTracker
          flow={flow}
          onScoreUpdate={handleRevocationScoreUpdate}
        />
      )}

      {activeTab === "knowledge" && (
        <KnowledgeTracker
          flow={flow}
          onScoreUpdate={handleKnowledgeScoreUpdate}
        />
      )}
    </div>
  );
}
