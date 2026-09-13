import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  Mail,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { SettingsShell } from "./SettingsShell";
import { Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import { useCompanyStore } from "../../store/companyStore";
import { functions } from "../../lib/firebase";
import { getEffectivePlan } from "../../lib/trial";
import { getSeatUsage } from "../../lib/plans";
import {
  queryDocuments,
  deleteDocument,
  where,
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
  const company = useCompanyStore((state) => state.company);
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
        const getMembers = httpsCallable(functions, "getCompanyMembers");
        const result = await getMembers();
        const data = (result.data as { members: AppUser[] }).members;
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
      // Role changes are server-owned; rules reject client writes to users.role
      const setRole = httpsCallable<{ userId: string; role: UserRole }, unknown>(
        functions,
        "setMemberRole"
      );
      await setRole({ userId, role: newRole });
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
      const removeMemberFn = httpsCallable<{ userId: string }, unknown>(
        functions,
        "removeMember"
      );
      await removeMemberFn({ userId: removeTarget.id });
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

    // Locally cheap checks only. The seat limit, the duplicate checks and the
    // invite document itself are all owned by createTeamInvite — a browser
    // cannot write to the invites collection any more, precisely so the seat
    // count a package sells is enforced in one place.
    if (seats.isFull) {
      showToast("error", "No seats left", seatLimitHint);
      return;
    }

    setInviting(true);
    try {
      const createInvite = httpsCallable<
        { email: string; role: UserRole },
        { inviteId: string }
      >(functions, "createTeamInvite");
      await createInvite({ email, role: inviteRole });

      showToast("success", "Invite sent", `Invitation email sent to ${email}`);
      setInviteEmail("");
      loadPendingInvites();
    } catch (error) {
      console.error("Invite error:", error);
      const { code, message } = (error ?? {}) as { code?: string; message?: string };

      if (code === "functions/resource-exhausted") {
        showToast("error", "No seats left", seatLimitHint);
      } else if (code === "functions/already-exists") {
        showToast("error", "Already invited", message || "This person already has access.");
      } else if (code === "functions/failed-precondition") {
        showToast(
          "error",
          "Subscription required",
          "Your trial has ended — choose a plan to keep inviting teammates."
        );
      } else {
        showToast(
          "error",
          "Failed to send invite",
          "The invite was not saved. Please try again."
        );
      }
    } finally {
      setInviting(false);
    }
  };

  const roleCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {});

  // Seats mirror the server's arithmetic in functions/src/billing/planLimits.ts:
  // an active member and an unexpired pending invite each hold one.
  const seats = getSeatUsage(
    getEffectivePlan(company),
    members.filter((m) => m.isActive !== false).length,
    pendingInvites.filter(
      (i) => !i.expiresAt || i.expiresAt.toDate().getTime() > Date.now()
    ).length
  );

  const seatLimitHint =
    seats.limit === null
      ? ""
      : `Your plan includes ${seats.limit} user${seats.limit === 1 ? "" : "s"}. ` +
        "Upgrade, cancel a pending invite, or remove a member to invite someone else.";

  const selectClass =
    "rounded-md border border-navy/20 px-2 py-1 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-teal/50 focus:border-teal";

  return (
    <SettingsShell
      title="Team & Roles"
      description="Manage your team members and their roles"
    >
      <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <p className="text-2xl font-semibold text-navy">
                {members.length}
                {seats.limit !== null && (
                  <span className="text-base font-normal text-mist">
                    {" / "}
                    {seats.limit}
                  </span>
                )}
              </p>
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
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-navy">
                  Invite Team Member
                </h2>
                <p className="text-xs text-mist">
                  {seats.limit === null ? (
                    <>Unlimited users on your plan</>
                  ) : (
                    <>
                      <span
                        className={
                          seats.isFull ? "font-medium text-ember" : "font-medium text-navy"
                        }
                      >
                        {seats.used} of {seats.limit}
                      </span>{" "}
                      seats used
                      {seats.pendingInvites > 0 &&
                        ` · ${seats.pendingInvites} pending`}
                    </>
                  )}
                </p>
              </div>

              {seats.isFull && (
                <div className="flex items-start gap-2.5 rounded-md bg-ember/5 border border-ember/20 px-3 py-2.5">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-ember" />
                  <p className="text-xs leading-relaxed text-navy/80">
                    {seatLimitHint}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  disabled={seats.isFull}
                  className="flex-1 rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal disabled:bg-navy/5 disabled:cursor-not-allowed"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  disabled={seats.isFull}
                  className="rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal disabled:bg-navy/5 disabled:cursor-not-allowed"
                >
                  <option value="hr_admin">HR Admin</option>
                  <option value="it_admin">IT Admin</option>
                  <option value="manager">Manager</option>
                </select>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviting || seats.isFull}
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
              from the team? They will lose access to OffboardSet.
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
      </>
    </SettingsShell>
  );
}
