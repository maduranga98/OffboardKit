import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import {
  getDocument,
  setDocument,
  updateDocument,
  queryDocuments,
  serverTimestamp,
  where,
} from "../../lib/firestore";
import type {
  OffboardTemplate,
  TemplateTask,
  TaskType,
} from "../../types/offboarding.types";

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: "checkbox", label: "Checkbox" },
  { value: "upload", label: "File Upload" },
  { value: "signature", label: "Signature" },
  { value: "form", label: "Form" },
  { value: "link", label: "Link" },
];

const ASSIGNEE_ROLES = [
  { value: "hr_admin", label: "HR Admin" },
  { value: "it_admin", label: "IT Admin" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
];

function createBlankTask(order: number): TemplateTask {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    type: "checkbox",
    assigneeRole: "hr_admin",
    dayOffset: 0,
    isRequired: true,
    order,
  };
}

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { companyId, appUser } = useAuth();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetDepartment, setTargetDepartment] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !id || !companyId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const data = await getDocument<OffboardTemplate>("offboardTemplates", id);
        if (data) {
          setName(data.name);
          setDescription(data.description || "");
          setTargetRole(data.targetRole || "");
          setTargetDepartment(data.targetDepartment || "");
          setIsDefault(data.isDefault || false);
          setTasks(data.tasks || []);
        }
      } catch {
        showToast("error", "Failed to load template");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isNew, companyId]);

  const addTask = () => {
    setTasks((prev) => [...prev, createBlankTask(prev.length + 1)]);
  };

  const updateTask = (taskId: string, updates: Partial<TemplateTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) =>
      prev
        .filter((t) => t.id !== taskId)
        .map((t, i) => ({ ...t, order: i + 1 }))
    );
  };

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const draggedIndex = tasks.findIndex((t) => t.id === draggedTaskId);
    if (draggedIndex === targetIndex) {
      setDraggedTaskId(null);
      return;
    }

    const newTasks = [...tasks];
    const [draggedTask] = newTasks.splice(draggedIndex, 1);
    newTasks.splice(targetIndex, 0, draggedTask);
    setTasks(newTasks.map((t, i) => ({ ...t, order: i + 1 })));
    setDraggedTaskId(null);
  };

  const handleSave = async () => {
    if (!companyId || !appUser) return;
    if (!name.trim()) {
      showToast("error", "Template name is required");
      return;
    }
    if (tasks.length === 0) {
      showToast("error", "At least one task is required");
      return;
    }

    setSaving(true);
    try {
      if (isDefault) {
        const others = await queryDocuments<OffboardTemplate>(
          "offboardTemplates",
          [
            where("companyId", "==", companyId),
            where("isDefault", "==", true),
          ]
        );
        for (const t of others) {
          if (t.id !== id) {
            await updateDocument("offboardTemplates", t.id, { isDefault: false });
          }
        }
      }

      const data = {
        name: name.trim(),
        description: description.trim(),
        targetRole: targetRole.trim(),
        targetDepartment: targetDepartment.trim(),
        isDefault,
        tasks,
      };

      if (isNew) {
        const newId = crypto.randomUUID();
        await setDocument("offboardTemplates", newId, {
          ...data,
          companyId,
          createdBy: appUser.id,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDocument("offboardTemplates", id!, data);
      }

      showToast("success", isNew ? "Template created" : "Template saved");
      navigate("/templates");
    } catch {
      showToast("error", "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back link + header */}
      <div>
        <button
          onClick={() => navigate("/templates")}
          className="flex items-center gap-1.5 text-sm text-mist hover:text-navy transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Templates
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-display text-navy">
            {isNew ? "New Template" : "Edit Template"}
          </h1>
          <Button onClick={handleSave} loading={saving}>
            <Save size={16} className="mr-1.5" />
            {isNew ? "Create Template" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Template details */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-navy">Template Details</h2>
          <Input
            label="Template Name"
            placeholder="e.g., Standard Engineering Offboard"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-navy">
              Description
            </label>
            <textarea
              placeholder="Brief description of this template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Target Role"
              placeholder="e.g., engineer, sales, all"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
            <Input
              label="Target Department"
              placeholder="e.g., Engineering (optional)"
              value={targetDepartment}
              onChange={(e) => setTargetDepartment(e.target.value)}
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
      </Card>

      {/* Task Builder */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">
              Tasks ({tasks.length})
            </h2>
            <Button size="sm" onClick={addTask}>
              <Plus size={14} className="mr-1" />
              Add Task
            </Button>
          </div>

          {tasks.length === 0 ? (
            <div className="border border-dashed border-navy/20 rounded-md py-8 text-center">
              <p className="text-sm text-mist">
                No tasks yet. Click "Add Task" to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`border rounded-md p-4 space-y-3 transition-all cursor-move ${
                    draggedTaskId === task.id
                      ? "opacity-50 border-teal/50 bg-teal/5"
                      : draggedTaskId
                        ? "border-navy/10"
                        : "border-navy/10 hover:border-teal/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-mist bg-navy/5 rounded px-1.5 py-0.5 mt-1 flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 space-y-3 min-w-0">
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) =>
                          updateTask(task.id, { title: e.target.value })
                        }
                        placeholder="Task title..."
                        className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                      />
                      <textarea
                        value={task.description}
                        onChange={(e) =>
                          updateTask(task.id, { description: e.target.value })
                        }
                        placeholder="Task description (optional)..."
                        rows={2}
                        className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-mist">Type</label>
                          <select
                            value={task.type}
                            onChange={(e) =>
                              updateTask(task.id, {
                                type: e.target.value as TaskType,
                              })
                            }
                            className="rounded-md border border-navy/20 px-2 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                          >
                            {TASK_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-mist">Depends On</label>
                          <select
                            value={task.dependsOnTaskId || ""}
                            onChange={(e) =>
                              updateTask(task.id, {
                                dependsOnTaskId:
                                  e.target.value || undefined,
                              })
                            }
                            className="rounded-md border border-navy/20 px-2 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                          >
                            <option value="">None</option>
                            {tasks.map((t) =>
                              t.id !== task.id ? (
                                <option key={t.id} value={t.id}>
                                  Task {t.order}
                                </option>
                              ) : null
                            )}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-mist">Assignee</label>
                          <select
                            value={task.assigneeRole}
                            onChange={(e) =>
                              updateTask(task.id, {
                                assigneeRole: e.target.value,
                              })
                            }
                            className="rounded-md border border-navy/20 px-2 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                          >
                            {ASSIGNEE_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-mist">Day Offset</label>
                          <input
                            type="number"
                            value={task.dayOffset}
                            onChange={(e) =>
                              updateTask(task.id, {
                                dayOffset: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-20 rounded-md border border-navy/20 px-2 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={task.isRequired}
                            onChange={(e) =>
                              updateTask(task.id, {
                                isRequired: e.target.checked,
                              })
                            }
                            className="rounded border-navy/20 text-teal focus:ring-teal/50"
                          />
                          <span className="text-xs text-navy">Required</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-0.5 flex-shrink-0">
                      <div className="p-1 text-mist cursor-grab active:cursor-grabbing">
                        <GripVertical size={16} />
                      </div>
                      <button
                        onClick={() => deleteTask(task.id)}
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
      </Card>

      {/* Bottom actions */}
      <div className="flex justify-end gap-2 pb-6">
        <Button variant="outline" onClick={() => navigate("/templates")}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving}>
          {isNew ? "Create Template" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
