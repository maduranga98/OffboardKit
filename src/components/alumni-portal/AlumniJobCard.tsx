import { useState } from "react";
import { MapPin, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { ApplyModal } from "./ApplyModal";
import { ReferModal } from "./ReferModal";
import type { AlumniJob } from "../../types/alumniJobs";
import { JOB_TYPE_LABELS } from "../../types/alumniJobs";
import type { AlumniProfile } from "../../types/alumni.types";
import type { Timestamp } from "firebase/firestore";

interface Props {
  job: AlumniJob;
  alumniProfile: AlumniProfile;
  onHide: (jobId: string) => void;
}

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return "Salary not disclosed";
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${fmt(min)} – ${fmt(max)} / year`;
  if (min) return `From ${fmt(min)} / year`;
  return `Up to ${fmt(max!)} / year`;
}

export function AlumniJobCard({ job, alumniProfile, onHide }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showRefer, setShowRefer] = useState(false);

  const deadline = toDate(job.applicationDeadline);

  return (
    <>
      <div className="bg-white border border-navy/10 rounded-xl p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-navy">{job.title}</h3>
            <Badge variant="navy">{job.department}</Badge>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-mist mb-2">
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {job.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {deadline ? format(deadline, "MMM d, yyyy") : "No deadline"}
          </span>
          <span className="bg-teal/10 text-teal px-2 py-0.5 rounded-sm font-medium">
            {JOB_TYPE_LABELS[job.type]}
          </span>
        </div>

        <p className="text-xs text-mist mb-3">{formatSalary(job.salaryMin, job.salaryMax)}</p>

        {/* Description */}
        <div className="mb-4">
          <p
            className={`text-sm text-navy whitespace-pre-line ${expanded ? "" : "line-clamp-3"}`}
          >
            {job.description}
          </p>
          {job.description.length > 200 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-xs text-teal hover:underline flex items-center gap-0.5"
            >
              {expanded ? <><ChevronUp size={12} /> Read less</> : <><ChevronDown size={12} /> Read more</>}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowApply(true)}>Apply</Button>
          <Button size="sm" variant="outline" onClick={() => setShowRefer(true)}>Refer Someone</Button>
          <Button size="sm" variant="ghost" onClick={() => onHide(job.id)}>Not Interested</Button>
        </div>
      </div>

      <ApplyModal
        isOpen={showApply}
        onClose={() => setShowApply(false)}
        job={job}
        alumniProfile={alumniProfile}
      />
      <ReferModal
        isOpen={showRefer}
        onClose={() => setShowRefer(false)}
        job={job}
        alumniProfile={alumniProfile}
      />
    </>
  );
}
