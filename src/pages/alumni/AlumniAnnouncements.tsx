import { useState, useEffect, useCallback } from "react";
import { Megaphone, Plus } from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { showToast } from "../../components/ui/Toast";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { CreateAnnouncementModal } from "../../components/alumni/CreateAnnouncementModal";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  updateDocument,
  deleteDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type { AlumniAnnouncement } from "../../types/alumniAnnouncements";
import { ANNOUNCEMENT_TYPE_CONFIG } from "../../types/alumniAnnouncements";
import type { Timestamp } from "firebase/firestore";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

type StatusTab = "all" | "published" | "draft";

export default function AlumniAnnouncements() {
  const { companyId, appUser } = useAuth();
  const [announcements, setAnnouncements] = useState<AlumniAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AlumniAnnouncement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await queryDocuments<AlumniAnnouncement>("alumniAnnouncements", [
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc"),
      ]);
      setAnnouncements(data);
    } catch {
      showToast("error", "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadAnnouncements(); }, [loadAnnouncements]);

  async function handlePublish(a: AlumniAnnouncement) {
    setTogglingId(a.id);
    try {
      await updateDocument("alumniAnnouncements", a.id, {
        status: "published",
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAnnouncements((prev) =>
        prev.map((x) => x.id === a.id ? { ...x, status: "published" } : x)
      );
      showToast("success", "Announcement published.");
    } catch {
      showToast("error", "Failed to publish.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleUnpublish(a: AlumniAnnouncement) {
    setTogglingId(a.id);
    try {
      await updateDocument("alumniAnnouncements", a.id, {
        status: "draft",
        publishedAt: null,
        updatedAt: serverTimestamp(),
      });
      setAnnouncements((prev) =>
        prev.map((x) => x.id === a.id ? { ...x, status: "draft" } : x)
      );
      showToast("success", "Announcement unpublished.");
    } catch {
      showToast("error", "Failed to unpublish.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(a: AlumniAnnouncement) {
    if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    setDeletingId(a.id);
    try {
      await deleteDocument("alumniAnnouncements", a.id);
      setAnnouncements((prev) => prev.filter((x) => x.id !== a.id));
      showToast("success", "Announcement deleted.");
    } catch {
      showToast("error", "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(saved: AlumniAnnouncement) {
    setAnnouncements((prev) => {
      const idx = prev.findIndex((x) => x.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }

  const published = announcements.filter((a) => a.status === "published");
  const drafts = announcements.filter((a) => a.status === "draft");
  const totalReads = announcements.reduce((sum, a) => sum + (a.readCount ?? 0), 0);

  const filtered =
    activeTab === "published" ? published :
    activeTab === "draft" ? drafts :
    announcements;

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display text-navy">Announcements</h2>
          <p className="text-sm text-mist mt-0.5">Share updates with your alumni network</p>
        </div>
        <Button onClick={() => { setEditingAnnouncement(null); setShowCreateModal(true); }}>
          <Plus size={14} className="mr-1.5" />
          New Announcement
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="space-y-1">
            <p className="text-xs font-medium text-mist">Total Published</p>
            <p className="text-2xl font-semibold text-navy">{published.length}</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-1">
            <p className="text-xs font-medium text-mist">Total Reads</p>
            <p className="text-2xl font-semibold text-teal">{totalReads}</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-1">
            <p className="text-xs font-medium text-mist">Drafts</p>
            <p className="text-2xl font-semibold text-navy">{drafts.length}</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy/5 rounded-md p-1 w-fit">
        {(["all", "published", "draft"] as StatusTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
              activeTab === tab ? "bg-white text-navy shadow-sm" : "text-mist hover:text-navy"
            )}
          >
            {tab === "all" ? "All" : tab === "published" ? "Published" : "Drafts"}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Megaphone size={32} className="text-mist mx-auto" />
          <p className="text-sm text-mist">
            No announcements yet. Share a company update with your alumni.
          </p>
          <Button onClick={() => { setEditingAnnouncement(null); setShowCreateModal(true); }}>
            <Plus size={14} className="mr-1.5" />
            New Announcement
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const typeConfig = ANNOUNCEMENT_TYPE_CONFIG[a.type];
            const publishedDate = toDate(a.publishedAt);
            const eventDateObj = toDate(a.eventDate);
            const isToggling = togglingId === a.id;
            const isDeleting = deletingId === a.id;

            return (
              <div
                key={a.id}
                className="bg-white border border-navy/10 rounded-xl p-4 space-y-3"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${typeConfig.color}`}>
                      {typeConfig.label}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        a.status === "published"
                          ? "bg-green-50 text-green-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {a.status === "published" ? "Published" : "Draft"}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs bg-navy/5 text-navy rounded-full">
                      {a.audience === "all" ? "All Alumni" : "Opted-in Only"}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <p className="font-semibold text-navy text-sm">{a.title}</p>

                {/* Content preview */}
                <p className="text-xs text-mist line-clamp-2">
                  {a.content.length > 120 ? a.content.slice(0, 120) + "…" : a.content}
                </p>

                {/* Event details */}
                {a.type === "event" && (eventDateObj || a.eventLocation) && (
                  <p className="text-xs text-mist">
                    {eventDateObj ? format(eventDateObj, "MMM d, yyyy h:mm a") : ""}
                    {eventDateObj && a.eventLocation ? " · " : ""}
                    {a.eventLocation ?? ""}
                  </p>
                )}

                {/* Metadata + actions */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-mist">
                    By {a.createdByName}
                    {publishedDate ? ` · ${format(publishedDate, "MMM d, yyyy")}` : ""}
                    {" · "}{a.readCount ?? 0} reads
                  </p>
                  <div className="flex items-center gap-1.5">
                    {a.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => handlePublish(a)}
                        loading={isToggling}
                        disabled={isToggling || isDeleting}
                      >
                        Publish
                      </Button>
                    )}
                    {a.status === "published" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnpublish(a)}
                        loading={isToggling}
                        disabled={isToggling || isDeleting}
                      >
                        Unpublish
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setEditingAnnouncement(a); setShowCreateModal(true); }}
                      disabled={isToggling || isDeleting}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(a)}
                      loading={isDeleting}
                      disabled={isToggling || isDeleting}
                      className="text-ember hover:text-ember/80"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateAnnouncementModal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setEditingAnnouncement(null); }}
        companyId={companyId ?? ""}
        createdBy={appUser?.id ?? ""}
        createdByName={appUser?.name ?? ""}
        editingAnnouncement={editingAnnouncement}
        onSaved={handleSaved}
      />
    </div>
  );
}
