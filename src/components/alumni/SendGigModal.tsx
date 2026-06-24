import { useState } from "react";
import { X, Lock } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { setDocument, serverTimestamp } from "../../lib/firestore";
import type { GigRequest, EngagementType } from "../../types/gigRequests.types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  alumniId: string;
  alumniName: string;
  alumniEmail: string;
  alumniSkills?: string[];
  createdBy: string;
  createdByName: string;
  onSent: (gig: GigRequest) => void;
}

export function SendGigModal({
  isOpen,
  onClose,
  companyId,
  alumniId,
  alumniName,
  alumniEmail,
  alumniSkills = [],
  createdBy,
  createdByName,
  onSent,
}: Props) {
  const [title, setTitle] = useState("");
  const [engagementType, setEngagementType] = useState<EngagementType>("one_time");
  const [scope, setScope] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [timelineWeeks, setTimelineWeeks] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [specifyBudget, setSpecifyBudget] = useState(true);
  const [hrNotes, setHrNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleAddSkill(raw: string) {
    const skill = raw.trim().replace(/,+$/, "").trim();
    if (skill && !skills.includes(skill)) {
      setSkills((prev) => [...prev, skill]);
    }
    setSkillInput("");
  }

  function handleSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddSkill(skillInput);
    }
  }

  function handleRemoveSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill));
  }

  function handleClose() {
    setTitle("");
    setEngagementType("one_time");
    setScope("");
    setSkills([]);
    setSkillInput("");
    setTimelineWeeks("");
    setBudgetMin("");
    setBudgetMax("");
    setSpecifyBudget(true);
    setHrNotes("");
    setError("");
    onClose();
  }

  async function handleSubmit() {
    if (!title.trim() || !scope.trim()) {
      setError("Title and scope are required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const gig: GigRequest = {
        id,
        companyId,
        alumniId,
        alumniName,
        alumniEmail,
        title: title.trim(),
        scope: scope.trim(),
        requiredSkills: skills,
        timelineWeeks: timelineWeeks ? Number(timelineWeeks) : null,
        budgetMin: specifyBudget && budgetMin ? Number(budgetMin) : null,
        budgetMax: specifyBudget && budgetMax ? Number(budgetMax) : null,
        engagementType,
        status: "sent",
        alumniNote: null,
        hrNotes: hrNotes.trim(),
        respondedAt: null,
        completedAt: null,
        createdBy,
        createdByName,
        createdAt: serverTimestamp() as unknown as import("firebase/firestore").Timestamp,
        updatedAt: serverTimestamp() as unknown as import("firebase/firestore").Timestamp,
      };
      await setDocument("gigRequests", id, gig);
      onSent(gig);
      handleClose();
    } catch {
      setError("Failed to send request. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Send Gig Request to ${alumniName}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between pt-3 border-t border-navy/5">
          {error && <p className="text-xs text-ember">{error}</p>}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} loading={saving} disabled={!title.trim() || !scope.trim()}>
              Send Request
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <Input
          label="Project / Gig Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Build Q3 dashboard prototype"
        />

        {/* Engagement Type */}
        <div>
          <label className="block text-xs font-medium text-navy mb-1.5">Engagement Type</label>
          <div className="flex gap-2 flex-wrap">
            {(["one_time", "ongoing", "advisory"] as const).map((type) => {
              const labels = { one_time: "One-time", ongoing: "Ongoing", advisory: "Advisory" };
              return (
                <label
                  key={type}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${
                    engagementType === type
                      ? "border-teal bg-teal/5 text-teal font-medium"
                      : "border-navy/10 text-navy hover:border-teal/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="engagementType"
                    value={type}
                    checked={engagementType === type}
                    onChange={() => setEngagementType(type)}
                    className="sr-only"
                  />
                  {labels[type]}
                </label>
              );
            })}
          </div>
        </div>

        {/* Scope */}
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Scope / Description</label>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={3}
            placeholder="What needs to be done? What's the deliverable?"
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
          />
        </div>

        {/* Skills */}
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Required Skills</label>
          {alumniSkills.length > 0 && skills.length === 0 && (
            <p className="text-xs text-mist mb-1">
              Alumni skills: {alumniSkills.join(", ")} —{" "}
              <button type="button" onClick={() => setSkills([...alumniSkills])} className="text-teal hover:underline">
                use these
              </button>
            </p>
          )}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {skills.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy/5 text-navy text-xs rounded-full">
                  {skill}
                  <button type="button" onClick={() => handleRemoveSkill(skill)} className="hover:text-ember transition-colors">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              onBlur={() => { if (skillInput.trim()) handleAddSkill(skillInput); }}
              placeholder="Type skill + Enter or comma to add..."
              className="flex-1 px-3 py-1.5 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
            <Button size="sm" variant="outline" type="button" onClick={() => handleAddSkill(skillInput)}>
              Add
            </Button>
          </div>
        </div>

        {/* Timeline + Budget in one row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-navy mb-1">Timeline (weeks)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                value={timelineWeeks}
                onChange={(e) => setTimelineWeeks(e.target.value)}
                placeholder="e.g. 4"
                className="w-full px-3 py-1.5 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-navy">Budget (USD)</label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!specifyBudget}
                  onChange={(e) => setSpecifyBudget(!e.target.checked)}
                  className="h-3 w-3 rounded border-navy/20 text-teal focus:ring-teal/50"
                />
                <span className="text-xs text-mist">Skip</span>
              </label>
            </div>
            {specifyBudget ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="Min"
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
                <span className="text-mist text-xs flex-shrink-0">–</span>
                <input
                  type="number"
                  min={0}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="Max"
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
              </div>
            ) : (
              <div className="py-1.5 px-3 text-xs text-mist bg-navy/5 rounded-lg">Not specified</div>
            )}
          </div>
        </div>

        {/* Internal notes */}
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-navy mb-1">
            <Lock size={11} className="text-mist" />
            Internal notes (hidden from alumni)
          </label>
          <textarea
            value={hrNotes}
            onChange={(e) => setHrNotes(e.target.value)}
            rows={2}
            placeholder="Notes for HR only..."
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
