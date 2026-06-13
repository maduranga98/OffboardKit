import { useState, useEffect, useCallback } from "react";
import {
  Briefcase,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { CreateJobModal } from "../../components/alumni/CreateJobModal";
import {
  queryDocuments,
  updateDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import { useAuth } from "../../hooks/useAuth";
import type { AlumniJob, AlumniApplication, ApplicationStatus } from "../../types/alumniJobs";
import { JOB_TYPE_LABELS, APPLICATION_STATUS_LABELS } from "../../types/alumniJobs";
import type { Timestamp } from "firebase/firestore";

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return "Salary not disclosed";
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${fmt(min)} – ${fmt(max)} / year`;
  if (min) return `From ${fmt(min)} / year`;
  return `Up to ${fmt(max!)} / year`;
}

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

type StatusFilter = "all" | "open" | "closed" | "draft";

interface ApplicationsPanelProps {
  job: AlumniJob;
  onClose: () => void;
}

function ApplicationsPanel({ job, onClose }: ApplicationsPanelProps) {
  const [applications, setApplications] = useState<AlumniApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"applied" | "referrals">("applied");
  const [hrNotes, setHrNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    queryDocuments<AlumniApplication>("alumniApplications", [
      where("jobId", "==", job.id),
      orderBy("createdAt", "desc"),
    ])
      .then((apps) => {
        setApplications(apps);
        const notes: Record<string, string> = {};
        apps.forEach((a) => { notes[a.id] = a.hrNotes || ""; });
        setHrNotes(notes);
      })
      .catch(() => showToast("error", "Failed to load applications"))
      .finally(() => setLoading(false));
  }, [job.id]);

  const selfApps = applications.filter((a) => a.type === "self");
  const referrals = applications.filter((a) => a.type === "referral");

  const updateStatus = async (appId: string, status: ApplicationStatus) => {
    try {
      await updateDocument("alumniApplications", appId, {
        status,
        hrNotes: hrNotes[appId] || "",
        updatedAt: serverTimestamp(),
      });
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status } : a))
      );
      if (status === "hired") {
        showToast("success", "Referral marked as hired. This updates your conversion metrics in Analytics.");
      } else {
        showToast("success", "Status updated");
      }
    } catch {
      showToast("error", "Failed to update status");
    }
  };

  const saveNotes = async (appId: string) => {
    try {
      await updateDocument("alumniApplications", appId, {
        hrNotes: hrNotes[appId] || "",
        updatedAt: serverTimestamp(),
      });
      showToast("success", "Notes saved");
    } catch {
      showToast("error", "Failed to save notes");
    }
  };

  if (loading) return <div className="py-6"><LoadingSpinner /></div>;

  const list = activeTab === "applied" ? selfApps : referrals;

  return (
    <div className="mt-3 border-t border-navy/10 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 bg-navy/5 rounded-md p-1 w-fit">
          <button
            onClick={() => setActiveTab("applied")}
            className={clsx(
              "px-3 py-1 text-xs font-medium rounded transition-colors",
              activeTab === "applied" ? "bg-white text-navy shadow-sm" : "text-mist hover:text-navy"
            )}
          >
            Applied ({selfApps.length})
          </button>
          <button
            onClick={() => setActiveTab("referrals")}
            className={clsx(
              "px-3 py-1 text-xs font-medium rounded transition-colors",
              activeTab === "referrals" ? "bg-white text-navy shadow-sm" : "text-mist hover:text-navy"
            )}
          >
            Referrals ({referrals.length})
          </button>
        </div>
        <button onClick={onClose} className="text-xs text-mist hover:text-navy">
          <ChevronUp size={16} />
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-mist text-center py-6">
          No {activeTab === "applied" ? "applications" : "referrals"} yet.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((app) => (
            <div key={app.id} className="bg-navy/2 border border-navy/8 rounded-lg p-3 space-y-2">
              {app.type === "self" ? (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-navy">{app.alumniName}</p>
                    <p className="text-xs text-mist">{app.alumniEmail}</p>
                    {app.linkedInUrl && (
                      <a href={app.linkedInUrl} target="_blank" rel="noreferrer" className="text-xs text-teal hover:underline">
                        LinkedIn
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-mist">
                      {toDate(app.createdAt) ? format(toDate(app.createdAt)!, "MMM d") : ""}
                    </span>
                    <select
                      value={app.status}
                      onChange={(e) => updateStatus(app.id, e.target.value as ApplicationStatus)}
                      className="text-xs border border-navy/20 rounded px-2 py-1 text-navy bg-white focus:outline-none"
                    >
                      {Object.entries(APPLICATION_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-navy">{app.refereeName}</p>
                    <p className="text-xs text-mist">{app.refereeEmail} · {app.refereeRelationship}</p>
                    <p className="text-xs text-mist">Referred by {app.referrerAlumniName}</p>
                    {app.referralNote && (
                      <p className="text-xs text-navy mt-1 italic">"{app.referralNote}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-mist">
                      {toDate(app.createdAt) ? format(toDate(app.createdAt)!, "MMM d") : ""}
                    </span>
                    <select
                      value={app.status}
                      onChange={(e) => updateStatus(app.id, e.target.value as ApplicationStatus)}
                      className="text-xs border border-navy/20 rounded px-2 py-1 text-navy bg-white focus:outline-none"
                    >
                      {Object.entries(APPLICATION_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {app.type === "self" && app.coverNote && (
                <p className="text-xs text-navy bg-white border border-navy/10 rounded p-2">{app.coverNote}</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="HR notes..."
                  value={hrNotes[app.id] ?? ""}
                  onChange={(e) => setHrNotes((prev) => ({ ...prev, [app.id]: e.target.value }))}
                  className="flex-1 text-xs border border-navy/20 rounded px-2 py-1 text-navy focus:outline-none focus:ring-1 focus:ring-teal/50"
                />
                <Button size="sm" variant="ghost" onClick={() => saveNotes(app.id)}>
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AlumniJobBoard() {
  const { companyId, user } = useAuth();
  const [jobs, setJobs] = useState<AlumniJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await queryDocuments<AlumniJob>("alumniJobs", [
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc"),
      ]);
      setJobs(data);
    } catch {
      showToast("error", "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const toggleStatus = async (job: AlumniJob) => {
    const newStatus = job.status === "open" ? "closed" : "open";
    try {
      await updateDocument("alumniJobs", job.id, { status: newStatus, updatedAt: serverTimestamp() });
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: newStatus } : j));
      showToast("success", newStatus === "open" ? "Job reopened" : "Job closed");
    } catch {
      showToast("error", "Failed to update job");
    }
  };

  const departments = Array.from(new Set(jobs.map((j) => j.department))).sort();

  const filtered = jobs.filter((j) => {
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (departmentFilter !== "all" && j.department !== departmentFilter) return false;
    return true;
  });

  const stats = {
    open: jobs.filter((j) => j.status === "open").length,
    closed: jobs.filter((j) => j.status === "closed").length,
    applications: jobs.reduce((sum, j) => sum + (j.applicationCount || 0), 0),
    referrals: jobs.reduce((sum, j) => sum + (j.referralCount || 0), 0),
  };

  const statusBadge = (status: AlumniJob["status"]) => {
    if (status === "open") return <span className="text-xs font-medium px-2 py-0.5 rounded-sm bg-green-50 text-green-700">Open</span>;
    if (status === "closed") return <span className="text-xs font-medium px-2 py-0.5 rounded-sm bg-navy/5 text-mist">Closed</span>;
    return <span className="text-xs font-medium px-2 py-0.5 rounded-sm bg-yellow-50 text-yellow-700">Draft</span>;
  };

  const audienceBadge = (job: AlumniJob) => {
    if (job.audience === "all") return <Badge variant="teal">All Alumni</Badge>;
    if (job.audience === "department") return <Badge variant="navy">By Department: {job.audienceDepartment}</Badge>;
    return <Badge variant="ember">Rehire Candidates Only</Badge>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Open Jobs", value: stats.open },
          { label: "Total Applications", value: stats.applications },
          { label: "Total Referrals", value: stats.referrals },
          { label: "Closed Jobs", value: stats.closed },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-navy/10 rounded-xl p-4">
            <p className="text-2xl font-display text-navy">{value}</p>
            <p className="text-xs text-mist mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-navy/5 rounded-md p-1">
          {(["all", "open", "closed", "draft"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                "px-3 py-1 text-sm font-medium rounded transition-colors capitalize",
                statusFilter === s ? "bg-white text-navy shadow-sm" : "text-mist hover:text-navy"
              )}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {departments.length > 0 && (
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-sm border border-navy/20 rounded-md px-3 py-1.5 text-navy bg-white focus:outline-none focus:ring-2 focus:ring-teal/50"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <Button onClick={() => setShowCreateModal(true)} className="ml-auto">
          <Briefcase size={14} className="mr-1.5" />
          Post a Job
        </Button>
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={48} strokeWidth={1.5} />}
          title="No jobs posted yet"
          description="Post your first job opening to let alumni know about opportunities."
          action={
            <Button onClick={() => setShowCreateModal(true)}>
              <Briefcase size={14} className="mr-1.5" />
              Post a Job
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => {
            const deadline = toDate(job.applicationDeadline);
            const deadlinePassed = deadline ? deadline < new Date() : false;

            return (
              <div key={job.id} className="bg-white border border-navy/10 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-navy">{job.title}</h3>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-sm bg-navy/5 text-navy">{job.department}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-sm bg-teal/10 text-teal">{JOB_TYPE_LABELS[job.type]}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-mist mb-2">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {deadline
                          ? deadlinePassed && job.status === "open"
                            ? <span className="text-ember font-medium">Deadline passed ({format(deadline, "MMM d, yyyy")})</span>
                            : format(deadline, "MMM d, yyyy")
                          : "No deadline"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-mist">
                      <span>{formatSalary(job.salaryMin, job.salaryMax)}</span>
                      <span>·</span>
                      {audienceBadge(job)}
                      <span>·</span>
                      <span>{job.applicationCount} applications · {job.referralCount} referrals</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {statusBadge(job.status)}
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                      >
                        View Applications
                        {expandedJob === job.id ? <ChevronUp size={12} className="ml-1" /> : <ChevronDown size={12} className="ml-1" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleStatus(job)}
                      >
                        {job.status === "open" ? "Close Job" : "Reopen"}
                      </Button>
                    </div>
                  </div>
                </div>

                {expandedJob === job.id && (
                  <ApplicationsPanel job={job} onClose={() => setExpandedJob(null)} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateJobModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        companyId={companyId || ""}
        createdBy={user?.uid || ""}
        onCreated={(job) => setJobs((prev) => [job, ...prev])}
      />
    </div>
  );
}
