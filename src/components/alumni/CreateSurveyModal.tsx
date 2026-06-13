import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { addMonths, addQuarters } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { showToast } from "../ui/Toast";
import {
  queryDocuments,
  setDocument,
  updateDocument,
  serverTimestamp,
  where,
} from "../../lib/firestore";
import {
  DEFAULT_SURVEY_QUESTIONS,
  type PulseSurvey,
  type PulseSurveyQuestion,
  type QuestionType,
} from "../../types/pulseSurveys.types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  createdBy: string;
  editingSurvey?: PulseSurvey | null;
  onSaved: (survey: PulseSurvey) => void;
}

type Schedule = PulseSurvey["schedule"];

const SCHEDULE_OPTIONS: { value: Schedule; label: string; desc: string }[] = [
  { value: "manual", label: "Manual only", desc: "I'll send when I want" },
  { value: "monthly", label: "Monthly", desc: "Every month" },
  { value: "quarterly", label: "Quarterly (every 3 months)", desc: "Default" },
  { value: "biannual", label: "Bi-annual", desc: "Every 6 months" },
];

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "scale_1_5", label: "Scale 1–5" },
  { value: "yes_no", label: "Yes or No" },
  { value: "yes_maybe_no", label: "Yes, Maybe, or No" },
];

function computeNextSendAt(schedule: Schedule): Timestamp | null {
  const now = new Date();
  if (schedule === "manual") return null;
  if (schedule === "monthly") return Timestamp.fromDate(addMonths(now, 1));
  if (schedule === "quarterly") return Timestamp.fromDate(addQuarters(now, 1));
  if (schedule === "biannual") return Timestamp.fromDate(addMonths(now, 6));
  return null;
}

interface QuestionSlot {
  active: boolean;
  text: string;
  type: QuestionType;
}

