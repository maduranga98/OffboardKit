import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { showToast } from "../ui/Toast";
import {
  setDocument,
  updateDocument,
  serverTimestamp,
} from "../../lib/firestore";
import type { AlumniAnnouncement } from "../../types/alumniAnnouncements";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  createdBy: string;
  createdByName: string;
  editingAnnouncement?: AlumniAnnouncement | null;
  onSaved: (announcement: AlumniAnnouncement) => void;
}

type AnnouncementType = AlumniAnnouncement["type"];

const TYPE_OPTIONS: { value: AnnouncementType; emoji: string; label: string }[] = [
  { value: "news",      emoji: "📢", label: "News" },
  { value: "roles",     emoji: "💼", label: "Roles" },
  { value: "milestone", emoji: "🎉", label: "Milestone" },
  { value: "event",     emoji: "📅", label: "Event" },
];

const EMPTY_FORM = {
  type: "news" as AnnouncementType,
  title: "",
  content: "",
  ctaLabel: "",
  ctaUrl: "",
  eventDate: "",
  eventLocation: "",
  audience: "opted_in_only" as AlumniAnnouncement["audience"],
};

export function CreateAnnouncementModal({
  isOpen,
  onClose,
  companyId,
  createdBy,
  createdByName,
  editingAnnouncement,
  onSaved,
}: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  useEffect(() => {
    if (editingAnnouncement) {
      setForm({
        type: editingAnnouncement.type,
        title: editingAnnouncement.title,
        content: editingAnnouncement.content,
        ctaLabel: editingAnnouncement.ctaLabel ?? "",
        ctaUrl: editingAnnouncement.ctaUrl ?? "",
        eventDate: editingAnnouncement.eventDate
          ? new Date(editingAnnouncement.eventDate.toDate()).toISOString().slice(0, 16)
          : "",
        eventLocation: editingAnnouncement.eventLocation ?? "",
        audience: editingAnnouncement.audience,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editingAnnouncement, isOpen]);

  function validate(): string | null {
    if (!form.title.trim()) return "Title is required.";
    if (!form.content.trim()) return "Content is required.";
    if (form.ctaLabel.trim() && !form.ctaUrl.trim())
      return "Link URL is required when Button Text is set.";
    if (!form.ctaLabel.trim() && form.ctaUrl.trim())
      return "Button Text is required when Link URL is set.";
    return null;
  }

  async function handleSave(status: "draft" | "published") {
    const err = validate();
    if (err) { showToast("error", err); return; }

    setSaving(status === "published" ? "publish" : "draft");
    try {
      const id = editingAnnouncement?.id ?? crypto.randomUUID();
      const now = serverTimestamp();

      const shared = {
        type: form.type,
        title: form.title.trim(),
        content: form.content.trim(),
        ctaLabel: form.ctaLabel.trim() || null,
        ctaUrl: form.ctaUrl.trim() || null,
        eventDate:
          form.type === "event" && form.eventDate
            ? new Date(form.eventDate)
            : null,
        eventLocation:
          form.type === "event" ? form.eventLocation.trim() || null : null,
        audience: form.audience,
        status,
        publishedAt: status === "published" ? now : null,
        updatedAt: now,
      };

      if (editingAnnouncement) {
        await updateDocument("alumniAnnouncements", id, shared);
      } else {
        await setDocument("alumniAnnouncements", id, {
          id,
          companyId,
          ...shared,
          readCount: 0,
          createdBy,
          createdByName,
          createdAt: now,
        });
      }

      // Pass a synthetic object back — parent will re-fetch or merge
      const optimistic: AlumniAnnouncement = {
        id,
        companyId,
        type: form.type,
        title: form.title.trim(),
        content: form.content.trim(),
        ctaLabel: form.ctaLabel.trim() || null,
        ctaUrl: form.ctaUrl.trim() || null,
        eventDate: null,
        eventLocation: form.type === "event" ? form.eventLocation.trim() || null : null,
        audience: form.audience,
        status,
        readCount: editingAnnouncement?.readCount ?? 0,
        publishedAt: null,
        createdBy,
        createdByName,
        createdAt: editingAnnouncement?.createdAt ?? (null as unknown as AlumniAnnouncement["createdAt"]),
        updatedAt: null as unknown as AlumniAnnouncement["updatedAt"],
      };

      onSaved(optimistic);
      onClose();
    } catch {
      showToast("error", "Failed to save announcement.");
    } finally {
      setSaving(null);
    }
  }

  const titleLen = form.title.length;
  const contentLen = form.content.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAnnouncement ? "Edit Announcement" : "New Announcement"}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            onClick={() => handleSave("draft")}
            loading={saving === "draft"}
            disabled={saving !== null}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSave("published")}
            loading={saving === "publish"}
            disabled={saving !== null}
          >
            Publish Now
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Type selector */}
        <div>
          <label className="block text-sm font-medium text-navy mb-2">Type</label>
          <div className="flex gap-2 flex-wrap">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, type: opt.value }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  form.type === opt.value
                    ? "bg-navy text-white border-navy"
                    : "bg-white text-navy border-navy/20 hover:border-navy/40"
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-navy">Title *</label>
            <span className={`text-xs ${titleLen > 90 ? "text-ember" : "text-mist"}`}>
              {titleLen}/100
            </span>
          </div>
          <Input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value.slice(0, 100) }))}
            placeholder="Announcement title"
          />
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-navy">Content *</label>
            <span className={`text-xs ${contentLen > 1800 ? "text-ember" : "text-mist"}`}>
              {contentLen}/2000
            </span>
          </div>
          <textarea
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value.slice(0, 2000) }))}
            rows={6}
            placeholder="Write your announcement..."
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
          />
        </div>

        {/* CTA */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Button Text"
            value={form.ctaLabel}
            onChange={(e) => setForm((p) => ({ ...p, ctaLabel: e.target.value }))}
            placeholder='e.g. "Learn More"'
          />
          <Input
            label="Link URL"
            value={form.ctaUrl}
            onChange={(e) => setForm((p) => ({ ...p, ctaUrl: e.target.value }))}
            placeholder="https://..."
          />
        </div>

        {/* Event fields */}
        {form.type === "event" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Event Date</label>
              <input
                type="datetime-local"
                value={form.eventDate}
                onChange={(e) => setForm((p) => ({ ...p, eventDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
              />
            </div>
            <Input
              label="Event Location"
              value={form.eventLocation}
              onChange={(e) => setForm((p) => ({ ...p, eventLocation: e.target.value }))}
              placeholder="e.g. Zoom, London Office, Virtual"
            />
          </div>
        )}

        {/* Audience */}
        <div>
          <label className="block text-sm font-medium text-navy mb-2">Audience</label>
          <div className="space-y-2">
            {(
              [
                { value: "all", label: "All Alumni (including non-opted-in)" },
                { value: "opted_in_only", label: "Opted-in Alumni Only" },
              ] as const
            ).map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="audience"
                  value={opt.value}
                  checked={form.audience === opt.value}
                  onChange={() => setForm((p) => ({ ...p, audience: opt.value }))}
                  className="h-4 w-4 text-teal border-navy/20 focus:ring-teal/50"
                />
                <span className="text-sm text-navy">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
