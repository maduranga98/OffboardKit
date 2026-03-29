import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  Wrench,
  FileText,
  Check,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import clsx from "clsx";
import { Timestamp } from "firebase/firestore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { setDocument, updateDocument } from "../../lib/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { useCompanyStore } from "../../store/companyStore";
import { seedDefaultTemplates } from "../../lib/seedData";
import type { Company, CompanySize } from "../../types/company.types";
import type { UserRole } from "../../types/user.types";

const steps = [
  { label: "Company", icon: Building2 },
  { label: "Team", icon: Users },
  { label: "Tech Stack", icon: Wrench },
  { label: "Template", icon: FileText },
];

const companySizes: { value: CompanySize; label: string }[] = [
  { value: "10-50", label: "10–50 employees" },
  { value: "50-200", label: "50–200 employees" },
  { value: "200-500", label: "200–500 employees" },
];

const industries = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Retail",
  "Manufacturing",
  "Consulting",
  "Media",
  "Non-profit",
  "Other",
];

const countries = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "India",
  "Singapore",
  "Other",
];

const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const toolCategories = [
  {
    name: "Communication",
    tools: ["Slack", "Microsoft Teams", "Google Meet"],
  },
  {
    name: "Productivity",
    tools: ["Notion", "Confluence", "Google Drive"],
  },
  {
    name: "Dev Tools",
    tools: ["GitHub", "GitLab", "Linear", "Jira", "AWS"],
  },
  {
    name: "Design",
    tools: ["Figma", "Adobe CC"],
  },
  {
    name: "Finance",
    tools: ["QuickBooks", "Expensify"],
  },
  {
    name: "CRM",
    tools: ["HubSpot", "Salesforce"],
  },
];

const templateOptions = [
  {
    id: "general",
    name: "General Employee Exit",
    taskCount: 8,
    estimatedTime: "5–7 days",
    recommended: true,
  },
  {
    id: "engineer",
    name: "Software Engineer Exit",
    taskCount: 13,
    estimatedTime: "7–10 days",
    recommended: false,
  },
  {
    id: "sales",
    name: "Sales Representative Exit",
    taskCount: 12,
    estimatedTime: "5–7 days",
    recommended: false,
  },
];

interface TeamMember {
  email: string;
  role: UserRole;
}

