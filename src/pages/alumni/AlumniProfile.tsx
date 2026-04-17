import { useState, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import {
  User,
  Mail,
  Briefcase,
  Building2,
  Calendar,
  Linkedin,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import { updateDocument, serverTimestamp } from "../../lib/firestore";
import type { AlumniProfile } from "../../types/alumni.types";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") {
    return (ts as Timestamp).toDate();
  }
  return null;
}

export default function AlumniProfile() {
  const { alumniProfile, loading } = useAlumniAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    currentCompany: "",
    currentRole: "",
    linkedIn: "",
  });

  useEffect(() => {
    if (alumniProfile) {
      setForm({
        currentCompany: alumniProfile.currentCompany,
        currentRole: alumniProfile.currentRole,
        linkedIn: alumniProfile.linkedIn,
      });
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

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!alumniProfile) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-mist">Profile not found</p>
        </div>
      </Card>
    );
  }

  const exitDate = toDate(alumniProfile.exitDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-navy">My Alumni Profile</h1>
          <p className="text-sm text-mist mt-1">
            Manage your alumni network profile
          </p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <Edit2 size={14} className="mr-1.5" />
            Edit Profile
          </Button>
        )}
      </div>

      {/* Profile Card */}
      <Card>
        <div className="space-y-6">
          {/* Avatar and basic info */}
          <div className="flex items-start gap-4 pb-6 border-b border-navy/5">
            <div className="h-16 w-16 rounded-full bg-teal/10 flex items-center justify-center text-teal font-display text-xl flex-shrink-0">
              {alumniProfile.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy">
                {alumniProfile.name}
              </h2>
              <p className="text-sm text-mist mt-1">
                {alumniProfile.role}
                {alumniProfile.department ? ` · ${alumniProfile.department}` : ""}
              </p>
            </div>
          </div>

          {/* Read-only section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 text-mist mb-2">
                <Mail size={14} />
                <span className="text-xs font-medium">Email</span>
              </div>
              <p className="text-sm text-navy">{alumniProfile.email}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-mist mb-2">
                <Briefcase size={14} />
                <span className="text-xs font-medium">Role at Exit</span>
              </div>
              <p className="text-sm text-navy">{alumniProfile.role}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-mist mb-2">
                <Building2 size={14} />
                <span className="text-xs font-medium">Department</span>
              </div>
              <p className="text-sm text-navy">
                {alumniProfile.department || "—"}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-mist mb-2">
                <Calendar size={14} />
                <span className="text-xs font-medium">Exit Date</span>
              </div>
              <p className="text-sm text-navy">
                {exitDate ? format(exitDate, "MMM d, yyyy") : "—"}
              </p>
            </div>
          </div>

          {/* Editable section */}
          <div className="pt-6 border-t border-navy/5 space-y-6">
            <div>
              <h3 className="font-semibold text-navy mb-4">
                Current Information
              </h3>

              {isEditing ? (
                <div className="space-y-4">
                  <Input
                    label="Current Company"
                    value={form.currentCompany}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        currentCompany: e.target.value,
                      }))
                    }
                    placeholder="Where do you work now?"
                  />
                  <Input
                    label="Current Role"
                    value={form.currentRole}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, currentRole: e.target.value }))
                    }
                    placeholder="Your current role"
                  />
                  <Input
                    label="LinkedIn URL"
                    value={form.linkedIn}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, linkedIn: e.target.value }))
                    }
                    placeholder="https://linkedin.com/in/..."
                  />
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSave}
                      loading={saving}
                      className="flex-1"
                    >
                      <Save size={14} className="mr-1.5" />
                      Save Changes
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                      className="flex-1"
                    >
                      <X size={14} className="mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 text-mist mb-2">
                      <Building2 size={14} />
                      <span className="text-xs font-medium">
                        Current Company
                      </span>
                    </div>
                    <p className="text-sm text-navy">
                      {form.currentCompany || "—"}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-mist mb-2">
                      <Briefcase size={14} />
                      <span className="text-xs font-medium">Current Role</span>
                    </div>
                    <p className="text-sm text-navy">
                      {form.currentRole || "—"}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 text-mist mb-2">
                      <Linkedin size={14} />
                      <span className="text-xs font-medium">LinkedIn</span>
                    </div>
                    {form.linkedIn ? (
                      <a
                        href={form.linkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-teal hover:text-teal-light"
                      >
                        {form.linkedIn}
                      </a>
                    ) : (
                      <p className="text-sm text-navy">—</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-6 border-t border-navy/5 text-xs text-mist space-y-1">
            <p>
              Profile created{" "}
              {toDate(alumniProfile.createdAt)
                ? format(toDate(alumniProfile.createdAt)!, "MMM d, yyyy")
                : "—"}
            </p>
            <p>
              Last updated{" "}
              {toDate(alumniProfile.updatedAt)
                ? format(toDate(alumniProfile.updatedAt)!, "MMM d, yyyy")
                : "—"}
            </p>
          </div>
        </div>
      </Card>

      {/* Info box */}
      <Card className="bg-teal/5 border border-teal/20">
        <div className="flex gap-3">
          <User size={16} className="text-teal flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-navy">Privacy</p>
            <p className="text-xs text-mist mt-1">
              Your profile information is only visible to you and your former
              employer.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
