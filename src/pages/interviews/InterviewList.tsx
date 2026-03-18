import { useState, useEffect } from "react";
import {
  Plus,
  MessageSquare,
  Search,
  Eye,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  X,
  Star,
  XCircle,
  Lightbulb,
} from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import { where, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/shared/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  setDocument,
  updateDocument,
  deleteDocument,
  serverTimestamp,
} from "../../lib/firestore";
import type {
  ExitInterviewTemplate,
  ExitInterviewResponse,
  InterviewQuestion,
  QuestionType,
  Sentiment,
} from "../../types/interview.types";

type TabView = "templates" | "responses";

const questionBank: Omit<InterviewQuestion, "id" | "order">[] = [
  {
    text: "What was your primary reason for leaving?",
    type: "multiple_choice",
    options: [
      "Better opportunity",
      "Compensation",
      "Work-life balance",
      "Management",
      "Career growth",
      "Relocation",
      "Personal reasons",
      "Other",
    ],
    required: true,
  },
  {
    text: "How would you rate your overall experience at the company?",
    type: "rating",
    required: true,
  },
  {
    text: "How would you rate your relationship with your manager?",
    type: "rating",
    required: true,
  },
  {
    text: "Would you recommend this company as a place to work?",
    type: "yes_no",
    required: true,
  },
  {
    text: "What did we do well?",
    type: "text",
    required: false,
  },
  {
    text: "What could we have done better?",
    type: "text",
    required: false,
  },
  {
    text: "Would you consider returning to this company in the future?",
    type: "yes_no",
    required: false,
  },
];

const questionTypeLabels: Record<QuestionType, string> = {
  text: "Text Response",
  rating: "Star Rating",
  multiple_choice: "Multiple Choice",
  yes_no: "Yes or No",
};

function sentimentBadge(sentiment: Sentiment) {
  const map: Record<Sentiment, { label: string; variant: "teal" | "mist" | "ember" }> = {
    positive: { label: "Positive", variant: "teal" },
    neutral: { label: "Neutral", variant: "mist" },
    negative: { label: "Negative", variant: "ember" },
  };
  const s = map[sentiment];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

// ── Response Detail Modal ────────────────────────────────────────────

function RatingDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={18}
          className={star <= value ? "text-teal fill-teal" : "text-navy/20"}
        />
      ))}
      <span className="text-sm font-medium text-navy ml-2">{value}/5</span>
    </div>
  );
}

function YesNoDisplay({ value }: { value: string }) {
  const isYes = value.toLowerCase() === "yes";
  return (
    <div className="flex items-center gap-2">
      {isYes ? (
        <CheckCircle size={18} className="text-teal" />
      ) : (
        <XCircle size={18} className="text-ember" />
      )}
      <span className="text-sm font-medium text-navy">
        {isYes ? "Yes" : "No"}
      </span>
    </div>
  );
}

