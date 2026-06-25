import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Plus, FileText, X, Edit2, Trash2 } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import type { LetterTemplate, LetterType } from "../../../types/letter.types";

const LETTER_TYPES: { value: LetterType; label: string; badgeClass: string }[] = [
  { value: "reference", label: "Reference Letter", badgeClass: "bg-teal-100 text-teal-700" },
  { value: "experience", label: "Experience Letter", badgeClass: "bg-blue-100 text-blue-700" },
  { value: "employment_verification", label: "Employment Verification", badgeClass: "bg-amber-100 text-amber-700" },
];

const DEFAULT_SUBJECTS: Record<LetterType, string> = {
  reference: "RE: Reference Letter for {{employee_name}}",
  experience: "RE: Experience Certificate for {{employee_name}}",
  employment_verification: "RE: Employment Verification for {{employee_name}}",
};

const DEFAULT_BODIES: Record<LetterType, string> = {
  reference: `This letter is to confirm that {{employee_name}} was employed at {{company_name}} as {{role}} until {{exit_date}}.

During their tenure, {{employee_name}} demonstrated exceptional professionalism and made significant contributions to our team.

We highly recommend {{employee_name}} for any future opportunities and wish them the very best in their career.`,

  experience: `This is to certify that {{employee_name}} was employed with {{company_name}} as {{role}} in the {{department}} department until {{exit_date}}.

During this period, {{employee_name}} performed their duties diligently and was a valued member of our organization.

We wish {{employee_name}} all the best in their future endeavors.`,

  employment_verification: `This letter verifies that {{employee_name}} was employed at {{company_name}} in the capacity of {{role}} until {{exit_date}}.

This letter is issued upon the request of the individual named above for whatever purpose it may serve.

For further verification, please contact our Human Resources department.`,
};

const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "{{employee_name}}", label: "Employee Name" },
  { key: "{{role}}", label: "Job Role" },
  { key: "{{department}}", label: "Department" },
  { key: "{{exit_date}}", label: "Exit Date" },
  { key: "{{company_name}}", label: "Company Name" },
  { key: "{{letter_date}}", label: "Letter Date" },
];

const BLANK_FORM = {
  name: "",
  type: "reference" as LetterType,
  subject: DEFAULT_SUBJECTS.reference,
  body: DEFAULT_BODIES.reference,
  closing: "Sincerely,",
};

