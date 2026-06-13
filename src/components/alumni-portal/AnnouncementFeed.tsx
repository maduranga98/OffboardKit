import { useState, useEffect, useCallback } from "react";
import {
  Megaphone, Briefcase, Trophy, Calendar, ChevronDown, ChevronUp
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "../ui/Button";
import {
  queryDocuments,
  setDocument,
  updateDocument,
  serverTimestamp,
  where,
  orderBy,
  limit,
} from "../../lib/firestore";
import type { AlumniProfile } from "../../types/alumni.types";
import type { AlumniAnnouncement, AlumniAnnouncementRead } from "../../types/alumniAnnouncements";
import { ANNOUNCEMENT_TYPE_CONFIG } from "../../types/alumniAnnouncements";
import type { Timestamp } from "firebase/firestore";
import clsx from "clsx";

const TYPE_ICONS = { Megaphone, Briefcase, Trophy, Calendar } as const;

interface Props {
  alumniProfile: AlumniProfile;
  companyName: string;
  onUnreadCountChange?: (count: number) => void;
}

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

export function AnnouncementFeed({ alumniProfile, companyName, onUnreadCountChange }: Props) {
  const [announcements, setAnnouncements] = useState<AlumniAnnouncement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [all, reads] = await Promise.all([
        queryDocuments<AlumniAnnouncement>("alumniAnnouncements", [
          where("companyId", "==", alumniProfile.companyId),
          where("status", "==", "published"),
          orderBy("publishedAt", "desc"),
          limit(20),
        ]),
        queryDocuments<AlumniAnnouncementRead>("alumniAnnouncementReads", [
          where("alumniId", "==", alumniProfile.id),
          where("companyId", "==", alumniProfile.companyId),
        ]),
      ]);

      const visible = all.filter((a) => {
        if (a.audience === "all") return true;
        return alumniProfile.optedIn === true;
      });

      setAnnouncements(visible);
      setReadIds(new Set(reads.map((r) => r.announcementId)));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [alumniProfile.companyId, alumniProfile.id, alumniProfile.optedIn]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const count = announcements.filter((a) => !readIds.has(a.id)).length;
    onUnreadCountChange?.(count);
  }, [announcements, readIds, onUnreadCountChange]);

  async function handleExpand(a: AlumniAnnouncement) {
    const isExpanding = expandedId !== a.id;
    setExpandedId(isExpanding ? a.id : null);

    if (isExpanding && !readIds.has(a.id)) {
      // Optimistic update
      setReadIds((prev) => new Set([...prev, a.id]));

      const readId = `${alumniProfile.id}_${a.id}`;
      try {
        await setDocument("alumniAnnouncementReads", readId, {
          id: readId,
          companyId: alumniProfile.companyId,
          alumniId: alumniProfile.id,
          announcementId: a.id,
          readAt: serverTimestamp(),
        });
        await updateDocument("alumniAnnouncements", a.id, {
          readCount: (a.readCount ?? 0) + 1,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // ignore
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-navy mb-3">From {companyName}</p>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-navy/10 rounded-xl p-4 animate-pulse space-y-2">
            <div className="h-3 w-24 bg-navy/10 rounded" />
            <div className="h-4 w-3/4 bg-navy/10 rounded" />
            <div className="h-3 w-full bg-navy/10 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-navy mb-3">From {companyName}</p>
        <div className="text-center py-8">
          <Megaphone size={32} className="text-mist mx-auto mb-2" />
          <p className="text-sm text-mist">No updates yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-navy mb-3">From {companyName}</p>
      <div className="space-y-3">
        {announcements.map((a) => {
          const typeConfig = ANNOUNCEMENT_TYPE_CONFIG[a.type];
          const IconComponent = TYPE_ICONS[typeConfig.icon as keyof typeof TYPE_ICONS];
          const isExpanded = expandedId === a.id;
          const isUnread = !readIds.has(a.id);
          const publishedDate = toDate(a.publishedAt);
          const eventDateObj = toDate(a.eventDate);

          return (
            <div
              key={a.id}
              className="bg-white border border-navy/10 rounded-xl p-4 cursor-pointer transition-shadow hover:shadow-sm"
              onClick={() => handleExpand(a)}
            >
              {/* Row 1: type badge + unread dot */}
              <div className="flex items-center justify-between mb-1.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${typeConfig.color}`}>
                  <IconComponent size={10} />
                  {typeConfig.label}
                </span>
                {isUnread && (
                  <span className="w-2 h-2 bg-teal rounded-full flex-shrink-0" />
                )}
              </div>

              {/* Row 2: title */}
              <p className={clsx("text-sm font-semibold text-navy", isExpanded ? "text-base" : "")}>
                {a.title}
              </p>

              {!isExpanded ? (
                <>
                  {/* Row 3: preview */}
                  <p className="text-xs text-mist mt-1 line-clamp-2">
                    {a.content.length > 80 ? a.content.slice(0, 80) + "…" : a.content}
                  </p>
                  {/* Row 4: date */}
                  {publishedDate && (
                    <p className="text-xs text-mist mt-1">
                      {format(publishedDate, "MMM d, yyyy")}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* Full content */}
                  <p className="text-sm text-mist mt-2 whitespace-pre-wrap">{a.content}</p>

                  {/* Event details */}
                  {a.type === "event" && (eventDateObj || a.eventLocation) && (
                    <div className="bg-teal/5 rounded-lg px-3 py-2 text-sm mt-3">
                      {eventDateObj && (
                        <p className="text-navy font-medium">
                          📅 {format(eventDateObj, "MMM d, yyyy · h:mm a")}
                        </p>
                      )}
                      {a.eventLocation && (
                        <p className="text-mist text-xs mt-0.5">📍 {a.eventLocation}</p>
                      )}
                    </div>
                  )}

                  {/* CTA */}
                  {a.ctaLabel && a.ctaUrl && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); window.open(a.ctaUrl!, "_blank"); }}
                      >
                        {a.ctaLabel}
                      </Button>
                    </div>
                  )}

                  {/* Footer */}
                  <p className="text-xs text-mist mt-3">
                    Posted {publishedDate ? formatDistanceToNow(publishedDate, { addSuffix: true }) : "recently"} by {a.createdByName}
                  </p>
                </>
              )}

              {/* Expand/collapse indicator */}
              <div className="flex justify-center mt-2 text-mist">
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