export default function SetupWizard() {
  const { user, loading, companyId } = useAuth();
  const navigate = useNavigate();
  const setCompanyId = useAuthStore((s) => s.setCompanyId);
  const setCompany = useCompanyStore((s) => s.setCompany);

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState<CompanySize>("10-50");
  const [industry, setIndustry] = useState("Technology");
  const [country, setCountry] = useState("United States");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
  );

  // Step 2
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("hr_admin");

  // Step 3
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  // Step 4
  const [selectedTemplate, setSelectedTemplate] = useState("general");

  if (loading) return <LoadingSpinner fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (companyId) return <Navigate to="/dashboard" replace />;

  const addTeamMember = () => {
    if (!inviteEmail || !inviteEmail.includes("@")) return;
    if (teamMembers.some((m) => m.email === inviteEmail)) return;
    setTeamMembers([...teamMembers, { email: inviteEmail, role: inviteRole }]);
    setInviteEmail("");
  };

  const removeTeamMember = (email: string) => {
    setTeamMembers(teamMembers.filter((m) => m.email !== email));
  };

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool)
        ? prev.filter((t) => t !== tool)
        : [...prev, tool]
    );
  };

  const canProceed = () => {
    if (currentStep === 0) return companyName.trim().length > 0;
    return true;
  };

  const handleFinish = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const newCompanyId = crypto.randomUUID();
      const domain = user.email?.split("@")[1] || "";

      const companyDoc: Company = {
        id: newCompanyId,
        name: companyName,
        domain,
        size: companySize,
        employeeCount: 0,
        industry,
        country,
        timezone,
        plan: "free",
        stripeCustomerId: "",
        settings: {
          brandColor: "#0D9E8A",
          logoUrl: "",
          portalDomain: "",
          defaultTemplate: selectedTemplate,
          notificationEmail: user.email || "",
          slackWebhookUrl: "",
        },
        features: {
          knowledgeVideo: false,
          alumniPortal: false,
          aiGapDetection: false,
          apiAccess: false,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDocument("companies", newCompanyId, companyDoc);

      await updateDocument("users", user.uid, {
        companyId: newCompanyId,
        role: "super_admin",
      });

      await seedDefaultTemplates(newCompanyId, selectedTemplate);

      if (selectedTools.length > 0) {
        for (const tool of selectedTools) {
          await setDocument("systemCatalog", `${newCompanyId}_${tool}`, {
            companyId: newCompanyId,
            name: tool,
            isActive: true,
            createdAt: Timestamp.now(),
          });
        }
      }

      // Send invite emails for each team member added in the wizard
      for (const member of teamMembers) {
        const inviteId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await setDocument("invites", inviteId, {
          id: inviteId,
          companyId: newCompanyId,
          companyName: companyName,
          email: member.email.toLowerCase(),
          role: member.role,
          invitedBy: user.uid,
          invitedByName: user.displayName || user.email || "",
          status: "pending",
          createdAt: Timestamp.now(),
          expiresAt: Timestamp.fromDate(expiresAt),
        });

        // Fire and forget — don't block wizard completion
        const sendInviteEmail = httpsCallable(functions, "sendTeamInvite");
        sendInviteEmail({ inviteId }).catch((err) =>
          console.error("Failed to send invite email:", err)
        );
      }

      setCompanyId(newCompanyId);
      setCompany(companyDoc);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Setup error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
    else handleFinish();
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="min-h-screen bg-warm flex flex-col items-center py-8 px-4">
      <div className="flex items-center gap-2 mb-8">
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#0D9E8A" />
          <path d="M7 8h8v12H7V8z" stroke="white" strokeWidth="2" fill="none" />
          <path d="M15 12l4 2-4 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M19 14h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="font-display text-xl text-navy">OffboardKit</span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-center gap-2">
              <div
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium",
                  i === currentStep
                    ? "bg-teal text-white"
                    : i < currentStep
                      ? "bg-teal/10 text-teal"
                      : "bg-navy/5 text-mist"
                )}
              >
                {i < currentStep ? (
                  <Check size={16} />
                ) : (
                  <Icon size={16} />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="w-6 h-px bg-navy/10" />
              )}
            </div>
          );
        })}
      </div>

      <Card className="w-full max-w-2xl" padding="lg">
        {/* Step 1: Company Details */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-navy">Company Details</h2>
              <p className="text-sm text-mist mt-1">
                Tell us about your organization.
              </p>
            </div>

            <Input
              label="Company Name"
              placeholder="Acme Corp"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-navy mb-2">
                Company Size
              </label>
              <div className="grid grid-cols-3 gap-3">
                {companySizes.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => setCompanySize(size.value)}
                    className={clsx(
                      "p-3 rounded-md border text-sm font-medium text-center transition-colors",
                      companySize === size.value
                        ? "border-teal bg-teal/5 text-teal"
                        : "border-navy/10 text-navy hover:border-teal/50"
                    )}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1">
                  Industry
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                >
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy mb-1">
                  Country
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                >
                  {countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Invite Team */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-navy">
                Invite Your Team
              </h2>
              <p className="text-sm text-mist mt-1">
                Add your HR and IT team members. You can skip this and do it later.
              </p>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="colleague@company.com"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTeamMember())}
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50"
              >
                <option value="hr_admin">HR Admin</option>
                <option value="it_admin">IT Admin</option>
                <option value="manager">Manager</option>
              </select>
              <Button onClick={addTeamMember} size="md">
                <Plus size={16} />
              </Button>
            </div>

            {teamMembers.length > 0 && (
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.email}
                    className="flex items-center justify-between p-3 bg-navy/[0.02] rounded-md border border-navy/5"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy">{member.email}</p>
                      <p className="text-xs text-mist capitalize">
                        {member.role.replace("_", " ")}
                      </p>
                    </div>
                    <button
                      onClick={() => removeTeamMember(member.email)}
                      className="text-mist hover:text-ember transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {teamMembers.length === 0 && (
              <div className="text-center py-8 text-mist text-sm">
                No team members added yet. You can invite them later from Settings.
              </div>
            )}
          </div>
        )}

        {/* Step 3: Tech Stack */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-navy">
                Your Tech Stack
              </h2>
              <p className="text-sm text-mist mt-1">
                Select the tools your company uses. These populate your Access
                Revocation checklist.
              </p>
            </div>

            {toolCategories.map((category) => (
              <div key={category.name}>
                <h3 className="text-sm font-medium text-mist mb-2">
                  {category.name}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {category.tools.map((tool) => (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => toggleTool(tool)}
                      className={clsx(
                        "flex items-center gap-2 p-3 rounded-md border text-sm font-medium transition-colors",
                        selectedTools.includes(tool)
                          ? "border-teal bg-teal/5 text-teal"
                          : "border-navy/10 text-navy hover:border-teal/50"
                      )}
                    >
                      {selectedTools.includes(tool) && (
                        <Check size={14} className="flex-shrink-0" />
                      )}
                      <span>{tool}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Template */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-navy">
                Choose a Starter Template
              </h2>
              <p className="text-sm text-mist mt-1">
                Pick a template to get started. You can customize it later.
              </p>
            </div>

            <div className="space-y-3">
              {templateOptions.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplate(template.id)}
                  className={clsx(
                    "w-full text-left p-4 rounded-md border transition-colors",
                    selectedTemplate === template.id
                      ? "border-teal bg-teal/5"
                      : "border-navy/10 hover:border-teal/50"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-navy">
                          {template.name}
                        </p>
                        {template.recommended && (
                          <span className="text-[10px] font-medium bg-teal/10 text-teal px-1.5 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-mist mt-1">
                        {template.taskCount} tasks · {template.estimatedTime}
                      </p>
                    </div>
                    {selectedTemplate === template.id && (
                      <Check size={18} className="text-teal flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-navy/10">
          <Button
            variant="ghost"
            onClick={prev}
            disabled={currentStep === 0}
          >
            <ChevronLeft size={16} className="mr-1" />
            Back
          </Button>
          <Button
            onClick={next}
            loading={submitting}
            disabled={!canProceed()}
          >
            {currentStep === 3 ? "Finish Setup" : "Continue"}
            {currentStep < 3 && <ChevronRight size={16} className="ml-1" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}
