import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Star,
  FileText,
  CheckSquare,
} from "lucide-react";
import { format } from "date-fns";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  updateDocument,
  deleteDocument,
  where,
} from "../../lib/firestore";
import type { OffboardTemplate } from "../../types/offboarding.types";

export default function TemplateList() {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<OffboardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OffboardTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await queryDocuments<OffboardTemplate>("offboardTemplates", [
          where("companyId", "==", companyId),
        ]);
        setTemplates(data);
      } catch {
        showToast("error", "Failed to load templates");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const handleSetDefault = async (template: OffboardTemplate) => {
    if (!companyId) return;
    try {
      for (const t of templates.filter((t) => t.isDefault)) {
        await updateDocument("offboardTemplates", t.id, { isDefault: false });
      }
      await updateDocument("offboardTemplates", template.id, { isDefault: true });
      setTemplates((prev) =>
        prev.map((t) => ({ ...t, isDefault: t.id === template.id }))
      );
      showToast("success", "Default template updated");
    } catch {
      showToast("error", "Failed to update default template");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument("offboardTemplates", deleteTarget.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      showToast("success", "Template deleted");
      setDeleteTarget(null);
    } catch {
      showToast("error", "Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalTasks = templates.reduce((sum, t) => sum + (t.tasks?.length || 0), 0);
  const defaultTemplate = templates.find((t) => t.isDefault);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display text-navy">Offboard Templates</h1>
          <p className="text-sm text-mist mt-1">
            Build reusable templates for employee offboarding workflows
          </p>
        </div>
        <Button onClick={() => navigate("/templates/new")}>
          <Plus size={16} className="mr-1.5" />
          New Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-teal/10">
              <FileText size={20} className="text-teal" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-navy">{templates.length}</p>
              <p className="text-xs text-mist">Total Templates</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-teal/10">
              <CheckSquare size={20} className="text-teal" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-navy">{totalTasks}</p>
              <p className="text-xs text-mist">Total Tasks</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-teal/10">
              <Star size={20} className="text-teal" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy truncate">
                {defaultTemplate ? defaultTemplate.name : "None set"}
              </p>
              <p className="text-xs text-mist">Default Template</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-mist"
        />
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-md border border-navy/20 pl-9 pr-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
        />
      </div>

      {/* Content */}
      {loading ? (
        <Card>
          <LoadingSpinner />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={48} strokeWidth={1.5} />}
            title={search ? "No templates match your search" : "No templates yet"}
            description={
              search
                ? "Try a different search term."
                : "Create your first offboarding template to standardize the process."
            }
            action={
              !search ? (
                <Button onClick={() => navigate("/templates/new")}>
                  <Plus size={16} className="mr-1.5" />
                  Create Template
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((template) => (
            <Card key={template.id} padding="none">
              <div className="flex items-start gap-4 px-6 py-4">
                <div className="h-10 w-10 rounded-md bg-teal/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText size={20} className="text-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-navy">{template.name}</p>
                    {template.isDefault && <Badge variant="teal">Default</Badge>}
                    {template.targetRole && (
                      <Badge variant="navy">{template.targetRole}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-mist mt-0.5 truncate">
                    {template.description || "No description"}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-xs text-mist">
                      {template.tasks?.length || 0} tasks
                    </span>
                    {template.createdAt?.toDate && (
                      <span className="text-xs text-mist">
                        Created {format(template.createdAt.toDate(), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!template.isDefault && (
                    <button
                      onClick={() => handleSetDefault(template)}
                      className="p-1.5 rounded-md text-mist hover:text-teal hover:bg-teal/5 transition-colors"
                      title="Set as default"
                    >
                      <Star size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/templates/${template.id}`)}
                    className="p-1.5 rounded-md text-mist hover:text-navy hover:bg-navy/5 transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(template)}
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
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal
          isOpen
          onClose={() => setDeleteTarget(null)}
          title="Delete Template"
          size="sm"
        >
          <div className="space-y-4">
            {deleteTarget.isDefault && (
              <div className="flex items-start gap-2 p-3 bg-ember/5 border border-ember/20 rounded-md">
                <span className="text-ember text-sm font-medium">Warning:</span>
                <span className="text-sm text-navy ml-1">
                  This is your default template. Are you sure?
                </span>
              </div>
            )}
            <p className="text-sm text-navy">
              Are you sure you want to delete{" "}
              <span className="font-medium">"{deleteTarget.name}"</span>? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
