import { useState, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { format } from "date-fns";
import clsx from "clsx";
import {
  Mail,
  Briefcase,
  Building2,
  Calendar,
  Linkedin,
  Edit2,
  Save,
  X,
  Lock,
  ChevronRight,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { ReturnBanner } from "../../components/alumni-portal/ReturnBanner";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import { updateDocument, getDocument, serverTimestamp } from "../../lib/firestore";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") {
    return (ts as Timestamp).toDate();
  }
  return null;
}

export default function AlumniProfile() {
  const { user, alumniProfile, loading } = useAlumniAuth();
  const [companyName, setCompanyName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [form, setForm] = useState({ currentCompany: "", currentRole: "", linkedIn: "" });
  const [openToConsulting, setOpenToConsulting] = useState(false);
  const [consultingSkills, setConsultingSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [savingSkills, setSavingSkills] = useState(false);

  useEffect(() => {
    if (!alumniProfile) return;
    setForm({
      currentCompany: alumniProfile.currentCompany,
      currentRole: alumniProfile.currentRole,
      linkedIn: alumniProfile.linkedIn,
    });
    setOpenToConsulting(alumniProfile.openToConsulting ?? false);
    setConsultingSkills(alumniProfile.consultingSkills ?? []);
    if (alumniProfile.companyId) {
      getDocument<{ name: string }>("companies", alumniProfile.companyId)
        .then((c) => { if (c?.name) setCompanyName(c.name); })
        .catch(() => {});
    }
  }, [alumniProfile]);

  const handleSave = async () => {
    if (!alumniProfile) return;
    setSaving(true);
    try {
      await updateDocument("alumniProfiles", alumniProfile.id, {
        currentCompany: form.currentCompany.trim(),
        currentRole: form.currentRole.trim(),
        linkedIn: form.linkedIn.trim(),
        updatedAt: serverTimestamp(),
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (!user) { setPasswordError("Unable to change password."); return; }
    try {
      await updatePassword(user, passwordForm.newPassword);
      setPasswordSuccess(true);
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setTimeout(() => { setShowPasswordModal(false); setPasswordSuccess(false); }, 2000);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Failed to change password.");
    }
  };

  async function handleConsultingToggle() {
    if (!alumniProfile) return;
    const newValue = !openToConsulting;
    setOpenToConsulting(newValue);
    try {
      await updateDocument("alumniProfiles", alumniProfile.id, {
        openToConsulting: newValue,
        updatedAt: serverTimestamp(),
      });
    } catch {
      setOpenToConsulting(!newValue);
    }
  }

  function handleAddSkill() {
    const skill = skillInput.trim();
    if (skill && !consultingSkills.includes(skill)) {
      const next = [...consultingSkills, skill];
      setConsultingSkills(next);
      setSkillInput("");
    } else {
      setSkillInput("");
    }
  }

  function handleRemoveSkill(skill: string) {
    setConsultingSkills((prev) => prev.filter((s) => s !== skill));
  }

  async function handleSaveSkills() {
    if (!alumniProfile) return;
    setSavingSkills(true);
    try {
      await updateDocument("alumniProfiles", alumniProfile.id, {
        consultingSkills,
        updatedAt: serverTimestamp(),
      });
    } catch { /* ignore */ }
    finally { setSavingSkills(false); }
  }

  if (loading) return <div className="py-24 flex justify-center"><LoadingSpinner size="lg" /></div>;
  if (!alumniProfile) return null;

  const exitDate = toDate(alumniProfile.exitDate);

  return (
    <div className="space-y-5">

      {/* Welcome hero */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-teal/10 flex items-center justify-center text-teal font-display text-xl flex-shrink-0">
          {alumniProfile.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-display text-navy">Welcome back, {alumniProfile.name.split(" ")[0]}!</h1>
          <p className="text-sm text-mist mt-0.5">
            {alumniProfile.role}
            {alumniProfile.department ? ` · ${alumniProfile.department}` : ""}
            {companyName ? ` at ${companyName}` : ""}
          </p>
        </div>
      </div>

      {/* Return interest banner */}
      <ReturnBanner alumniProfile={alumniProfile} companyName={companyName} onUpdate={() => {}} />

      {/* Exit history */}
      <Card>
        <h2 className="text-sm font-semibold text-navy mb-4">Your History at {companyName || "the company"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <Mail size={14} className="text-mist mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-mist mb-0.5">Email</p>
              <p className="text-sm text-navy break-all">{alumniProfile.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar size={14} className="text-mist mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-mist mb-0.5">Exit Date</p>
              <p className="text-sm text-navy">{exitDate ? format(exitDate, "MMM d, yyyy") : "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Briefcase size={14} className="text-mist mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-mist mb-0.5">Role at Exit</p>
              <p className="text-sm text-navy">{alumniProfile.role || "—"}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Current info — editable */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-navy">What are you up to now?</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 text-xs text-teal hover:text-teal/80 transition-colors"
            >
              <Edit2 size={12} />
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Current Company"
                value={form.currentCompany}
                onChange={(e) => setForm((p) => ({ ...p, currentCompany: e.target.value }))}
                placeholder="Where do you work now?"
              />
              <Input
                label="Current Role"
                value={form.currentRole}
                onChange={(e) => setForm((p) => ({ ...p, currentRole: e.target.value }))}
                placeholder="Your current role"
              />
            </div>
            <Input
              label="LinkedIn URL"
              value={form.linkedIn}
              onChange={(e) => setForm((p) => ({ ...p, linkedIn: e.target.value }))}
              placeholder="https://linkedin.com/in/..."
            />
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} loading={saving} size="sm">
                <Save size={12} className="mr-1.5" />
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                <X size={12} className="mr-1.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <Building2 size={14} className="text-mist mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-mist mb-0.5">Current Company</p>
                <p className="text-sm text-navy">{form.currentCompany || <span className="text-mist italic">Not set</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Briefcase size={14} className="text-mist mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-mist mb-0.5">Current Role</p>
                <p className="text-sm text-navy">{form.currentRole || <span className="text-mist italic">Not set</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Linkedin size={14} className="text-mist mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-mist mb-0.5">LinkedIn</p>
                {form.linkedIn ? (
                  <a
                    href={form.linkedIn.startsWith("http") ? form.linkedIn : `https://${form.linkedIn}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-teal hover:underline break-all"
                  >
                    View profile
                  </a>
                ) : (
                  <span className="text-sm text-mist italic">Not set</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Consulting Availability */}
      <Card>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-navy">Consulting Availability</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy font-medium">Available for consulting</p>
              <p className="text-xs text-mist">
                Let {companyName || "your former company"} know you're open to freelance or advisory work
              </p>
            </div>
            <button
              onClick={handleConsultingToggle}
              className={clsx(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0",
                openToConsulting ? "bg-teal" : "bg-navy/20"
              )}
            >
              <span
                className={clsx(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  openToConsulting ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {openToConsulting && (
            <div>
              <label className="block text-xs font-medium text-mist mb-1.5">
                Skills you can offer (optional)
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {consultingSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy/5 text-navy text-xs rounded-full"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
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
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAddSkill(); }
                  }}
                  placeholder="Add a skill..."
                  className="flex-1 px-3 py-1.5 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
                <Button size="sm" variant="outline" onClick={handleAddSkill}>Add</Button>
                <Button size="sm" onClick={handleSaveSkills} loading={savingSkills}>Save</Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Account */}
      <button
        onClick={() => setShowPasswordModal(true)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-navy/10 rounded-xl text-sm text-navy hover:bg-navy/[0.02] transition-colors"
      >
        <span className="flex items-center gap-2 text-mist">
          <Lock size={14} />
          Change Password
        </span>
        <ChevronRight size={14} className="text-mist" />
      </button>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); setPasswordError(""); setPasswordSuccess(false); }}
        title="Change Password"
        size="sm"
      >
        <div className="space-y-4">
          {passwordSuccess && (
            <div className="p-3 bg-teal/10 border border-teal/20 rounded-md text-sm text-teal">
              Password changed successfully!
            </div>
          )}
          {passwordError && (
            <div className="p-3 bg-ember/10 border border-ember/20 rounded-md text-sm text-ember">
              {passwordError}
            </div>
          )}
          <Input
            label="New Password"
            type="password"
            placeholder="Enter new password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Confirm new password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
          />
          <div className="flex gap-2 pt-4 border-t border-navy/5">
            <Button variant="ghost" onClick={() => setShowPasswordModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleChangePassword} className="flex-1">Change Password</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
