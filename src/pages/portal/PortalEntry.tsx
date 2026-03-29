import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  ClipboardList,
  BookOpen,
  MessageSquare,
  CheckCircle,
  Upload,
  FileText,
  PartyPopper,
} from "lucide-react";
import { where, limit as firestoreLimit } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { format, differenceInDays, isPast } from "date-fns";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Progress } from "../../components/ui/Progress";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import {
  queryDocuments,
  updateDocument,
  serverTimestamp,
} from "../../lib/firestore";
import { storage } from "../../lib/firebase";
import type { OffboardFlow, FlowTask } from "../../types/offboarding.types";
import ExitInterviewPortal from "./ExitInterviewPortal";
import KnowledgePortal from "./KnowledgePortal";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function")
    return (ts as Timestamp).toDate();
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

function WelcomeHeader({
  flow,
  completedTasks,
  totalTasks,
}: {
  flow: OffboardFlow;
  completedTasks: number;
  totalTasks: number;
}) {
  const lastWorkingDay = toDate(flow.lastWorkingDay);
  const daysRemaining =
    lastWorkingDay ? differenceInDays(lastWorkingDay, new Date()) : null;
  const lastDayPassed = daysRemaining !== null && daysRemaining < 0;

  return (
    <div className="bg-white border border-navy/5 rounded-xl p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <h1 className="text-xl font-display text-navy">
            Welcome, {flow.employeeName} 👋
          </h1>
          {lastWorkingDay && (
            <p className="text-sm text-mist mt-0.5">
              Your last day:{" "}
              <span className="font-medium text-navy">
                {format(lastWorkingDay, "MMMM d, yyyy")}
              </span>
            </p>
          )}
        </div>
        {daysRemaining !== null && (
          <span
            className={clsx(
              "text-sm font-medium whitespace-nowrap",
              lastDayPassed ? "text-ember" : "text-teal"
            )}
          >
            {lastDayPassed
              ? "Your last day has passed"
              : daysRemaining === 0
                ? "Last day is today!"
                : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`}
          </span>
        )}
      </div>

      {totalTasks > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-mist">Task progress</span>
            <span className="text-xs font-medium text-navy">
              {completedTasks} of {totalTasks} tasks done
            </span>
          </div>
          <Progress
            value={completedTasks}
            max={totalTasks}
            size="md"
            color="teal"
          />
        </div>
      )}

      <p className="text-sm text-mist italic">
        "Thank you for your contributions. Complete these items before your last
        day to ensure a smooth exit."
      </p>
    </div>
  );
}

function AllDoneState({ totalTasks }: { totalTasks: number }) {
  return (
    <div className="bg-white border border-navy/5 rounded-xl p-6 mb-6 text-center">
      <PartyPopper size={40} className="text-teal mx-auto mb-3" />
      <h2 className="text-xl font-display text-navy mb-2">
        You're all done! 🎉
      </h2>
      <p className="text-sm text-mist mb-5">
        Thank you for completing your exit tasks. We wish you the best in your
        next chapter.
      </p>
      <div className="space-y-2 text-left max-w-xs mx-auto mb-6">
        <div className="flex items-center gap-2 text-sm text-navy">
          <CheckCircle size={16} className="text-teal flex-shrink-0" />
          <span>All {totalTasks} tasks completed</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-navy">
          <CheckCircle size={16} className="text-teal flex-shrink-0" />
          <span>Knowledge items submitted</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-navy">
          <CheckCircle size={16} className="text-teal flex-shrink-0" />
          <span>Exit interview complete</span>
        </div>
      </div>
      <Button disabled variant="outline" size="sm">
        Join Alumni Network — Coming soon
      </Button>
    </div>
  );
}

function TasksList({
  flow,
  onProgressChange,
}: {
  flow: OffboardFlow;
  onProgressChange: (completed: number, total: number) => void;
}) {
  const [tasks, setTasks] = useState<FlowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    async function load() {
      try {
        const data = await queryDocuments<FlowTask>("flowTasks", [
          where("flowId", "==", flow.id),
          where("assigneeRole", "==", "employee"),
        ]);
        setTasks(data);
        const completed = data.filter((t) => t.status === "completed").length;
        onProgressChange(completed, data.length);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.id]);

  async function syncFlowProgress(updatedTasks: FlowTask[]) {
    try {
      // Fetch ALL tasks (not just employee tasks) for overall progress
      const allTasks = await queryDocuments<FlowTask>("flowTasks", [
        where("flowId", "==", flow.id),
      ]);
      // Merge optimistic employee-task updates into the full set
      const taskMap = new Map(updatedTasks.map((t) => [t.id, t]));
      const merged = allTasks.map((t) => taskMap.get(t.id) ?? t);
      const completedCount = merged.filter((t) => t.status === "completed").length;
      const totalCount = merged.length;
      const progressPercent =
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      await updateDocument("offboardFlows", flow.id, {
        progressPercent,
        "completionScores.tasks": progressPercent,
        ...(flow.status === "not_started" ? { status: "in_progress" } : {}),
      });
    } catch {
      // Silent fail — progress sync is best-effort
    }
  }

  async function handleToggleTask(task: FlowTask) {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    const prevTasks = tasks;

    // Optimistic update
    const updatedTasks = tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            status: newStatus,
            completedAt:
              newStatus === "completed" ? Timestamp.now() : null,
            completedBy: newStatus === "completed" ? "employee" : "",
          }
        : t
    ) as FlowTask[];
    setTasks(updatedTasks);
    onProgressChange(
      updatedTasks.filter((t) => t.status === "completed").length,
      updatedTasks.length
    );

    try {
      await updateDocument("flowTasks", task.id, {
        status: newStatus,
        completedAt: newStatus === "completed" ? serverTimestamp() : null,
        completedBy: newStatus === "completed" ? "employee" : "",
      });
      await syncFlowProgress(updatedTasks);
    } catch {
      // Revert on error
      setTasks(prevTasks);
      onProgressChange(
        prevTasks.filter((t) => t.status === "completed").length,
        prevTasks.length
      );
    }
  }

  async function handleFileUpload(task: FlowTask, file: File) {
    setUploadingTaskId(task.id);
    setUploadProgress((prev) => ({ ...prev, [task.id]: 0 }));

    try {
      const filePath = `companies/${flow.companyId}/offboardings/${flow.id}/tasks/${task.id}/${file.name}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const pct = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            setUploadProgress((prev) => ({ ...prev, [task.id]: pct }));
          },
          reject,
          async () => {
            try {
              const downloadURL = await getDownloadURL(
                uploadTask.snapshot.ref
              );
              await updateDocument("flowTasks", task.id, {
                status: "completed",
                completedAt: serverTimestamp(),
                completedBy: "employee",
                uploadedFileUrl: downloadURL,
              });
              const updatedTasks = tasks.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      status: "completed" as const,
                      uploadedFileUrl: downloadURL,
                    }
                  : t
              );
              setTasks(updatedTasks);
              onProgressChange(
                updatedTasks.filter((t) => t.status === "completed").length,
                updatedTasks.length
              );
              await syncFlowProgress(updatedTasks);
              resolve();
            } catch (err) {
              reject(err);
            }
          }
        );
      });
    } catch {
      // Upload failed — leave task in previous state
    } finally {
      setUploadingTaskId(null);
    }
  }

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
    <div className="space-y-3">
      {tasks.map((task) => {
        const dueDate = toDate(task.dueDate);
        const overdue =
          dueDate &&
          isPast(dueDate) &&
          task.status !== "completed" &&
          task.status !== "skipped";
        const isUploading = uploadingTaskId === task.id;
        const uploadPct = uploadProgress[task.id] ?? 0;
        const isUploadTask = task.type === "upload";
        const isClickable = !isUploadTask;

        return (
          <div
            key={task.id}
            className="bg-white border border-navy/5 rounded-lg overflow-hidden"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              {/* Checkbox — clickable for non-upload tasks */}
              {isClickable ? (
                <button
                  onClick={() => handleToggleTask(task)}
                  aria-label={
                    task.status === "completed"
                      ? "Mark as pending"
                      : "Mark as completed"
                  }
                  className={clsx(
                    "mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    task.status === "completed"
                      ? "bg-teal border-teal text-white"
                      : "border-navy/20 hover:border-teal"
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
                </button>
              ) : (
                <div
                  className={clsx(
                    "mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                    task.status === "completed"
                      ? "bg-teal border-teal text-white"
                      : "border-navy/20"
                  )}
                >
                  {task.status === "completed" ? (
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
                  ) : (
                    <Upload size={10} className="text-mist" />
                  )}
                </div>
              )}

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
                  <p className="text-xs text-mist mt-0.5">{task.description}</p>
                )}
                {task.type === "signature" && task.status !== "completed" && (
                  <p className="text-xs text-mist/60 mt-1 italic">
                    Signature tasks will be enhanced in a future update
                  </p>
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

            {/* File upload area for upload tasks */}
            {isUploadTask && (
              <div className="px-4 pb-3">
                {task.status === "completed" && task.uploadedFileUrl ? (
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-teal flex-shrink-0" />
                    <span className="text-xs text-navy truncate flex-1">
                      {decodeURIComponent(
                        task.uploadedFileUrl
                          .split("/")
                          .pop()
                          ?.split("?")[0] ?? "Uploaded file"
                      )}
                    </span>
                    <button
                      onClick={() =>
                        fileInputRefs.current[task.id]?.click()
                      }
                      className="text-xs text-teal underline flex-shrink-0"
                    >
                      Re-upload
                    </button>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[task.id] = el;
                      }}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(task, file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                ) : isUploading ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-mist">
                      <span>Uploading…</span>
                      <span>{uploadPct}%</span>
                    </div>
                    <Progress
                      value={uploadPct}
                      max={100}
                      size="sm"
                      color="teal"
                    />
                  </div>
                ) : (
                  <>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[task.id] = el;
                      }}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(task, file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() =>
                        fileInputRefs.current[task.id]?.click()
                      }
                      className="w-full border-2 border-dashed border-navy/15 rounded-lg py-3 px-4 text-center hover:border-teal/50 hover:bg-teal/5 transition-colors"
                    >
                      <Upload size={16} className="text-mist mx-auto mb-1" />
                      <p className="text-xs text-mist">
                        Click to upload a file
                      </p>
                    </button>
                  </>
                )}
              </div>
            )}
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
  const [completedTasks, setCompletedTasks] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);

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
        <div className="text-sm text-mist">Loading portal…</div>
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

  // Check cancelled status
  if (flow.status === "cancelled") {
    return (
      <div className="min-h-screen bg-warm/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <EmptyState
            title="Portal Closed"
            description="This exit portal has closed. If you need access, contact your HR team for assistance."
            action={
              <a href="mailto:hr@yourcompany.com">
                <Button variant="outline" size="sm">
                  📧 Contact HR
                </Button>
              </a>
            }
          />
        </Card>
      </div>
    );
  }

  // Check link expiry — 7 days after last working day
  const lastWorkingDay = toDate(flow.lastWorkingDay);
  if (lastWorkingDay) {
    const expiryDate = new Date(lastWorkingDay);
    expiryDate.setDate(expiryDate.getDate() + 7);
    if (new Date() > expiryDate) {
      return (
        <div className="min-h-screen bg-warm/30 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <EmptyState
              title="Portal Closed"
              description="This exit portal has closed. If you need access, contact your HR team for assistance."
              action={
                <a href="mailto:hr@yourcompany.com">
                  <Button variant="outline" size="sm">
                    📧 Contact HR
                  </Button>
                </a>
              }
            />
          </Card>
        </div>
      );
    }
  }

  const allTasksDone = totalTasks > 0 && completedTasks === totalTasks;

  return (
    <div className="min-h-screen bg-warm/30">
      {/* Top bar */}
      <div className="bg-white border-b border-navy/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <OffboardKitLogo />
            <span className="font-display text-navy text-lg">OffboardKit</span>
          </div>
          <span className="text-sm text-mist">{flow.employeeName}</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Welcome header — visible on all tabs */}
        <WelcomeHeader
          flow={flow}
          completedTasks={completedTasks}
          totalTasks={totalTasks}
        />

        {/* Tasks tab */}
        <div className={portalTab === "tasks" ? "block" : "hidden"}>
          {allTasksDone && <AllDoneState totalTasks={totalTasks} />}
          <h2 className="text-base font-semibold text-navy mb-3">
            {allTasksDone ? "Completed Tasks" : "Your Tasks"}
          </h2>
          {/* Always mounted so progress data stays up to date */}
          <TasksList
            flow={flow}
            onProgressChange={(completed, total) => {
              setCompletedTasks(completed);
              setTotalTasks(total);
            }}
          />
        </div>

        {portalTab === "knowledge" && <KnowledgePortal flow={flow} />}

        {portalTab === "interview" && (
          <>
            <h2 className="text-base font-semibold text-navy mb-3">
              Exit Interview
            </h2>
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