export default function LetterTemplates() {
  const { companyId } = useAuth();
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LetterTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, "letterTemplates"),
      where("companyId", "==", companyId)
    );
    getDocs(q)
      .then((snap) => {
        setTemplates(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as LetterTemplate))
        );
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  function openCreate() {
    setEditing(null);
    setForm(BLANK_FORM);
    setShowModal(true);
  }

  function openEdit(t: LetterTemplate) {
    setEditing(t);
    setForm({ name: t.name, type: t.type, subject: t.subject, body: t.body, closing: t.closing });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(BLANK_FORM);
  }

  function handleTypeChange(type: LetterType) {
    setForm((prev) => ({
      ...prev,
      type,
      ...(editing
        ? {}
        : { subject: DEFAULT_SUBJECTS[type], body: DEFAULT_BODIES[type] }),
    }));
  }

  function insertPlaceholder(key: string) {
    setForm((prev) => ({ ...prev, body: prev.body + key }));
  }

  async function handleSave() {
    if (!companyId) return;
    setSaving(true);
    try {
      if (editing) {
        const ref = doc(db, "letterTemplates", editing.id);
        await updateDoc(ref, {
          name: form.name,
          type: form.type,
          subject: form.subject,
          body: form.body,
          closing: form.closing,
          updatedAt: serverTimestamp(),
        });
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editing.id
              ? { ...t, name: form.name, type: form.type, subject: form.subject, body: form.body, closing: form.closing }
              : t
          )
        );
      } else {
        const ref = await addDoc(collection(db, "letterTemplates"), {
          companyId,
          name: form.name,
          type: form.type,
          subject: form.subject,
          body: form.body,
          closing: form.closing,
          isDefault: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setTemplates((prev) => [
          ...prev,
          {
            id: ref.id,
            companyId,
            name: form.name,
            type: form.type,
            subject: form.subject,
            body: form.body,
            closing: form.closing,
            isDefault: false,
            createdAt: null as unknown as import("firebase/firestore").Timestamp,
            updatedAt: null as unknown as import("firebase/firestore").Timestamp,
          },
        ]);
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: LetterTemplate) {
    if (!window.confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    setDeleting(t.id);
    try {
      await deleteDoc(doc(db, "letterTemplates", t.id));
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    } finally {
      setDeleting(null);
    }
  }

  function badgeFor(type: LetterType) {
    return LETTER_TYPES.find((lt) => lt.value === type)?.badgeClass ?? "";
  }

  function labelFor(type: LetterType) {
    return LETTER_TYPES.find((lt) => lt.value === type)?.label ?? type;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-navy">Letter Templates</h2>
          <p className="text-sm text-mist">
            Reusable templates for reference, experience and verification letters.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal/90 transition-colors"
        >
          <Plus size={15} /> New Template
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-navy/5 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <FileText size={40} className="text-navy/20" />
          <p className="text-sm text-mist">No templates yet</p>
          <button
            onClick={openCreate}
            className="text-sm text-teal hover:underline font-medium"
          >
            Create your first template
          </button>
        </div>
      )}

      {/* Template grid */}
      {!loading && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-navy/[0.08] rounded-xl p-5 hover:border-teal/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-navy truncate">{t.name}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${badgeFor(t.type)}`}>
                    {labelFor(t.type)}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 text-mist hover:text-navy transition-colors rounded"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    disabled={deleting === t.id}
                    className="p-1.5 text-mist hover:text-ember transition-colors rounded disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-mist line-clamp-2">
                {t.body.replace(/\{\{[^}]+\}\}/g, "…")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy/8">
              <h3 className="text-base font-semibold text-navy">
                {editing ? "Edit Template" : "New Template"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 text-mist hover:text-navy transition-colors rounded"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-navy mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Standard Reference Letter"
                  className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
              </div>

              {/* Letter Type */}
              <div>
                <label className="block text-sm font-medium text-navy mb-2">
                  Letter Type
                </label>
                <div className="flex gap-2 flex-wrap">
                  {LETTER_TYPES.map((lt) => (
                    <button
                      key={lt.value}
                      onClick={() => handleTypeChange(lt.value)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                        form.type === lt.value
                          ? "border-teal text-teal bg-teal/5"
                          : "border-navy/10 text-mist hover:border-navy/30 hover:text-navy"
                      }`}
                    >
                      {lt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-navy mb-1">
                  Subject / Heading
                  <span className="ml-1.5 text-xs font-normal text-mist">Supports placeholders</span>
                </label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
              </div>

              {/* Placeholders */}
              <div>
                <p className="text-xs font-medium text-mist mb-2">
                  Available Placeholders — click to insert
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => insertPlaceholder(p.key)}
                      className="px-2.5 py-1 font-mono text-xs bg-navy/5 text-navy/70 rounded hover:bg-teal/10 hover:text-teal transition-colors"
                    >
                      {p.key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-navy mb-1">
                  Letter Body
                </label>
                <textarea
                  rows={10}
                  value={form.body}
                  onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  className="w-full px-3 py-2 text-sm font-mono border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
                />
              </div>

              {/* Closing */}
              <div>
                <label className="block text-sm font-medium text-navy mb-1">
                  Closing Line
                </label>
                <input
                  type="text"
                  value={form.closing}
                  onChange={(e) => setForm((p) => ({ ...p, closing: e.target.value }))}
                  placeholder="e.g. Sincerely,"
                  className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-navy/8">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-mist hover:text-navy transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.body.trim()}
                className="px-4 py-2 text-sm font-medium bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : editing ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