export function CreateSurveyModal({
  isOpen,
  onClose,
  companyId,
  createdBy,
  editingSurvey,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<Schedule>("quarterly");
  const [slots, setSlots] = useState<QuestionSlot[]>([
    { active: true, text: DEFAULT_SURVEY_QUESTIONS[0].text, type: DEFAULT_SURVEY_QUESTIONS[0].type },
    { active: true, text: DEFAULT_SURVEY_QUESTIONS[1].text, type: DEFAULT_SURVEY_QUESTIONS[1].type },
    { active: true, text: DEFAULT_SURVEY_QUESTIONS[2].text, type: DEFAULT_SURVEY_QUESTIONS[2].type },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingSurvey) {
      setName(editingSurvey.name);
      setSchedule(editingSurvey.schedule);
      const filled: QuestionSlot[] = editingSurvey.questions
        .sort((a, b) => a.order - b.order)
        .map((q) => ({ active: true, text: q.text, type: q.type }));
      while (filled.length < 3) {
        const def = DEFAULT_SURVEY_QUESTIONS[filled.length];
        filled.push({ active: false, text: def.text, type: def.type });
      }
      setSlots(filled);
    } else {
      setName("");
      setSchedule("quarterly");
      setSlots([
        { active: true, text: DEFAULT_SURVEY_QUESTIONS[0].text, type: DEFAULT_SURVEY_QUESTIONS[0].type },
        { active: true, text: DEFAULT_SURVEY_QUESTIONS[1].text, type: DEFAULT_SURVEY_QUESTIONS[1].type },
        { active: true, text: DEFAULT_SURVEY_QUESTIONS[2].text, type: DEFAULT_SURVEY_QUESTIONS[2].type },
      ]);
    }
  }, [isOpen, editingSurvey]);

  const activeCount = slots.filter((s) => s.active).length;

  function updateSlot(i: number, patch: Partial<QuestionSlot>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSlot(i: number) {
    if (activeCount <= 1) return;
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, active: false } : s)));
  }

  function addQuestion() {
    const firstInactive = slots.findIndex((s) => !s.active);
    if (firstInactive === -1) return;
    setSlots((prev) =>
      prev.map((s, idx) => (idx === firstInactive ? { ...s, active: true } : s))
    );
  }

  async function handleSave(activate: boolean) {
    if (!name.trim()) return;
    const activeSlots = slots.filter((s) => s.active);
    if (activeSlots.length === 0) return;

    setSaving(true);
    try {
      const surveyId = editingSurvey?.id || crypto.randomUUID();
      const questions: PulseSurveyQuestion[] = activeSlots.map((s, i) => ({
        id: crypto.randomUUID(),
        text: s.text,
        type: s.type,
        order: i + 1,
      }));

      if (activate) {
        // Deactivate any other active surveys for this company
        const existing = await queryDocuments<PulseSurvey>("pulseSurveys", [
          where("companyId", "==", companyId),
          where("isActive", "==", true),
        ]);
        for (const s of existing) {
          if (s.id !== surveyId) {
            await updateDocument("pulseSurveys", s.id, { isActive: false, updatedAt: serverTimestamp() });
          }
        }
      }

      const nextSendAt = activate ? computeNextSendAt(schedule) : null;
      const now = serverTimestamp();

      const surveyData: Omit<PulseSurvey, "createdAt" | "updatedAt" | "lastSentAt" | "nextSendAt"> & {
        createdAt: ReturnType<typeof serverTimestamp>;
        updatedAt: ReturnType<typeof serverTimestamp>;
        lastSentAt: Timestamp | null;
        nextSendAt: Timestamp | null;
      } = {
        id: surveyId,
        companyId,
        name: name.trim(),
        isActive: activate,
        questions,
        schedule,
        lastSentAt: editingSurvey?.lastSentAt ?? null,
        nextSendAt,
        totalSent: editingSurvey?.totalSent ?? 0,
        totalResponded: editingSurvey?.totalResponded ?? 0,
        createdBy: editingSurvey?.createdBy ?? createdBy,
        createdAt: editingSurvey ? (editingSurvey.createdAt as unknown as ReturnType<typeof serverTimestamp>) : now,
        updatedAt: now,
      };

      await setDocument("pulseSurveys", surveyId, surveyData as Parameters<typeof setDocument>[2]);

      showToast("success", activate ? "Survey activated" : "Survey saved", name.trim());
      onSaved(surveyData as unknown as PulseSurvey);
      onClose();
    } catch {
      showToast("error", "Error saving survey", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = name.trim().length > 0 && activeCount >= 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSurvey ? "Edit Survey" : "Set Up Pulse Survey"}
      size="lg"
      footer={
        <div className="flex items-center justify-between pt-4 border-t border-navy/5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => handleSave(false)}
              loading={saving}
              disabled={!canSave}
            >
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              loading={saving}
              disabled={!canSave}
            >
              Save &amp; Activate
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Survey name */}
        <Input
          label="Survey Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Q2 2026 Alumni Pulse"
        />

        {/* Schedule */}
        <div>
          <label className="block text-sm font-medium text-navy mb-2">Schedule</label>
          <div className="space-y-2">
            {SCHEDULE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="schedule"
                  value={opt.value}
                  checked={schedule === opt.value}
                  onChange={() => setSchedule(opt.value)}
                  className="h-4 w-4 text-teal border-navy/20 focus:ring-teal/50"
                />
                <span className="text-sm text-navy">
                  {opt.label}
                  {opt.value === "quarterly" && (
                    <span className="ml-1 text-xs text-mist">(Recommended)</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div>
          <label className="block text-sm font-medium text-navy mb-2">
            Questions <span className="text-xs text-mist font-normal">(1–3)</span>
          </label>
          <div className="space-y-3">
            {slots.map((slot, i) =>
              slot.active ? (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={slot.text}
                      onChange={(e) => updateSlot(i, { text: e.target.value })}
                      placeholder={`Question ${i + 1}`}
                      className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                    />
                    <select
                      value={slot.type}
                      onChange={(e) => updateSlot(i, { type: e.target.value as QuestionType })}
                      className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  {activeCount > 1 && (
                    <button
                      onClick={() => removeSlot(i)}
                      className="mt-2 text-mist hover:text-ember transition-colors"
                      title="Remove question"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ) : null
            )}
          </div>
          {activeCount < 3 && (
            <button
              onClick={addQuestion}
              className="mt-2 flex items-center gap-1 text-sm text-teal hover:text-teal/80 transition-colors"
            >
              <Plus size={14} />
              Add Question
            </button>
          )}
          <p className="mt-2 text-xs text-mist italic">
            [Company] will be auto-replaced with your company name in question text.
          </p>
        </div>
      </div>
    </Modal>
  );
}
