import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Network,
  UserCheck,
  Star,
  Linkedin,
  Plus,
  Trash2,
  X,
  Tag,
  Building,
  TrendingUp,
  Edit2,
} from "lucide-react";
import BoomerangPipeline from "./BoomerangPipeline";
import ConsultingPool from "./ConsultingPool";
import AlumniJobBoard from "./AlumniJobBoard";
import AlumniAnnouncements from "./AlumniAnnouncements";
import ExpertThreads from "./ExpertThreads";
import PulseSurveys from "./PulseSurveys";
import DocRequestsPanel from "./DocRequestsPanel";
import { ExitContextCard } from "../../components/alumni/ExitContextCard";
import { Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  createUserWithEmailAndPassword,
  deleteUser,
} from "firebase/auth";
import { secondaryAuth, functions } from "../../lib/firebase";
import { format } from "date-fns";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  setDocument,
  updateDocument,
  deleteDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import EngagementBadge from "../../components/alumni/EngagementBadge";
import type {
  AlumniProfile,
  AlumniStatus,
  RehirePriority,
  EngagementLevel,
} from "../../types/alumni.types";
import type { OffboardFlow } from "../../types/offboarding.types";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

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

const STATUS_LABELS: Record<AlumniStatus, string> = {
  active: "Active",
  do_not_contact: "Do Not Contact",
  rehire_candidate: "Rehire Candidate",
};

const PRIORITY_LABELS: Record<RehirePriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

const EMPTY_FORM = {
  name: "",
  email: "",
  role: "",
  department: "",
  exitDate: "",
  exitType: "",
  linkedIn: "",
  currentCompany: "",
  currentRole: "",
  rehirePriority: "none" as RehirePriority,
  status: "active" as AlumniStatus,
  notes: "",
  optedIn: false,
  tags: [] as string[],
};

type AlumniTab = "directory" | "pipeline" | "jobboard" | "announcements" | "expertthreads" | "pulsesurveys" | "consulting" | "requests";

