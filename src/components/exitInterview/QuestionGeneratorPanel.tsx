import { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "../ui/Button";
import { AutoTextarea } from "../ui/AutoTextarea";
import { useGenerateExitQuestions } from "../../hooks/useGenerateExitQuestions";
import {
  CATEGORY_LABELS,
  SENIORITY_OPTIONS,
  type GeneratedQuestion,
  type Seniority,
} from "../../types/exitInterview.types";

const FIELD_CLASS =
  "w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm text-navy " +
  "placeholder:text-mist focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal";

interface QuestionGeneratorPanelProps {
  /** Receives the checked questions, renumbered from the panel's order. */
  onQuestionsSelected: (questions: GeneratedQuestion[]) => void;
  /** Starts open when the template has no questions yet. */
  defaultOpen?: boolean;
}

export function QuestionGeneratorPanel({
  onQuestionsSelected,
  defaultOpen = false,
}: QuestionGeneratorPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [seniority, setSeniority] = useState<Seniority>("mid");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fromCache, setFromCache] = useState(false);
  const [added, setAdded] = useState(false);
  const { generate, loading, error } = useGenerateExitQuestions();

  const canGenerate = role.trim().length > 0 && department.trim().length > 0;

  const handleGenerate = async () => {
    if (!canGenerate || loading) return;
    setAdded(false);
    const result = await generate({
      role: role.trim(),
      department: department.trim(),
      seniority,
    });
    if (!result) return;
    setQuestions(result.questions);
    setSelected(new Set(result.questions.map((q) => q.id)));
    setFromCache(result.fromCache);
  };

  const toggleQuestion = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateQuestionText = (id: string, text: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, text } : q)));
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= questions.length) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next.map((q, i) => ({ ...q, order: i }));
    });
  };

  const handleAddSelected = () => {
    const chosen = questions
      .filter((q) => selected.has(q.id) && q.text.trim())
      .map((q, i) => ({ ...q, text: q.text.trim(), order: i }));
    if (chosen.length === 0) return;
    onQuestionsSelected(chosen);
    setAdded(true);
  };

  const selectedCount = questions.filter(
    (q) => selected.has(q.id) && q.text.trim()
  ).length;

  return (
    <div className="rounded-lg border border-navy/10 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-navy/[0.02] transition-colors"
      >
        <span className="p-1.5 rounded-md bg-teal/10 text-teal">
          <Sparkles size={16} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-navy">
            Generate questions with AI
          </span>
          <span className="block text-xs text-mist">
            Tailored to a role, department, and seniority
          </span>
        </span>
        {open ? (
          <ChevronUp size={16} className="text-mist shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-mist shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-navy/10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <input
              type="text"
              aria-label="Job title"
              placeholder="Job title (e.g. Sales Manager)"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={FIELD_CLASS}
            />
            <input
              type="text"
              aria-label="Department"
              placeholder="Department (e.g. Sales)"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={FIELD_CLASS}
            />
            <select
              aria-label="Seniority"
              value={seniority}
              onChange={(e) => setSeniority(e.target.value as Seniority)}
              className={FIELD_CLASS}
            >
              {SENIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              loading={loading}
              disabled={!canGenerate}
            >
              {questions.length > 0 ? "Regenerate" : "Generate questions"}
            </Button>
            {questions.length > 0 && !loading && (
              <span className="text-xs text-mist">
                {questions.length} question{questions.length === 1 ? "" : "s"}
                {fromCache ? " · reused from a previous generation" : ""}
              </span>
            )}
          </div>

          {error && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-ember">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {questions.length > 0 && (
            <>
              <ul className="mt-4 space-y-2">
                {questions.map((q, index) => (
                  <li
                    key={q.id}
                    className="flex items-start gap-3 rounded-md border border-navy/10 bg-warm/20 p-3"
                  >
                    <input
                      type="checkbox"
                      aria-label={`Include: ${q.text}`}
                      checked={selected.has(q.id)}
                      onChange={() => toggleQuestion(q.id)}
                      className="mt-1 h-4 w-4 rounded border-navy/30 text-teal focus:ring-teal"
                    />
                    <div className="flex-1 min-w-0">
                      <AutoTextarea
                        aria-label={`Question ${index + 1}`}
                        value={q.text}
                        onChange={(e) => updateQuestionText(q.id, e.target.value)}
                        className="block w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm leading-snug text-navy focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal"
                      />
                      <span className="mt-1.5 inline-block rounded-full bg-navy/5 px-2 py-0.5 text-xs text-mist">
                        {CATEGORY_LABELS[q.category] ?? q.category}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        aria-label="Move up"
                        onClick={() => moveQuestion(index, "up")}
                        disabled={index === 0}
                        className="p-1 text-mist hover:text-navy disabled:opacity-30 disabled:hover:text-mist transition-colors"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        onClick={() => moveQuestion(index, "down")}
                        disabled={index === questions.length - 1}
                        className="p-1 text-mist hover:text-navy disabled:opacity-30 disabled:hover:text-mist transition-colors"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleAddSelected}
                  disabled={selectedCount === 0}
                >
                  Add {selectedCount} question{selectedCount === 1 ? "" : "s"} to template
                </Button>
                {added && (
                  <span className="flex items-center gap-1 text-xs text-teal">
                    <Check size={13} /> Added
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
