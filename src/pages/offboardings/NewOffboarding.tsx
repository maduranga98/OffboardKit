import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  UserPlus,
  Calendar,
  FileText,
  CheckCircle,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { format, differenceInDays } from "date-fns";
import clsx from "clsx";
import { where } from "firebase/firestore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { queryDocuments, setDocument } from "../../lib/firestore";
import type { OffboardTemplate } from "../../types/offboarding.types";

const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "Sales",
  "Marketing",
  "Finance",
  "HR",
  "Operations",
  "Legal",
  "Other",
];

const EXIT_TYPES = [
  "Voluntary Resignation",
  "Involuntary",
  "Retirement",
  "Contract End",
  "Mutual Agreement",
];

interface FormErrors {
  employeeName?: string;
  employeeEmail?: string;
  employeeRole?: string;
  department?: string;
  managerName?: string;
  lastWorkingDay?: string;
  templateId?: string;
  exitType?: string;
}

export default function NewOffboarding() {
  const navigate = useNavigate();
  const { companyId, appUser } = useAuth();

  const [templates, setTemplates] = useState<OffboardTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Form state
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeRole, setEmployeeRole] = useState("");
  const [department, setDepartment] = useState("");
  const [managerName, setManagerName] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [exitType, setExitType] = useState("");

  useEffect(() => {
    if (!companyId) return;
    const loadTemplates = async () => {
      try {
        const results = await queryDocuments<OffboardTemplate>(
          "offboardTemplates",
          [where("companyId", "==", companyId)]
        );
        setTemplates(results);
      } catch {
        // No templates yet
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, [companyId]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const daysRemaining =
    lastWorkingDay
      ? differenceInDays(new Date(lastWorkingDay), new Date())
      : null;

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!employeeName.trim()) newErrors.employeeName = "Employee name is required";
    if (!employeeEmail.trim()) {
      newErrors.employeeEmail = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail)) {
      newErrors.employeeEmail = "Invalid email address";
    }
    if (!employeeRole.trim()) newErrors.employeeRole = "Job title is required";
    if (!department) newErrors.department = "Department is required";
    if (!managerName.trim()) newErrors.managerName = "Manager name is required";
    if (!lastWorkingDay) {
      newErrors.lastWorkingDay = "Last working day is required";
    } else if (new Date(lastWorkingDay) <= new Date()) {
      newErrors.lastWorkingDay = "Must be a future date";
    }
    if (!selectedTemplateId) newErrors.templateId = "Please select a template";
    if (!exitType) newErrors.exitType = "Exit type is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !companyId || !appUser) return;

    setSubmitting(true);
    try {
      const flowId = crypto.randomUUID();
      const portalToken = crypto.randomUUID();
      const lwdDate = new Date(lastWorkingDay);

      await setDocument("offboardFlows", flowId, {
        id: flowId,
        companyId,
        employeeId: flowId,
        employeeName: employeeName.trim(),
        employeeEmail: employeeEmail.trim(),
        employeeRole: employeeRole.trim(),
        employeeDepartment: department,
        managerId: appUser.id,
        templateId: selectedTemplateId,
        status: "not_started",
        startDate: Timestamp.now(),
        lastWorkingDay: Timestamp.fromDate(lwdDate),
        completedAt: null,
        progressPercent: 0,
        portalToken,
        completionScores: {
          tasks: 0,
          knowledge: 0,
          accessRevocation: 0,
          exitInterview: 0,
          assets: 0,
        },
        createdAt: Timestamp.now(),
      });

      // Create tasks from template
      if (selectedTemplate) {
        const taskPromises = selectedTemplate.tasks.map((task) => {
          const taskId = crypto.randomUUID();
          const dueDate = new Date(
            lwdDate.getTime() + task.dayOffset * 86400000
          );
          return setDocument("flowTasks", taskId, {
            id: taskId,
            flowId,
            title: task.title,
            description: task.description,
            type: task.type,
            assigneeId: "",
            assigneeRole: task.assigneeRole,
            assigneeName: "",
            dueDate: Timestamp.fromDate(dueDate),
            status: "pending",
            completedAt: null,
            completedBy: "",
            uploadedFileUrl: "",
            notes: "",
            isRequired: task.isRequired,
          });
        });
        await Promise.all(taskPromises);
      }

      navigate(`/offboardings/${flowId}`);
    } catch (err) {
      setErrors({ employeeName: "Failed to create offboarding. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/offboardings"
          className="p-2 rounded-md text-mist hover:text-navy hover:bg-navy/5 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-display text-navy">
          Start New Offboarding
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form fields — left 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Employee Information */}
            <Card>
              <h2 className="text-base font-semibold text-navy mb-4">
                Employee Information
              </h2>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Employee Full Name"
                    placeholder="e.g., Jane Smith"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    error={errors.employeeName}
                  />
                  <Input
                    label="Employee Email"
                    type="email"
                    placeholder="jane@company.com"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    error={errors.employeeEmail}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Job Title / Role"
                    placeholder="e.g., Senior Engineer"
                    value={employeeRole}
                    onChange={(e) => setEmployeeRole(e.target.value)}
                    error={errors.employeeRole}
                  />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-navy">
                      Department
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className={clsx(
                        "block w-full rounded-md border px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal",
                        errors.department
                          ? "border-ember focus:ring-ember/50"
                          : "border-navy/20"
                      )}
                    >
                      <option value="">Select department</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {errors.department && (
                      <p className="text-xs text-ember">{errors.department}</p>
                    )}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Manager Name"
                    placeholder="e.g., John Doe"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    error={errors.managerName}
                  />
                  <Input
                    label="Last Working Day"
                    type="date"
                    value={lastWorkingDay}
                    onChange={(e) => setLastWorkingDay(e.target.value)}
                    error={errors.lastWorkingDay}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-navy">
                    Exit Type
                  </label>
                  <select
                    value={exitType}
                    onChange={(e) => setExitType(e.target.value)}
                    className={clsx(
                      "block w-full rounded-md border px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal sm:max-w-xs",
                      errors.exitType
                        ? "border-ember focus:ring-ember/50"
                        : "border-navy/20"
                    )}
                  >
                    <option value="">Select exit type</option>
                    {EXIT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {errors.exitType && (
                    <p className="text-xs text-ember">{errors.exitType}</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Template Selection */}
            <Card>
              <h2 className="text-base font-semibold text-navy mb-4">
                Select Template
              </h2>
              {errors.templateId && (
                <p className="text-xs text-ember mb-3">{errors.templateId}</p>
              )}
              {loadingTemplates ? (
                <div className="py-8 flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : templates.length === 0 ? (
                <EmptyState
                  icon={<FileText size={48} strokeWidth={1.5} />}
                  title="No templates found"
                  description="Create an offboarding template first to define the task checklist."
                  action={
                    <Link to="/templates">
                      <Button variant="outline">
                        <FileText size={16} className="mr-1.5" />
                        Go to Templates
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={clsx(
                        "text-left rounded-lg border-2 p-4 transition-colors",
                        selectedTemplateId === template.id
                          ? "border-teal bg-teal/5"
                          : "border-navy/10 hover:border-navy/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy truncate">
                            {template.name}
                          </p>
                          <p className="text-xs text-mist mt-1 line-clamp-2">
                            {template.description || "No description"}
                          </p>
                        </div>
                        {selectedTemplateId === template.id && (
                          <CheckCircle
                            size={20}
                            className="text-teal flex-shrink-0"
                          />
                        )}
                      </div>
                      <p className="text-xs text-mist mt-2">
                        {template.tasks.length} tasks
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Submit — mobile */}
            <div className="lg:hidden">
              <Button
                type="submit"
                fullWidth
                loading={submitting}
                disabled={submitting}
              >
                <UserPlus size={16} className="mr-1.5" />
                Start Offboarding
              </Button>
            </div>
          </div>

          {/* Summary card — right 1/3 */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <Card>
                <h3 className="text-sm font-semibold text-navy mb-4">
                  Summary
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center text-teal font-medium text-sm flex-shrink-0">
                      {employeeName ? employeeName.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate">
                        {employeeName || "Employee Name"}
                      </p>
                      <p className="text-xs text-mist truncate">
                        {employeeRole || "Job Title"} {department ? `· ${department}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-navy/5 pt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={14} className="text-mist flex-shrink-0" />
                      <span className="text-mist">Last Working Day:</span>
                      <span className="text-navy font-medium">
                        {lastWorkingDay
                          ? format(new Date(lastWorkingDay), "MMM d, yyyy")
                          : "—"}
                      </span>
                    </div>
                    {daysRemaining !== null && daysRemaining > 0 && (
                      <div
                        className={clsx(
                          "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium",
                          daysRemaining <= 7
                            ? "bg-amber-100 text-amber-700"
                            : "bg-teal/10 text-teal"
                        )}
                      >
                        {daysRemaining} days remaining
                      </div>
                    )}
                  </div>

                  <div className="border-t border-navy/5 pt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText size={14} className="text-mist flex-shrink-0" />
                      <span className="text-mist">Template:</span>
                      <span className="text-navy font-medium truncate">
                        {selectedTemplate?.name || "—"}
                      </span>
                    </div>
                    {selectedTemplate && (
                      <p className="text-xs text-mist">
                        {selectedTemplate.tasks.length} tasks will be created
                      </p>
                    )}
                  </div>

                  {exitType && (
                    <div className="border-t border-navy/5 pt-4">
                      <p className="text-xs text-mist">Exit Type</p>
                      <p className="text-sm text-navy font-medium">{exitType}</p>
                    </div>
                  )}
                </div>

                {/* Submit — desktop */}
                <div className="hidden lg:block mt-6">
                  <Button
                    type="submit"
                    fullWidth
                    loading={submitting}
                    disabled={submitting}
                  >
                    <UserPlus size={16} className="mr-1.5" />
                    Start Offboarding
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
