import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { showToast } from "../ui/Toast";
import { setDocument, serverTimestamp } from "../../lib/firestore";
import type { AlumniJob, JobType, JobAudience } from "../../types/alumniJobs";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  createdBy: string;
  onCreated: (job: AlumniJob) => void;
}

const EMPTY_FORM = {
  title: "",
  department: "",
  type: "full_time" as JobType,
  location: "",
  salaryMin: "",
  salaryMax: "",
  noSalary: false,
  noDeadline: true,
  deadline: "",
  audience: "all" as JobAudience,
  audienceDepartment: "",
  description: "",
  requirements: "",
};

export function CreateJobModal({ isOpen, onClose, companyId, createdBy, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (status: "open" | "draft") => {
    if (!form.title.trim()) { showToast("Job title is required", "error"); return; }
    if (!form.department.trim()) { showToast("Department is required", "error"); return; }
    if (!form.location.trim()) { showToast("Location is required", "error"); return; }
    if (!form.description.trim()) { showToast("Job description is required", "error"); return; }

    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const deadline =
        !form.noDeadline && form.deadline
          ? new Date(form.deadline + "T00:00:00")
          : null;

      const job: AlumniJob = {
        id,
        companyId,
        title: form.title.trim(),
        department: form.department.trim(),
        type: form.type,
        location: form.location.trim(),
        salaryMin: form.noSalary ? null : (form.salaryMin ? Number(form.salaryMin) : null),
        salaryMax: form.noSalary ? null : (form.salaryMax ? Number(form.salaryMax) : null),
        salaryCurrency: "USD",
        applicationDeadline: deadline ? { toDate: () => deadline, seconds: Math.floor(deadline.getTime() / 1000), nanoseconds: 0 } as unknown as import("firebase/firestore").Timestamp : null,
        audience: form.audience,
        audienceDepartment: form.audience === "department" ? form.audienceDepartment.trim() || null : null,
        description: form.description.trim(),
        requirements: form.requirements.trim(),
        status,
        applicationCount: 0,
        referralCount: 0,
        createdBy,
        createdAt: serverTimestamp() as unknown as import("firebase/firestore").Timestamp,
        updatedAt: serverTimestamp() as unknown as import("firebase/firestore").Timestamp,
      };

      await setDocument("alumniJobs", id, {
        ...job,
        applicationDeadline: deadline ? deadline : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showToast(status === "open" ? "Job posted!" : "Draft saved", "success");
      onCreated(job);
      setForm(EMPTY_FORM);
      onClose();
    } catch {
      showToast("Failed to save job", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Post a Job"
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleSubmit("draft")} loading={saving}>
              Save as Draft
            </Button>
            <Button onClick={() => handleSubmit("open")} loading={saving}>
              Post Job
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Job Title *"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Senior Software Engineer"
          />
          <Input
            label="Department *"
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
            placeholder="e.g. Engineering"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Job Type</label>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as JobType)}
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-teal/50"
            >
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </div>
          <Input
            label="Location *"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="e.g. Remote, New York NY, Hybrid – London"
          />
        </div>

        {/* Salary */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Salary Range (USD / year)</label>
          {!form.noSalary && (
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                placeholder="Min"
                value={form.salaryMin}
                onChange={(e) => set("salaryMin", e.target.value)}
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50"
              />
              <span className="text-mist text-sm">–</span>
              <input
                type="number"
                placeholder="Max"
                value={form.salaryMax}
                onChange={(e) => set("salaryMax", e.target.value)}
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-mist cursor-pointer">
            <input
              type="checkbox"
              checked={form.noSalary}
              onChange={(e) => set("noSalary", e.target.checked)}
              className="accent-teal"
            />
            Don't disclose salary
          </label>
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Application Deadline</label>
          {!form.noDeadline && (
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 mb-2"
            />
          )}
          <label className="flex items-center gap-2 text-sm text-mist cursor-pointer">
            <input
              type="checkbox"
              checked={form.noDeadline}
              onChange={(e) => set("noDeadline", e.target.checked)}
              className="accent-teal"
            />
            No deadline
          </label>
        </div>

        {/* Audience */}
        <div>
          <label className="block text-sm font-medium text-navy mb-2">Who can see this job?</label>
          <div className="space-y-2">
            {(["all", "department", "rehire_only"] as JobAudience[]).map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm text-navy cursor-pointer">
                <input
                  type="radio"
                  name="audience"
                  value={a}
                  checked={form.audience === a}
                  onChange={() => set("audience", a)}
                  className="accent-teal"
                />
                {a === "all" && "All Alumni"}
                {a === "department" && "Specific Department Alumni"}
                {a === "rehire_only" && "Rehire Candidates Only"}
              </label>
            ))}
          </div>
          {form.audience === "department" && (
            <div className="mt-2">
              <Input
                placeholder="Department name"
                value={form.audienceDepartment}
                onChange={(e) => set("audienceDepartment", e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Job Description *</label>
          <textarea
            rows={6}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Describe the role, responsibilities, and what makes it exciting..."
            className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
          />
        </div>

        {/* Requirements */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Requirements</label>
          <textarea
            rows={4}
            value={form.requirements}
            onChange={(e) => set("requirements", e.target.value)}
            placeholder="List the key qualifications, skills, and experience required..."
            className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
