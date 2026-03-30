import { useState, useEffect, useCallback } from "react";
import { NavLink } from "react-router-dom";
import {
  Building,
  Users,
  CreditCard,
  Plug,
  Mail,
  UserMinus,
  X,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import { functions } from "../../lib/firebase";
import {
  queryDocuments,
  updateDocument,
  getDocument,
  setDocument,
  deleteDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type { AppUser, UserRole } from "../../types/user.types";

interface Invite {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  invitedByName: string;
  status: "pending" | "accepted" | "expired";
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  manager: "Manager",
  it_admin: "IT Admin",
};

const ROLE_BADGE_VARIANTS: Record<UserRole, "teal" | "navy" | "mist" | "amber"> = {
  super_admin: "navy",
  hr_admin: "teal",
  manager: "amber",
  it_admin: "mist",
};

const navItems = [
  { label: "Company Profile", href: "/settings", icon: Building },
  { label: "Team & Roles", href: "/settings/team", icon: Users },
  { label: "Billing", href: "/settings/billing", icon: CreditCard },
  { label: "Integrations", href: "/settings/integrations", icon: Plug },
];

function SettingsSidebar() {
  return (
    <nav className="space-y-1">
      {navItems.map(({ label, href, icon: Icon }) => (
        <NavLink
          key={href}
          to={href}
          end={href === "/settings"}
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-teal/10 text-teal"
                : "text-mist hover:text-navy hover:bg-navy/5"
            )
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function TeamSettings() {
  const { companyId, appUser } = useAuth();
  const [members, setMembers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<AppUser | null>(null);
  const [removing, setRemoving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("hr_admin");
  const [inviting, setInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await queryDocuments<AppUser>("users", [
          where("companyId", "==", companyId),
          orderBy("createdAt", "asc"),
        ]);
        setMembers(data);
      } catch {
        showToast("error", "Failed to load team members");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const loadPendingInvites = useCallback(async () => {
    if (!companyId) return;
    try {
      const invites = await queryDocuments<Invite>("invites", [
        where("companyId", "==", companyId),
        where("status", "==", "pending"),
      ]);
      setPendingInvites(invites);
    } catch {
      // Silent fail
    }
  }, [companyId]);

  useEffect(() => {
    loadPendingInvites();
  }, [loadPendingInvites]);

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDocument("users", userId, { role: newRole });
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
      );
      showToast("success", "Role updated");
    } catch {
      showToast("error", "Failed to update role");
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await updateDocument("users", removeTarget.id, {
        companyId: "",
        isActive: false,
      });
      setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id));
      showToast("success", "Member removed");
      setRemoveTarget(null);
    } catch {
      showToast("error", "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@") || !companyId || !appUser) return;

    // Check if already has a pending invite
    const existing = await queryDocuments<Invite>("invites", [
      where("companyId", "==", companyId),
      where("email", "==", email),
      where("status", "==", "pending"),
    ]);
    if (existing.length > 0) {
      showToast("error", "Already invited", "This email already has a pending invite.");
      return;
    }

    // Check if already a team member
    const existingMember = members.find((m) => m.email.toLowerCase() === email);
    if (existingMember) {
      showToast("error", "Already on team", "This person is already a team member.");
      return;
    }

    setInviting(true);
    try {
      const inviteId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const companyDoc = await getDocument<{ name: string }>("companies", companyId);
      const companyName = companyDoc?.name || "Your company";

      await setDocument("invites", inviteId, {
        id: inviteId,
        companyId,
        companyName,
        email,
        role: inviteRole,
        invitedBy: appUser.id,
        invitedByName: appUser.displayName || appUser.email,
        status: "pending",
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
      });

      const sendInviteEmail = httpsCallable(functions, "sendTeamInvite");
      await sendInviteEmail({ inviteId });

      showToast("success", "Invite sent", `Invitation email sent to ${email}`);
      setInviteEmail("");
      loadPendingInvites();
    } catch (error) {
      console.error("Invite error:", error);
      showToast("error", "Failed to send invite", "Please try again.");
    } finally {
      setInviting(false);
    }
  };

  const roleCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {});

  const selectClass =
    "rounded-md border border-navy/20 px-2 py-1 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-teal/50 focus:border-teal";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-navy">Settings</h1>
        <p className="text-sm text-mist mt-1">
          Manage your company settings and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-52 flex-shrink-0">
          <Card padding="sm">
            <SettingsSidebar />
          </Card>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <p className="text-2xl font-semibold text-navy">{members.length}</p>
              <p className="text-xs text-mist mt-0.5">Total Members</p>
            </Card>
            {(["hr_admin", "manager", "it_admin"] as UserRole[]).map((role) => (
              <Card key={role}>
                <p className="text-2xl font-semibold text-navy">
                  {roleCounts[role] || 0}
                </p>
                <p className="text-xs text-mist mt-0.5">{ROLE_LABELS[role]}</p>
              </Card>
            ))}
          </div>

          {/* Invite section */}
          <Card>
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-navy">
                Invite Team Member
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  className="flex-1 rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                >
                  <option value="hr_admin">HR Admin</option>
                  <option value="it_admin">IT Admin</option>
                  <option value="manager">Manager</option>
                </select>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviting}
                  loading={inviting}
                >
                  <Mail size={16} className="mr-1.5" />
                  {inviting ? "Sending..." : "Send Invite"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <Card padding="none">
              <div className="px-6 py-4 border-b border-navy/5">
                <h2 className="text-base font-semibold text-navy">
                  Pending Invites
                  <span className="ml-2 text-sm font-normal text-mist">
                    ({pendingInvites.length})
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-navy/5">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-sm flex-shrink-0">
                      <Mail size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">
                        {invite.email}
                      </p>
                      <p className="text-xs text-mist">
                        Invited as {ROLE_LABELS[invite.role]} · Expires in{" "}
                        {Math.max(
                          0,
                          Math.ceil(
                            (invite.expiresAt.toDate().getTime() - Date.now()) /
                              86400000
                          )
                        )}{" "}
                        days
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="amber">Pending</Badge>
                      <button
                        onClick={async () => {
                          await deleteDocument("invites", invite.id);
                          setPendingInvites((prev) =>
                            prev.filter((i) => i.id !== invite.id)
                          );
                          showToast("success", "Invite cancelled");
                        }}
                        className="p-1.5 rounded-md text-mist hover:text-ember hover:bg-ember/5 transition-colors"
                        title="Cancel invite"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Team list */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-navy/5">
              <h2 className="text-base font-semibold text-navy">
                Team Members
              </h2>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : members.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Users size={48} strokeWidth={1.5} />}
                  title="No team members found"
                  description="Invite your team members to get started."
                />
              </div>
            ) : (
              <div className="divide-y divide-navy/5">
                {members.map((member) => {
                  const isMe = member.id === appUser?.id;
                  const isAdmin = member.role === "super_admin";
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 px-6 py-4"
                    >
                      <div className="h-9 w-9 rounded-full bg-teal/10 flex items-center justify-center text-teal font-medium text-sm flex-shrink-0">
                        {getInitials(member.displayName || member.email)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-navy truncate">
                            {member.displayName || "—"}
                          </p>
                          {isMe && <Badge variant="mist">You</Badge>}
                        </div>
                        <p className="text-xs text-mist">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        <Badge variant={ROLE_BADGE_VARIANTS[member.role]}>
                          {ROLE_LABELS[member.role]}
                        </Badge>
                        {!isMe && !isAdmin && (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleChangeRole(
                                member.id,
                                e.target.value as UserRole
                              )
                            }
                            className={selectClass}
                          >
                            <option value="hr_admin">HR Admin</option>
                            <option value="it_admin">IT Admin</option>
                            <option value="manager">Manager</option>
                          </select>
                        )}
                        {!isMe && (
                          <button
                            onClick={() => setRemoveTarget(member)}
                            className="p-1.5 rounded-md text-mist hover:text-ember hover:bg-ember/5 transition-colors"
                            title="Remove member"
                          >
                            <UserMinus size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Remove confirm modal */}
      {removeTarget && (
        <Modal
          isOpen
          onClose={() => setRemoveTarget(null)}
          title="Remove Member"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-navy">
              Are you sure you want to remove{" "}
              <span className="font-medium">
                {removeTarget.displayName || removeTarget.email}
              </span>{" "}
              from the team? They will lose access to OffboardKit.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRemove}
                loading={removing}
              >
                Remove
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