export default function Alumni() {
  const { companyId } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as AlumniTab) || "directory";
  const [profiles, setProfiles] = useState<AlumniProfile[]>([]);
  const [completedFlows, setCompletedFlows] = useState<OffboardFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AlumniStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<RehirePriority | "all">("all");
  const [engagementFilter, setEngagementFilter] = useState<EngagementLevel | "all">("all");
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'exit_date'>('name');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AlumniProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingAll, setAddingAll] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tagInput, setTagInput] = useState("");

  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      const [profileData, flowData] = await Promise.all([
        queryDocuments<AlumniProfile>("alumniProfiles", [
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
        ]),
        queryDocuments<OffboardFlow>("offboardFlows", [
          where("companyId", "==", companyId),
          where("status", "==", "completed"),
          orderBy("completedAt", "desc"),
        ]),
      ]);
      setProfiles(profileData);
      setCompletedFlows(flowData);
    } catch {
      // Error loading
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const existingFlowIds = new Set(profiles.map((p) => p.flowId));
  const unregisteredFlows = completedFlows.filter(
    (f) => !existingFlowIds.has(f.id)
  );

  function openAddModal() {
    setForm(EMPTY_FORM);
    setTagInput("");
    setShowAddModal(true);
  }

  function openEditModal(profile: AlumniProfile) {
    const exitDate = toDate(profile.exitDate);
    setForm({
      name: profile.name,
      email: profile.email,
      role: profile.role,
      department: profile.department,
      exitDate: exitDate ? format(exitDate, "yyyy-MM-dd") : "",
      exitType: profile.exitType,
      linkedIn: profile.linkedIn,
      currentCompany: profile.currentCompany,
      currentRole: profile.currentRole,
      rehirePriority: profile.rehirePriority,
      status: profile.status,
      notes: profile.notes,
      optedIn: profile.optedIn,
      tags: [...profile.tags],
    });
    setTagInput("");
    setEditingProfile(profile);
  }

  function closeModals() {
    setShowAddModal(false);
    setEditingProfile(null);
    setForm(EMPTY_FORM);
    setTagInput("");
  }

  function handleAddTag() {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput("");
    }
  }

  function handleRemoveTag(tag: string) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }

  async function handleSaveNew() {
    if (!form.name.trim() || !form.email.trim() || !companyId) return;

    setSaving(true);
    const email = form.email.trim();
    let authUid: string | null = null;
    let createdSecondaryUser: import("firebase/auth").User | null = null;

    try {
      const id = crypto.randomUUID();

      if (form.optedIn) {
        // Create account via secondary app so the admin stays signed in.
        // Use a random unguessable temporary password — the alumni will set
        // their own via the invitation email.
        const tempPassword = crypto.randomUUID() + crypto.randomUUID();
        const userCred = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          tempPassword
        );
        authUid = userCred.user.uid;
        createdSecondaryUser = userCred.user;
      }

      const doc = {
        id,
        companyId,
        flowId: "",
        name: form.name.trim(),
        email,
        role: form.role.trim(),
        department: form.department,
        exitDate: form.exitDate
          ? Timestamp.fromDate(new Date(form.exitDate))
          : serverTimestamp(),
        exitType: form.exitType,
        linkedIn: form.linkedIn.trim(),
        currentCompany: form.currentCompany.trim(),
        currentRole: form.currentRole.trim(),
        status: form.status,
        rehirePriority: form.rehirePriority,
        notes: form.notes.trim(),
        tags: form.tags,
        optedIn: form.optedIn,
        authUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDocument("alumniProfiles", id, doc);
      setProfiles((prev) => [doc as unknown as AlumniProfile, ...prev]);

      if (form.optedIn) {
        await secondaryAuth.signOut();
        // Call the Cloud Function directly so the invitation email is sent
        // immediately rather than waiting for a Firestore trigger to fire.
        try {
          const sendInvite = httpsCallable(functions, "sendAlumniInvite");
          await sendInvite({ profileId: id });
          showToast("success", "Alumni added", `Invitation email sent to ${email}`);
        } catch {
          showToast(
            "info",
            "Alumni added",
            `Profile saved. Invitation email could not be sent to ${email} — check your email configuration.`
          );
        }
      } else {
        showToast("success", "Alumni added", `${form.name.trim()} has been added.`);
      }

      closeModals();
    } catch (err) {
      // Firestore save failed — clean up the auth account we created
      if (createdSecondaryUser) {
        try {
          await deleteUser(createdSecondaryUser);
        } catch {
          // Ignore cleanup errors
        }
        await secondaryAuth.signOut().catch(() => {});
      }
      alert("Error creating alumni: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingProfile || !form.name.trim() || !form.email.trim()) return;
    setSaving(true);

    const updates = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role.trim(),
      department: form.department,
      exitDate: form.exitDate
        ? Timestamp.fromDate(new Date(form.exitDate))
        : editingProfile.exitDate,
      exitType: form.exitType,
      linkedIn: form.linkedIn.trim(),
      currentCompany: form.currentCompany.trim(),
      currentRole: form.currentRole.trim(),
      status: form.status,
      rehirePriority: form.rehirePriority,
      notes: form.notes.trim(),
      tags: form.tags,
      optedIn: form.optedIn,
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDocument("alumniProfiles", editingProfile.id, updates);
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editingProfile.id ? { ...p, ...updates } as unknown as AlumniProfile : p
        )
      );
      closeModals();
    } catch {
      // Error saving
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingProfile) return;
    const confirmed = window.confirm(
      `Remove ${editingProfile.name} from the alumni network?`
    );
    if (!confirmed) return;

    try {
      // Delete Firestore profile
      await deleteDocument("alumniProfiles", editingProfile.id);
      setProfiles((prev) => prev.filter((p) => p.id !== editingProfile.id));
      closeModals();
    } catch (err) {
      alert("Error deleting alumni: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  async function handleAddAllUnregistered() {
    if (!companyId) return;
    setAddingAll(true);

    try {
      const newProfiles: AlumniProfile[] = [];
      for (const flow of unregisteredFlows) {
        const id = crypto.randomUUID();
        const doc = {
          id,
          companyId,
          flowId: flow.id,
          name: flow.employeeName,
          email: flow.employeeEmail,
          role: flow.employeeRole,
          department: flow.employeeDepartment,
          exitDate: flow.completedAt || flow.createdAt,
          exitType: "",
          linkedIn: "",
          currentCompany: "",
          currentRole: "",
          status: "active" as const,
          rehirePriority: "none" as const,
          notes: "",
          tags: [],
          optedIn: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDocument("alumniProfiles", id, doc);
        newProfiles.push(doc as unknown as AlumniProfile);
      }
      setProfiles((prev) => [...newProfiles, ...prev]);
    } catch {
      // Error adding
    } finally {
      setAddingAll(false);
    }
  }

  const filtered = profiles.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (priorityFilter !== "all" && p.rehirePriority !== priorityFilter) return false;
    if (engagementFilter !== "all" && p.engagementLevel !== engagementFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'score') {
      arr.sort((a, b) => (b.engagementScore ?? -1) - (a.engagementScore ?? -1));
    } else if (sortBy === 'exit_date') {
      arr.sort((a, b) => {
        const aDate = a.exitDate?.toDate?.()?.getTime() ?? 0;
        const bDate = b.exitDate?.toDate?.()?.getTime() ?? 0;
        return bDate - aDate;
      });
    } else {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return arr;
  }, [filtered, sortBy]);

  const totalAlumni = profiles.length;
  const rehireCandidates = profiles.filter((p) => p.rehirePriority !== "none").length;
  const highPriority = profiles.filter((p) => p.rehirePriority === "high").length;
  const optedIn = profiles.filter((p) => p.optedIn).length;

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Form JSX shared between Add and Edit modals
  const formContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Full name"
        />
        <Input
          label="Email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          placeholder="email@example.com"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Role at Exit"
          value={form.role}
          onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
          placeholder="e.g., Senior Engineer"
        />
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Department
          </label>
          <select
            value={form.department}
            onChange={(e) =>
              setForm((p) => ({ ...p, department: e.target.value }))
            }
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="">Select department</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Exit Date
          </label>
          <input
            type="date"
            value={form.exitDate}
            onChange={(e) =>
              setForm((p) => ({ ...p, exitDate: e.target.value }))
            }
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Exit Type
          </label>
          <select
            value={form.exitType}
            onChange={(e) =>
              setForm((p) => ({ ...p, exitType: e.target.value }))
            }
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="">Select exit type</option>
            {EXIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Input
        label="LinkedIn URL"
        value={form.linkedIn}
        onChange={(e) => setForm((p) => ({ ...p, linkedIn: e.target.value }))}
        placeholder="https://linkedin.com/in/..."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Current Company"
          value={form.currentCompany}
          onChange={(e) =>
            setForm((p) => ({ ...p, currentCompany: e.target.value }))
          }
          placeholder="Where did they go?"
        />
        <Input
          label="Current Role"
          value={form.currentRole}
          onChange={(e) =>
            setForm((p) => ({ ...p, currentRole: e.target.value }))
          }
          placeholder="Their new role"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Rehire Priority
          </label>
          <select
            value={form.rehirePriority}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                rehirePriority: e.target.value as RehirePriority,
              }))
            }
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Status
          </label>
          <select
            value={form.status}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                status: e.target.value as AlumniStatus,
              }))
            }
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="active">Active</option>
            <option value="rehire_candidate">Rehire Candidate</option>
            <option value="do_not_contact">Do Not Contact</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-navy mb-1">
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          rows={3}
          placeholder="Internal HR notes..."
          className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.optedIn}
          onChange={(e) =>
            setForm((p) => ({ ...p, optedIn: e.target.checked }))
          }
          className="h-4 w-4 rounded border-navy/20 text-teal focus:ring-teal/50"
        />
        <span className="text-sm text-navy">Opted into alumni network</span>
      </label>

      {/* Invitation note (add modal only when opting in) */}
      {!editingProfile && form.optedIn && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-teal/5 border border-teal/20 rounded-lg text-sm text-teal">
          <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            An invitation email will be sent to <strong>{form.email.trim() || "this address"}</strong> with a link to set their password and access the alumni portal.
          </span>
        </div>
      )}

      {/* Tags (edit modal only) */}
      {editingProfile && (
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Tags
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal/10 text-teal text-xs rounded-full"
              >
                <Tag size={10} />
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-ember transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Add a tag..."
              className="flex-1 px-3 py-1.5 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
            <Button size="sm" variant="outline" onClick={handleAddTag}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display text-navy">Alumni Network</h1>
          <p className="text-sm text-mist mt-1">
            Track former employees and manage your rehire pipeline
          </p>
        </div>
        {activeTab === "directory" && (
          <Button onClick={openAddModal}>
            <Plus size={14} className="mr-1.5" />
            Add Alumni
          </Button>
        )}
        {activeTab === "jobboard" && null}
      </div>

      {activeTab === "requests" && companyId && <DocRequestsPanel companyId={companyId} />}
      {activeTab === "consulting" && companyId && <ConsultingPool companyId={companyId} />}
      {activeTab === "pipeline" && <BoomerangPipeline />}
      {activeTab === "jobboard" && <AlumniJobBoard />}
      {activeTab === "announcements" && <AlumniAnnouncements />}
      {activeTab === "expertthreads" && companyId && <ExpertThreads companyId={companyId} />}
      {activeTab === "pulsesurveys" && companyId && <PulseSurveys companyId={companyId} />}

      {activeTab === "directory" && <>
      {/* Suggestion banner */}
      {unregisteredFlows.length > 0 && !dismissedBanner && (
        <div className="bg-teal/5 border border-teal/20 rounded-lg p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-navy">
            <span className="mr-1.5">💡</span>
            {unregisteredFlows.length} completed offboarding
            {unregisteredFlows.length === 1 ? " hasn't" : "s haven't"} been
            added to the alumni network yet.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={handleAddAllUnregistered}
              loading={addingAll}
            >
              Add All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissedBanner(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-mist">
              <Network size={16} />
              <span className="text-xs font-medium">Total Alumni</span>
            </div>
            <p className="text-2xl font-semibold text-navy">{totalAlumni}</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-mist">
              <UserCheck size={16} />
              <span className="text-xs font-medium">Rehire Candidates</span>
            </div>
            <p className="text-2xl font-semibold text-teal">{rehireCandidates}</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-mist">
              <Star size={16} />
              <span className="text-xs font-medium">High Priority</span>
            </div>
            <p className="text-2xl font-semibold text-teal">{highPriority}</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-mist">
              <TrendingUp size={16} />
              <span className="text-xs font-medium">Opted In</span>
            </div>
            <p className="text-2xl font-semibold text-navy">{optedIn}</p>
          </div>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by name, email, role, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-4 pr-4 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
          />
        </div>
        <div className="flex gap-1 bg-navy/5 rounded-md p-1">
          {(
            [
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "rehire_candidate", label: "Rehire Candidate" },
              { value: "do_not_contact", label: "Do Not Contact" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                statusFilter === opt.value
                  ? "bg-white text-navy shadow-sm"
                  : "text-mist hover:text-navy"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as RehirePriority | "all")
          }
          className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={engagementFilter}
          onChange={(e) => setEngagementFilter(e.target.value as EngagementLevel | "all")}
          className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
        >
          <option value="all">All Engagement</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1.5 text-sm border border-navy/10 rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-teal/50"
        >
          <option value="name">Sort: Name</option>
          <option value="score">Sort: Engagement (High → Low)</option>
          <option value="exit_date">Sort: Exit Date (Recent first)</option>
        </select>
      </div>

      {/* Alumni list */}
      {filtered.length === 0 && profiles.length === 0 && completedFlows.length === 0 ? (
        <Card>
          <EmptyState
            title="No alumni yet"
            description="Alumni profiles are created from completed offboardings."
          />
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm text-mist">
              No alumni match your current filters.
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-navy/5">
            {sorted.map((profile) => {
              const exitDate = toDate(profile.exitDate);
              return (
                <div
                  key={profile.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-navy/[0.02] transition-colors cursor-pointer"
                  onClick={() => openEditModal(profile)}
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center text-teal font-display text-sm flex-shrink-0">
                    {profile.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy">
                      {profile.name}
                    </p>
                    <p className="text-xs text-mist">
                      {profile.role}
                      {profile.department ? ` · ${profile.department}` : ""}
                    </p>
                  </div>

                  {/* Exit date */}
                  <div className="hidden sm:block text-xs text-mist flex-shrink-0">
                    {exitDate ? format(exitDate, "MMM yyyy") : "—"}
                  </div>

                  {/* Current company */}
                  {profile.currentCompany && (
                    <div className="hidden md:flex items-center gap-1 text-xs text-mist flex-shrink-0">
                      <Building size={12} />
                      → {profile.currentCompany}
                    </div>
                  )}

                  {/* Rehire priority badge */}
                  {profile.rehirePriority !== "none" && (
                    <span
                      className={clsx(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0",
                        profile.rehirePriority === "high" &&
                          "bg-teal/10 text-teal",
                        profile.rehirePriority === "medium" &&
                          "bg-amber-50 text-amber-600",
                        profile.rehirePriority === "low" &&
                          "bg-navy/5 text-navy"
                      )}
                    >
                      {PRIORITY_LABELS[profile.rehirePriority]}
                    </span>
                  )}

                  {/* Engagement badge */}
                  <EngagementBadge
                    score={profile.engagementScore ?? null}
                    level={profile.engagementLevel ?? null}
                  />

                  {/* Status badge */}
                  <Badge
                    variant={
                      profile.status === "do_not_contact" ? "ember" : "teal"
                    }
                  >
                    {profile.status === "rehire_candidate" && (
                      <Star size={10} className="mr-1 inline" />
                    )}
                    {STATUS_LABELS[profile.status]}
                  </Badge>

                  {/* LinkedIn */}
                  {profile.linkedIn && (
                    <a
                      href={profile.linkedIn.startsWith("http") ? profile.linkedIn : `https://${profile.linkedIn}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-mist hover:text-teal transition-colors flex-shrink-0"
                    >
                      <Linkedin size={16} />
                    </a>
                  )}

                  {/* Edit */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(profile);
                    }}
                    className="text-mist hover:text-navy transition-colors flex-shrink-0"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      </>}

      {/* Add Alumni Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={closeModals}
        title="Add Alumni"
        size="lg"
        footer={
          <div className="flex justify-end gap-2 pt-4 border-t border-navy/5">
            <Button variant="ghost" onClick={closeModals}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveNew}
              loading={saving}
              disabled={!form.name.trim() || !form.email.trim()}
            >
              Add Alumni
            </Button>
          </div>
        }
      >
        {formContent}
      </Modal>

      {/* Edit Alumni Modal */}
      <Modal
        isOpen={!!editingProfile}
        onClose={closeModals}
        title="Edit Alumni"
        size="lg"
        footer={
          <div className="flex items-center justify-between pt-4 border-t border-navy/5">
            <Button
              variant="ghost"
              onClick={handleDelete}
              className="text-ember hover:text-ember hover:bg-ember/5"
            >
              <Trash2 size={14} className="mr-1.5" />
              Delete Alumni
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={closeModals}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                loading={saving}
                disabled={!form.name.trim() || !form.email.trim()}
              >
                Save Changes
              </Button>
            </div>
          </div>
        }
      >
        {formContent}
        {editingProfile && companyId && (
          <div className="mt-4">
            <ExitContextCard
              flowId={editingProfile.flowId}
              companyId={companyId}
              alumniName={editingProfile.name}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
