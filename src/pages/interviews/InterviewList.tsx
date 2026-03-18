import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  MessageSquare,
  Search,
  Eye,
  Trash2,
  Copy,
  MoreVertical,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import {
  where,
  orderBy,
  limit as firestoreLimit,
} from "firebase/firestore";
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
  deleteDocument,
  serverTimestamp,
} from "../../lib/firestore";
import type {
  ExitInterviewTemplate,
  ExitInterviewResponse,
  InterviewQuestion,
  InterviewStatus,
} from "../../types/interview.types";

type TabView = "templates" | "responses";

const defaultQuestions: InterviewQuestion[] = [
  {
    id: "q1",
    text: "What prompted your decision to leave?",
    type: "text",
    required: true,
    order: 1,
  },
  {
    id: "q2",
    text: "How would you rate your overall experience working here?",
    type: "rating",
    required: true,
    order: 2,
  },
  {
    id: "q3",
    text: "Did you feel supported by your manager?",
    type: "yes_no",
    required: true,
    order: 3,
  },
  {
    id: "q4",
    text: "What could we have done differently to retain you?",
    type: "text",
    required: false,
    order: 4,
  },
  {
    id: "q5",
    text: "Would you recommend this company to a friend?",
    type: "yes_no",
    required: true,
    order: 5,
  },
];

function statusBadge(status: InterviewStatus) {
  const map: Record<InterviewStatus, { label: string; variant: "teal" | "navy" | "mist" }> = {
    active: { label: "Active", variant: "teal" },
    draft: { label: "Draft", variant: "mist" },
    archived: { label: "Archived", variant: "navy" },
  };
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function responseStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "teal" | "ember" | "mist" | "amber" }> = {
    completed: { label: "Completed", variant: "teal" },
    in_progress: { label: "In Progress", variant: "amber" },
    pending: { label: "Pending", variant: "mist" },
    expired: { label: "Expired", variant: "ember" },
  };
  const s = map[status] || { label: status, variant: "mist" };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export default function InterviewList() {
  const { companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>("templates");
  const [templates, setTemplates] = useState<ExitInterviewTemplate[]>([]);
  const [responses, setResponses] = useState<ExitInterviewResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

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

  const handleCreateTemplate = async () => {
    if (!companyId || !newTemplateName.trim()) return;
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      await setDocument("exitInterviewTemplates", id, {
        companyId,
        name: newTemplateName.trim(),
        description: newTemplateDesc.trim(),
        questions: defaultQuestions,
        status: "active" as InterviewStatus,
        createdBy: companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTemplates((prev) => [
        {
          id,
          companyId,
          name: newTemplateName.trim(),
          description: newTemplateDesc.trim(),
          questions: defaultQuestions,
          status: "active",
          createdBy: companyId,
          createdAt: new Date() as unknown as ExitInterviewTemplate["createdAt"],
          updatedAt: new Date() as unknown as ExitInterviewTemplate["updatedAt"],
        },
        ...prev,
      ]);
      setShowCreateModal(false);
      setNewTemplateName("");
      setNewTemplateDesc("");
    } catch {
      // Error creating template
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicateTemplate = async (template: ExitInterviewTemplate) => {
    if (!companyId) return;
    const id = crypto.randomUUID();
    await setDocument("exitInterviewTemplates", id, {
      companyId,
      name: `${template.name} (Copy)`,
      description: template.description,
      questions: template.questions,
      status: "draft" as InterviewStatus,
      createdBy: companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setTemplates((prev) => [
      {
        ...template,
        id,
        name: `${template.name} (Copy)`,
        status: "draft",
        createdAt: new Date() as unknown as ExitInterviewTemplate["createdAt"],
        updatedAt: new Date() as unknown as ExitInterviewTemplate["updatedAt"],
      },
      ...prev,
    ]);
    setMenuOpen(null);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteDocument("exitInterviewTemplates", templateId);
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    setMenuOpen(null);
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  const filteredResponses = responses.filter(
    (r) =>
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.templateName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeDepartment.toLowerCase().includes(search.toLowerCase())
  );

  const completedCount = responses.filter((r) => r.status === "completed").length;
  const pendingCount = responses.filter(
    (r) => r.status === "pending" || r.status === "in_progress"
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
        <Button onClick={() => setShowCreateModal(true)}>
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
              <p className="text-2xl font-semibold text-navy">{templates.length}</p>
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
              <p className="text-2xl font-semibold text-navy">{completedCount}</p>
              <p className="text-xs text-mist">Completed</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-amber-100">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-navy">{pendingCount}</p>
              <p className="text-xs text-mist">Pending</p>
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
                <Button onClick={() => setShowCreateModal(true)}>
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
                      {statusBadge(template.status)}
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
                  <div className="relative">
                    <button
                      onClick={() =>
                        setMenuOpen(menuOpen === template.id ? null : template.id)
                      }
                      className="p-1.5 rounded-md text-mist hover:text-navy hover:bg-navy/5 transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuOpen === template.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-md shadow-card border border-navy/10 py-1 z-10">
                        <button
                          onClick={() => handleDuplicateTemplate(template)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-navy hover:bg-navy/5"
                        >
                          <Copy size={14} />
                          Duplicate
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ember hover:bg-ember/5"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
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
              <Link
                key={response.id}
                to={`/interviews/${response.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-navy/[0.02] transition-colors"
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
                  <p className="text-xs text-mist">{response.templateName}</p>
                  <p className="text-xs text-mist mt-0.5">
                    {response.submittedAt?.toDate
                      ? format(response.submittedAt.toDate(), "MMM d, yyyy")
                      : response.createdAt?.toDate
                        ? format(response.createdAt.toDate(), "MMM d, yyyy")
                        : ""}
                  </p>
                </div>
                {responseStatusBadge(response.status)}
                <Eye size={16} className="text-mist flex-shrink-0" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Create Template Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Interview Template"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Template Name"
            placeholder="e.g., Standard Exit Interview"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-navy">
              Description
            </label>
            <textarea
              placeholder="Brief description of this interview template..."
              value={newTemplateDesc}
              onChange={(e) => setNewTemplateDesc(e.target.value)}
              rows={3}
              className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          </div>
          <div className="bg-warm/50 rounded-md p-4">
            <p className="text-sm font-medium text-navy mb-2">
              Default Questions ({defaultQuestions.length})
            </p>
            <p className="text-xs text-mist">
              Your template will be created with {defaultQuestions.length} starter
              questions covering common exit interview topics. You can customize them
              later.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              loading={creating}
              disabled={!newTemplateName.trim()}
            >
              Create Template
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
