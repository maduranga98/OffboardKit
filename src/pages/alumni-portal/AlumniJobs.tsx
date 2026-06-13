import { useState, useEffect, useCallback } from "react";
import { Briefcase } from "lucide-react";
import clsx from "clsx";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { AlumniJobCard } from "../../components/alumni-portal/AlumniJobCard";
import { showToast } from "../../components/ui/Toast";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import {
  queryDocuments,
  updateDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type { AlumniJob } from "../../types/alumniJobs";

type FeedFilter = "all" | "my_department";

export default function AlumniJobs() {
  const { alumniProfile } = useAlumniAuth();
  const [jobs, setJobs] = useState<AlumniJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [hiddenIds, setHiddenIds] = useState<string[]>(alumniProfile?.hiddenJobIds ?? []);

  const loadJobs = useCallback(async () => {
    if (!alumniProfile) return;
    setLoading(true);
    try {
      const all = await queryDocuments<AlumniJob>("alumniJobs", [
        where("companyId", "==", alumniProfile.companyId),
        where("status", "==", "open"),
        orderBy("createdAt", "desc"),
      ]);

      // Filter by audience
      const visible = all.filter((job) => {
        if (job.audience === "all") return true;
        if (job.audience === "department") {
          return job.audienceDepartment === alumniProfile.department;
        }
        if (job.audience === "rehire_only") {
          return (
            alumniProfile.status === "rehire_candidate" ||
            alumniProfile.rehirePriority === "high" ||
            alumniProfile.rehirePriority === "medium"
          );
        }
        return false;
      });

      setJobs(visible);
    } catch {
      showToast("Failed to load jobs", "error");
    } finally {
      setLoading(false);
    }
  }, [alumniProfile]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleHide = async (jobId: string) => {
    if (!alumniProfile) return;
    // Optimistic
    setHiddenIds((prev) => [...prev, jobId]);
    try {
      const updated = [...(hiddenIds), jobId];
      await updateDocument("alumniProfiles", alumniProfile.id, {
        hiddenJobIds: updated,
        updatedAt: serverTimestamp(),
      });
    } catch {
      showToast("Failed to hide job", "error");
      setHiddenIds((prev) => prev.filter((id) => id !== jobId));
    }
  };

  if (!alumniProfile) return null;
  if (loading) return <LoadingSpinner />;

  const visible = jobs
    .filter((j) => !hiddenIds.includes(j.id))
    .filter((j) => {
      if (filter === "my_department") return j.department === alumniProfile.department;
      return true;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-navy">Open Positions</h1>
        <p className="text-sm text-mist mt-1">Opportunities waiting for you</p>
      </div>

      <div className="flex gap-1 bg-navy/5 rounded-md p-1 w-fit">
        <button
          onClick={() => setFilter("all")}
          className={clsx(
            "px-4 py-1.5 text-sm font-medium rounded transition-colors",
            filter === "all" ? "bg-white text-navy shadow-sm" : "text-mist hover:text-navy"
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter("my_department")}
          className={clsx(
            "px-4 py-1.5 text-sm font-medium rounded transition-colors",
            filter === "my_department" ? "bg-white text-navy shadow-sm" : "text-mist hover:text-navy"
          )}
        >
          My Department
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={48} strokeWidth={1.5} />}
          title="No open positions right now"
          description="Check back soon — new opportunities are posted regularly."
        />
      ) : (
        <div className="space-y-4">
          {visible.map((job) => (
            <AlumniJobCard
              key={job.id}
              job={job}
              alumniProfile={alumniProfile}
              onHide={handleHide}
            />
          ))}
        </div>
      )}
    </div>
  );
}
