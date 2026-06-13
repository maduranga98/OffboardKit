import { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { showToast } from "../ui/Toast";
import {
  setDocument,
  updateDocument,
  queryDocuments,
  serverTimestamp,
  where,
} from "../../lib/firestore";
import type { AlumniJob, AlumniApplication } from "../../types/alumniJobs";
import type { AlumniProfile } from "../../types/alumni.types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  job: AlumniJob;
  alumniProfile: AlumniProfile;
}

export function ApplyModal({ isOpen, onClose, job, alumniProfile }: Props) {
  const [linkedInUrl, setLinkedInUrl] = useState(alumniProfile.linkedIn || "");
  const [coverNote, setCoverNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setSuccess(false);
      setCoverNote("");
      setLinkedInUrl(alumniProfile.linkedIn || "");
      return;
    }
    setChecking(true);
    queryDocuments<AlumniApplication>("alumniApplications", [
      where("jobId", "==", job.id),
      where("alumniId", "==", alumniProfile.id),
      where("type", "==", "self"),
    ])
      .then((existing) => setAlreadyApplied(existing.length > 0))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [isOpen, job.id, alumniProfile.id, alumniProfile.linkedIn]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      await setDocument<AlumniApplication>("alumniApplications", id, {
        id,
        companyId: alumniProfile.companyId,
        jobId: job.id,
        jobTitle: job.title,
        type: "self",
        alumniId: alumniProfile.id,
        alumniName: alumniProfile.name,
        alumniEmail: alumniProfile.email,
        coverNote,
        linkedInUrl,
        status: "new",
        hrNotes: "",
        createdAt: serverTimestamp() as unknown as import("firebase/firestore").Timestamp,
        updatedAt: serverTimestamp() as unknown as import("firebase/firestore").Timestamp,
      });

      await updateDocument("alumniJobs", job.id, {
        applicationCount: (job.applicationCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch {
      showToast("error", "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Apply — ${job.title}`} size="md">
      {checking ? (
        <div className="py-8 text-center text-sm text-mist">Checking...</div>
      ) : success ? (
        <div className="py-10 flex flex-col items-center text-center gap-3">
          <CheckCircle size={48} className="text-green-500" />
          <p className="font-semibold text-navy">Application sent!</p>
          <p className="text-sm text-mist">The HR team will be in touch.</p>
        </div>
      ) : alreadyApplied ? (
        <div className="py-10 text-center">
          <p className="font-semibold text-navy mb-1">Already applied</p>
          <p className="text-sm text-mist">You've already applied to this role.</p>
          <Button className="mt-4" variant="outline" onClick={onClose}>Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-mist mb-1">Name</label>
              <p className="text-sm text-navy">{alumniProfile.name}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-mist mb-1">Email</label>
              <p className="text-sm text-navy">{alumniProfile.email}</p>
            </div>
          </div>
          <Input
            label="LinkedIn URL (optional)"
            value={linkedInUrl}
            onChange={(e) => setLinkedInUrl(e.target.value)}
            placeholder="https://linkedin.com/in/yourname"
          />
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Cover Note (optional but encouraged)</label>
            <textarea
              rows={4}
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              placeholder="Tell us why you're interested and what you've been up to since leaving..."
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
            />
          </div>
          <Button fullWidth onClick={handleSubmit} loading={submitting}>
            Submit Application
          </Button>
        </div>
      )}
    </Modal>
  );
}
