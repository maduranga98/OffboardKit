import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { showToast } from "../ui/Toast";
import { setDocument, updateDocument, serverTimestamp } from "../../lib/firestore";
import type { AlumniJob, AlumniApplication } from "../../types/alumniJobs";
import type { AlumniProfile } from "../../types/alumni.types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  job: AlumniJob;
  alumniProfile: AlumniProfile;
}

const RELATIONSHIPS = ["Former Colleague", "Friend", "Classmate", "Other"];

export function ReferModal({ isOpen, onClose, job, alumniProfile }: Props) {
  const [refereeName, setRefereeName] = useState("");
  const [refereeEmail, setRefereeEmail] = useState("");
  const [relationship, setRelationship] = useState("Former Colleague");
  const [referralNote, setReferralNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedName, setSavedName] = useState("");

  const reset = () => {
    setRefereeName("");
    setRefereeEmail("");
    setRelationship("Former Colleague");
    setReferralNote("");
    setSuccess(false);
    setSavedName("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!refereeName.trim()) { showToast("error", "Referee's name is required"); return; }
    if (!refereeEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refereeEmail)) {
      showToast("error", "A valid email is required");
      return;
    }

    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      await setDocument<AlumniApplication>("alumniApplications", id, {
        id,
        companyId: alumniProfile.companyId,
        jobId: job.id,
        jobTitle: job.title,
        type: "referral",
        referrerAlumniId: alumniProfile.id,
        referrerAlumniName: alumniProfile.name,
        referrerAlumniEmail: alumniProfile.email,
        refereeName: refereeName.trim(),
        refereeEmail: refereeEmail.trim(),
        refereeRelationship: relationship,
        referralNote: referralNote.trim(),
        status: "new",
        hrNotes: "",
        createdAt: serverTimestamp() as unknown as import("firebase/firestore").Timestamp,
        updatedAt: serverTimestamp() as unknown as import("firebase/firestore").Timestamp,
      });

      await updateDocument("alumniJobs", job.id, {
        referralCount: (job.referralCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });

      setSavedName(refereeName.trim());
      setSuccess(true);
    } catch {
      showToast("error", "Failed to submit referral");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Refer Someone — ${job.title}`} size="md">
      {success ? (
        <div className="py-10 flex flex-col items-center text-center gap-3">
          <CheckCircle size={48} className="text-green-500" />
          <p className="font-semibold text-navy">Referral submitted!</p>
          <p className="text-sm text-mist">We'll reach out to {savedName}.</p>
          <Button variant="outline" onClick={handleClose} className="mt-2">Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="Referee's Full Name *"
            value={refereeName}
            onChange={(e) => setRefereeName(e.target.value)}
            placeholder="Jane Smith"
          />
          <Input
            label="Referee's Email *"
            type="email"
            value={refereeEmail}
            onChange={(e) => setRefereeEmail(e.target.value)}
            placeholder="jane@example.com"
          />
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Relationship</label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-teal/50"
            >
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Referral Note (optional)</label>
            <textarea
              rows={3}
              value={referralNote}
              onChange={(e) => setReferralNote(e.target.value)}
              placeholder="Why would they be a great fit?"
              className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
            />
          </div>
          <Button fullWidth onClick={handleSubmit} loading={submitting}>
            Send Referral
          </Button>
        </div>
      )}
    </Modal>
  );
}