function ResponseDetailModal({
  response,
  onClose,
}: {
  response: ExitInterviewResponse;
  onClose: () => void;
}) {
  return (
    <Modal isOpen onClose={onClose} title="Interview Response" size="xl">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto">
        {/* Employee info */}
        <div className="flex items-center gap-3 pb-4 border-b border-navy/5">
          <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center text-teal font-medium text-sm flex-shrink-0">
            {response.employeeName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-navy">
              {response.employeeName}
            </p>
            <p className="text-xs text-mist">
              {response.employeeRole} · {response.employeeDepartment}
            </p>
          </div>
          <div className="text-right flex items-center gap-2">
            {sentimentBadge(response.sentiment)}
            <p className="text-xs text-mist">
              {response.submittedAt?.toDate
                ? format(response.submittedAt.toDate(), "MMM d, yyyy")
                : ""}
            </p>
          </div>
        </div>

        {/* Answers */}
        {response.answers.map((answer, index) => (
          <div key={answer.questionId} className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-mist bg-navy/5 rounded px-1.5 py-0.5 flex-shrink-0">
                Q{index + 1}
              </span>
              <p className="text-sm font-medium text-navy">
                {answer.questionText}
              </p>
            </div>
            <div className="pl-7">
              {answer.type === "rating" ? (
                <RatingDisplay value={Number(answer.value)} />
              ) : answer.type === "yes_no" ? (
                <YesNoDisplay value={String(answer.value)} />
              ) : answer.type === "multiple_choice" ? (
                <Badge variant="navy">{String(answer.value)}</Badge>
              ) : (
                <p className="text-sm text-navy/80 leading-relaxed">
                  {String(answer.value) || (
                    <span className="text-mist italic">No answer provided</span>
                  )}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Template Builder Modal ───────────────────────────────────────────

interface TemplateBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    isDefault: boolean;
    questions: InterviewQuestion[];
  }) => Promise<void>;
  initial?: ExitInterviewTemplate | null;
}

function TemplateBuilderModal({
  isOpen,
  onClose,
  onSave,
  initial,
}: TemplateBuilderProps) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [isDefault, setIsDefault] = useState(initial?.isDefault || false);
  const [questions, setQuestions] = useState<InterviewQuestion[]>(
    initial?.questions || []
  );
  const [saving, setSaving] = useState(false);
  const [showQuestionBank, setShowQuestionBank] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
      setIsDefault(initial?.isDefault || false);
      setQuestions(initial?.questions || []);
    }
  }, [isOpen, initial]);

  const addQuestion = (
    preset?: Omit<InterviewQuestion, "id" | "order">
  ) => {
    const newQ: InterviewQuestion = {
      id: crypto.randomUUID(),
      text: preset?.text || "",
      type: preset?.type || "text",
      options: preset?.options,
      required: preset?.required ?? true,
      order: questions.length + 1,
    };
    setQuestions((prev) => [...prev, newQ]);
    setShowQuestionBank(false);
  };

  const updateQuestion = (
    id: string,
    updates: Partial<InterviewQuestion>
  ) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) =>
      prev
        .filter((q) => q.id !== id)
        .map((q, i) => ({ ...q, order: i + 1 }))
    );
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newQuestions = [...questions];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newQuestions.length) return;
    [newQuestions[index], newQuestions[swapIndex]] = [
      newQuestions[swapIndex],
      newQuestions[index],
    ];
    setQuestions(
      newQuestions.map((q, i) => ({ ...q, order: i + 1 }))
    );
  };

  const addOption = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: [...(q.options || []), ""] }
          : q
      )
    );
  };

  const updateOption = (
    questionId: string,
    optionIndex: number,
    value: string
  ) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options?.map((o, i) =>
                i === optionIndex ? value : o
              ),
            }
          : q
      )
    );
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options?.filter((_, i) => i !== optionIndex) }
          : q
      )
    );
  };

  const handleSave = async () => {
    if (!name.trim() || questions.length === 0) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), isDefault, questions });
      onClose();
    } catch {
      // Error saving
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-navy/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-card w-full max-w-2xl mx-4 my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy/10">
          <h3 className="text-lg font-semibold text-navy">
            {initial ? "Edit Template" : "Create Interview Template"}
          </h3>
          <button
            onClick={onClose}
            className="text-mist hover:text-navy transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {/* Basic info */}
          <div className="space-y-4">
            <Input
              label="Template Name"
              placeholder="e.g., Standard Exit Interview"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-navy">
                Description
              </label>
              <textarea
                placeholder="Brief description of this interview template..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-navy/20 text-teal focus:ring-teal/50"
              />
              <span className="text-sm font-medium text-navy">
                Set as default template
              </span>
            </label>
          </div>

          {/* Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-navy">
                Questions ({questions.length})
              </h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuestionBank(!showQuestionBank)}
                >
                  <Lightbulb size={14} className="mr-1" />
                  Question Bank
                </Button>
                <Button size="sm" onClick={() => addQuestion()}>
                  <Plus size={14} className="mr-1" />
                  Add Question
                </Button>
              </div>
            </div>

            {/* Question Bank dropdown */}
            {showQuestionBank && (
              <Card className="border-teal/30">
                <p className="text-xs font-medium text-mist mb-3">
                  Click a question to add it to your template
                </p>
                <div className="space-y-2">
                  {questionBank.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => addQuestion(q)}
                      className="block w-full text-left px-3 py-2 rounded-md text-sm text-navy hover:bg-teal/5 border border-navy/10 transition-colors"
                    >
                      <span className="font-medium">{q.text}</span>
                      <span className="text-xs text-mist ml-2">
                        ({questionTypeLabels[q.type]})
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {questions.length === 0 ? (
              <div className="border border-dashed border-navy/20 rounded-md py-8 text-center">
                <p className="text-sm text-mist">
                  No questions yet. Add from the question bank or create your
                  own.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q, index) => (
                  <div
                    key={q.id}
                    className="border border-navy/10 rounded-md p-4 space-y-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-mist bg-navy/5 rounded px-1.5 py-0.5 mt-1">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) =>
                            updateQuestion(q.id, { text: e.target.value })
                          }
                          placeholder="Enter question text..."
                          className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                        />
                        <div className="flex items-center gap-3 flex-wrap">
                          <select
                            value={q.type}
                            onChange={(e) => {
                              const newType = e.target.value as QuestionType;
                              const updates: Partial<InterviewQuestion> = {
                                type: newType,
                              };
                              if (
                                newType === "multiple_choice" &&
                                !q.options?.length
                              ) {
                                updates.options = ["Option 1"];
                              }
                              if (newType !== "multiple_choice") {
                                updates.options = undefined;
                              }
                              updateQuestion(q.id, updates);
                            }}
                            className="rounded-md border border-navy/20 px-2 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                          >
                            <option value="text">Text Response</option>
                            <option value="rating">Star Rating</option>
                            <option value="multiple_choice">
                              Multiple Choice
                            </option>
                            <option value="yes_no">Yes or No</option>
                          </select>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.required}
                              onChange={(e) =>
                                updateQuestion(q.id, {
                                  required: e.target.checked,
                                })
                              }
                              className="rounded border-navy/20 text-teal focus:ring-teal/50"
                            />
                            <span className="text-xs text-navy">Required</span>
                          </label>
                        </div>

                        {/* Multiple choice options */}
                        {q.type === "multiple_choice" && (
                          <div className="space-y-2 pl-1">
                            {q.options?.map((opt, optIndex) => (
                              <div
                                key={optIndex}
                                className="flex items-center gap-2"
                              >
                                <div className="w-2 h-2 rounded-full border border-navy/30 flex-shrink-0" />
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) =>
                                    updateOption(
                                      q.id,
                                      optIndex,
                                      e.target.value
                                    )
                                  }
                                  placeholder={`Option ${optIndex + 1}`}
                                  className="flex-1 rounded-md border border-navy/15 px-2 py-1 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-1 focus:ring-teal/50"
                                />
                                <button
                                  onClick={() =>
                                    removeOption(q.id, optIndex)
                                  }
                                  className="text-mist hover:text-ember transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addOption(q.id)}
                              className="text-xs text-teal hover:text-teal-light font-medium"
                            >
                              + Add option
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveQuestion(index, "up")}
                          disabled={index === 0}
                          className="p-1 text-mist hover:text-navy disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveQuestion(index, "down")}
                          disabled={index === questions.length - 1}
                          className="p-1 text-mist hover:text-navy disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          onClick={() => removeQuestion(q.id)}
                          className="p-1 text-mist hover:text-ember transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-navy/10">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!name.trim() || questions.length === 0}
          >
            {initial ? "Save Changes" : "Create Template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main InterviewList Component ─────────────────────────────────────

export default function InterviewList() {
  const { companyId, appUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>("templates");
  const [templates, setTemplates] = useState<ExitInterviewTemplate[]>([]);
  const [responses, setResponses] = useState<ExitInterviewResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExitInterviewTemplate | null>(null);
  const [viewingResponse, setViewingResponse] = useState<ExitInterviewResponse | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [tpls, resps] = await Promise.all([
          queryDocuments<ExitInterviewTemplate>("exitInterviewTemplates", [
            where("companyId", "==", companyId),
            orderBy("createdAt", "desc"),
          ]),
          queryDocuments<ExitInterviewResponse>("exitInterviewResponses", [
            where("companyId", "==", companyId),
            orderBy("createdAt", "desc"),
            firestoreLimit(50),
          ]),
        ]);
        setTemplates(tpls);
        setResponses(resps);
      } catch {
        // Collections may not exist yet
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const handleSaveTemplate = async (data: {
    name: string;
    description: string;
    isDefault: boolean;
    questions: InterviewQuestion[];
  }) => {
    if (!companyId) return;

    // If setting as default, unset other defaults
    if (data.isDefault) {
      const currentDefaults = templates.filter(
        (t) => t.isDefault && t.id !== editingTemplate?.id
      );
      for (const t of currentDefaults) {
        await updateDocument("exitInterviewTemplates", t.id, {
          isDefault: false,
          updatedAt: serverTimestamp(),
        });
      }
    }

    if (editingTemplate) {
      await updateDocument("exitInterviewTemplates", editingTemplate.id, {
        name: data.name,
        description: data.description,
        isDefault: data.isDefault,
        questions: data.questions,
        updatedAt: serverTimestamp(),
      });
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? { ...t, ...data, updatedAt: new Date() as unknown as ExitInterviewTemplate["updatedAt"] }
            : data.isDefault
              ? { ...t, isDefault: false }
              : t
        )
      );
    } else {
      const id = crypto.randomUUID();
      await setDocument("exitInterviewTemplates", id, {
        companyId,
        name: data.name,
        description: data.description,
        isDefault: data.isDefault,
        questions: data.questions,
        createdBy: appUser?.id || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTemplates((prev) => {
        const updated = data.isDefault
          ? prev.map((t) => ({ ...t, isDefault: false }))
          : prev;
        return [
          {
            id,
            companyId,
            name: data.name,
            description: data.description,
            isDefault: data.isDefault,
            questions: data.questions,
            createdBy: appUser?.id || "",
            createdAt: new Date() as unknown as ExitInterviewTemplate["createdAt"],
            updatedAt: new Date() as unknown as ExitInterviewTemplate["updatedAt"],
          },
          ...updated,
        ];
      });
    }
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteDocument("exitInterviewTemplates", templateId);
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  };

  const handleEditTemplate = (template: ExitInterviewTemplate) => {
    setEditingTemplate(template);
    setShowBuilder(true);
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  const filteredResponses = responses.filter(
    (r) =>
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeDepartment.toLowerCase().includes(search.toLowerCase())
  );

  const completedCount = responses.length;
  const positiveCount = responses.filter(
    (r) => r.sentiment === "positive"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display text-navy">Exit Interviews</h1>
          <p className="text-sm text-mist mt-1">
            Manage templates and review employee feedback
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingTemplate(null);
            setShowBuilder(true);
          }}
        >
          <Plus size={16} className="mr-1.5" />
          New Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-teal/10">
              <MessageSquare size={20} className="text-teal" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-navy">
                {templates.length}
              </p>
              <p className="text-xs text-mist">Templates</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-teal/10">
              <CheckCircle size={20} className="text-teal" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-navy">
                {completedCount}
              </p>
              <p className="text-xs text-mist">Responses</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-teal/10">
              <Clock size={20} className="text-teal" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-navy">
                {completedCount > 0
                  ? Math.round((positiveCount / completedCount) * 100)
                  : 0}
                %
              </p>
              <p className="text-xs text-mist">Positive</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex gap-1 bg-navy/5 rounded-md p-1">
          <button
            onClick={() => setActiveTab("templates")}
            className={clsx(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              activeTab === "templates"
                ? "bg-white text-navy shadow-sm"
                : "text-mist hover:text-navy"
            )}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab("responses")}
            className={clsx(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              activeTab === "responses"
                ? "bg-white text-navy shadow-sm"
                : "text-mist hover:text-navy"
            )}
          >
            Responses
          </button>
        </div>
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-mist"
            />
            <input
              type="text"
              placeholder={
                activeTab === "templates"
                  ? "Search templates..."
                  : "Search responses..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-md border border-navy/20 pl-9 pr-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Card>
          <div className="py-12 text-center text-sm text-mist">Loading...</div>
        </Card>
      ) : activeTab === "templates" ? (
        filteredTemplates.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MessageSquare size={48} strokeWidth={1.5} />}
              title="No interview templates yet"
              description="Create your first exit interview template to start collecting employee feedback."
              action={
                <Button
                  onClick={() => {
                    setEditingTemplate(null);
                    setShowBuilder(true);
                  }}
                >
                  <Plus size={16} className="mr-1.5" />
                  Create Template
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id} padding="none">
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="h-10 w-10 rounded-md bg-teal/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={20} className="text-teal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-navy truncate">
                        {template.name}
                      </p>
                      {template.isDefault && (
                        <Badge variant="teal">Default</Badge>
                      )}
                    </div>
                    <p className="text-xs text-mist mt-0.5 truncate">
                      {template.description || "No description"}
                    </p>
                  </div>
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-mist">
                      {template.questions.length} questions
                    </p>
                    <p className="text-xs text-mist mt-0.5">
                      {template.createdAt?.toDate
                        ? format(template.createdAt.toDate(), "MMM d, yyyy")
                        : "Just now"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="p-1.5 rounded-md text-mist hover:text-navy hover:bg-navy/5 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-1.5 rounded-md text-mist hover:text-ember hover:bg-ember/5 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : filteredResponses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<AlertCircle size={48} strokeWidth={1.5} />}
            title="No responses yet"
            description="Responses will appear here when employees complete their exit interviews."
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-navy/5">
            {filteredResponses.map((response) => (
              <button
                key={response.id}
                onClick={() => setViewingResponse(response)}
                className="flex items-center gap-4 px-6 py-4 hover:bg-navy/[0.02] transition-colors w-full text-left"
              >
                <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center text-teal font-medium text-sm flex-shrink-0">
                  {response.employeeName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy">
                    {response.employeeName}
                  </p>
                  <p className="text-xs text-mist mt-0.5">
                    {response.employeeRole} · {response.employeeDepartment}
                  </p>
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-xs text-mist">
                    {response.submittedAt?.toDate
                      ? format(response.submittedAt.toDate(), "MMM d, yyyy")
                      : ""}
                  </p>
                </div>
                {sentimentBadge(response.sentiment)}
                <Eye size={16} className="text-mist flex-shrink-0" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Template Builder */}
      <TemplateBuilderModal
        isOpen={showBuilder}
        onClose={() => {
          setShowBuilder(false);
          setEditingTemplate(null);
        }}
        onSave={handleSaveTemplate}
        initial={editingTemplate}
      />

      {/* Response Detail */}
      {viewingResponse && (
        <ResponseDetailModal
          response={viewingResponse}
          onClose={() => setViewingResponse(null)}
        />
      )}
    </div>
  );
}
