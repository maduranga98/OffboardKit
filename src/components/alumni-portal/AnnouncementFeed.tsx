import { useState, useEffect, useCallback } from "react";
import {
  Megaphone, Briefcase, Trophy, Calendar, ChevronDown, ChevronUp, ExternalLink,
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

      const visible = all.filter((a) =>
        a.audience === "all" || alumniProfile.optedIn === true
      );

      setAnnouncements(visible);
      setReadIds(new Set(reads.map((r) => r.announcementId)));
    } catch {
      // silently fail — errors show as empty state
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
        // ignore — read tracking is best-effort
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader companyName={companyName} unreadCount={0} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-navy/10 rounded-2xl p-5 animate-pulse space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 bg-navy/8 rounded-full" />
            </div>
            <div className="h-4 w-3/4 bg-navy/8 rounded-md" />
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-navy/8 rounded" />
              <div className="h-3 w-2/3 bg-navy/8 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const unreadCount = announcements.filter((a) => !readIds.has(a.id)).length;

  if (announcements.length === 0) {
    return (
      <div className="space-y-4">
        <SectionHeader companyName={companyName} unreadCount={0} />
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-white border border-navy/10 rounded-2xl text-center">
          <div className="w-12 h-12 rounded-full bg-navy/5 flex items-center justify-center mb-3">
            <Megaphone size={22} className="text-mist" />
          </div>
          <p className="text-sm font-medium text-navy">No updates yet</p>
          <p className="text-xs text-mist mt-1">
            {companyName} hasn't posted any announcements yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionHeader companyName={companyName} unreadCount={unreadCount} />
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
              onClick={() => handleExpand(a)}
              className="bg-white border border-navy/10 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:border-navy/20 hover:shadow-sm active:scale-[0.995]"
            >
              {/* Unread accent bar */}
              {isUnread && (
                <div className="h-0.5 w-full bg-gradient-to-r from-teal to-teal/30" />
              )}

              <div className="p-4 sm:p-5">
                {/* Header row */}
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${typeConfig.color}`}>
                    <IconComponent size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Type + unread + date */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        {isUnread && (
                          <span className="w-1.5 h-1.5 bg-teal rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-mist flex-shrink-0">
                        {publishedDate ? format(publishedDate, "MMM d") : ""}
                      </span>
                    </div>

                    {/* Title */}
                    <p className={`font-semibold text-navy leading-snug ${isExpanded ? "text-base" : "text-sm"}`}>
                      {a.title}
                    </p>

                    {!isExpanded ? (
                      /* Collapsed preview */
                      <p className="text-xs text-mist mt-1.5 line-clamp-2 leading-relaxed">
                        {a.content}
                      </p>
                    ) : (
                      /* Expanded full content */
                      <div className="mt-3 space-y-4">
                        <p className="text-sm text-navy/80 whitespace-pre-wrap leading-relaxed">
                          {a.content}
                        </p>

                        {/* Event details */}
                        {a.type === "event" && (eventDateObj || a.eventLocation) && (
                          <div
                            className="bg-teal/5 border border-teal/15 rounded-xl px-4 py-3 space-y-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {eventDateObj && (
                              <div className="flex items-center gap-2 text-sm font-medium text-navy">
                                <Calendar size={14} className="text-teal flex-shrink-0" />
                                {format(eventDateObj, "MMMM d, yyyy · h:mm a")}
                              </div>
                            )}
                            {a.eventLocation && (
                              <p className="text-xs text-mist pl-5">{a.eventLocation}</p>
                            )}
                          </div>
                        )}

                        {/* CTA button */}
                        {a.ctaLabel && a.ctaUrl && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(a.ctaUrl!, "_blank", "noopener")}
                              className="gap-1.5"
                            >
                              {a.ctaLabel}
                              <ExternalLink size={12} />
                            </Button>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-navy/5">
                          <span className="text-xs text-mist">
                            {publishedDate
                              ? formatDistanceToNow(publishedDate, { addSuffix: true })
                              : "recently"}
                          </span>
                          <span className="text-navy/20 text-xs">·</span>
                          <span className="text-xs text-mist">{a.createdByName}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expand/collapse chevron */}
                <div className="flex justify-center mt-3 -mb-1">
                  {isExpanded
                    ? <ChevronUp size={14} className="text-mist" />
                    : <ChevronDown size={14} className="text-mist" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({ companyName, unreadCount }: { companyName: string; unreadCount: number }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-navy">From {companyName}</p>
      {unreadCount > 0 && (
        <span className="text-xs bg-teal/10 text-teal font-medium px-2 py-0.5 rounded-full">
          {unreadCount} new
        </span>
      )}
    </div>
  );
}
