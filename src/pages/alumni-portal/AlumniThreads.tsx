import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy as fbOrderBy,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  queryDocuments,
  updateDocument,
  getDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import { MessageCircle, BookOpen, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Timestamp } from "firebase/firestore";
import clsx from "clsx";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import type { KnowledgeThread, KnowledgeMessage } from "../../types/knowledgeThreads.types";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

function timeAgo(ts: Timestamp | null | undefined): string {
  const d = toDate(ts);
  if (!d) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

function isUnread(thread: KnowledgeThread, alumniId: string): boolean {
  if (thread.lastMessageBy !== "hr") return false;
  const key = `alumni_thread_read_${alumniId}_${thread.id}`;
  const stored = localStorage.getItem(key);
  if (!stored) return true;
  const readAt = new Date(stored);
  const updatedAt = toDate(thread.updatedAt);
  if (!updatedAt) return false;
  return updatedAt > readAt;
}

interface ThreadItemProps {
  thread: KnowledgeThread;
  alumniId: string;
  alumniName: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function ThreadItem({ thread, alumniId, alumniName, isExpanded, onToggle }: ThreadItemProps) {
  const [messages, setMessages] = useState<KnowledgeMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const unread = isUnread(thread, alumniId);

  async function fetchMessages() {
    try {
      const q = query(
        collection(db, "knowledgeThreads", thread.id, "messages"),
        fbOrderBy("createdAt", "asc")
      );
      const snap = await getDocs(q);
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KnowledgeMessage));
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  useEffect(() => {
    if (!isExpanded) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    fetchMessages().finally(() => setLoadingMessages(false));

    // Mark as read
    localStorage.setItem(
      `alumni_thread_read_${alumniId}_${thread.id}`,
      new Date().toISOString()
    );
  }, [isExpanded, thread.id, alumniId]);

  async function handleSendReply() {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const msgId = crypto.randomUUID();
      await setDoc(
        doc(collection(db, "knowledgeThreads", thread.id, "messages"), msgId),
        {
          id: msgId,
          threadId: thread.id,
          content: replyText.trim(),
          senderType: "alumni",
          senderId: alumniId,
          senderName: alumniName,
          createdAt: serverTimestamp(),
        }
      );
      await updateDocument("knowledgeThreads", thread.id, {
        lastMessageBy: "alumni",
        status: "answered",
        lastMessageAt: serverTimestamp(),
        messageCount: messages.length + 1,
        updatedAt: serverTimestamp(),
      });
      setReplyText("");
      await fetchMessages();
    } catch (err) {
      console.error("Failed to send reply:", err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white border border-navy/10 rounded-xl overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-navy/[0.02] transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {unread && (
              <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
            )}
            <span
              className={clsx(
                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize",
                thread.status === "open" && "bg-teal/10 text-teal",
                thread.status === "answered" && "bg-green-50 text-green-700",
                thread.status === "closed" && "bg-navy/5 text-mist"
              )}
            >
              {thread.status}
            </span>
          </div>
          <span className="text-xs text-mist">{timeAgo(thread.lastMessageAt)}</span>
        </div>
        <p className="text-sm font-semibold text-navy line-clamp-2 mb-2">{thread.subject}</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-xs text-mist">
            <User size={12} />
            From: {thread.createdByName}
          </span>
          {thread.knowledgeItemTitle && (
            <span className="flex items-center gap-1 text-xs text-mist truncate max-w-[160px]">
              <BookOpen size={12} />
              Re: {thread.knowledgeItemTitle}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-mist">
            <MessageCircle size={12} />
            {thread.messageCount} messages
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-navy/5 px-4">
          <div className="space-y-3 py-3">
            {loadingMessages ? (
              <div className="space-y-2">
                {[1, 2].map((n) => (
                  <div key={n} className="h-12 bg-navy/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <p className="text-xs text-mist text-center py-2">No messages yet.</p>
            ) : (
              messages.map((msg) => {
                const isAlumni = msg.senderType === "alumni";
                return (
                  <div key={msg.id} className={clsx("flex", isAlumni ? "justify-end" : "justify-start")}>
                    <div
                      className={clsx(
                        "px-4 py-2.5 max-w-[80%]",
                        isAlumni
                          ? "bg-teal/10 rounded-xl rounded-tr-sm"
                          : "bg-navy/5 rounded-xl rounded-tl-sm"
                      )}
                    >
                      <p className={clsx("text-xs text-mist mb-1", isAlumni ? "text-right" : "")}>
                        {isAlumni
                          ? `You · ${timeAgo(msg.createdAt)}`
                          : `${thread.createdByName} · ${timeAgo(msg.createdAt)}`}
                      </p>
                      <p className="text-sm text-navy">{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {thread.status !== "closed" && (
            <div className="pb-3 space-y-2">
              <textarea
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value.slice(0, 1000))}
                placeholder="Type your reply…"
                className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-mist">{replyText.length}/1000</span>
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || sending}
                  className="px-3 py-1.5 text-xs font-medium bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? "Sending…" : "Send Reply"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlumniThreads() {
  const { alumniProfile } = useAlumniAuth();
  const [threads, setThreads] = useState<KnowledgeThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");

  const loadThreads = useCallback(async () => {
    if (!alumniProfile) return;
    try {
      const data = await queryDocuments<KnowledgeThread>("knowledgeThreads", [
        where("alumniId", "==", alumniProfile.id),
        where("companyId", "==", alumniProfile.companyId),
        orderBy("lastMessageAt", "desc"),
      ]);
      setThreads(data);
    } catch (err) {
      console.error("Failed to load threads:", err);
    } finally {
      setLoading(false);
    }
  }, [alumniProfile]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!alumniProfile?.companyId) return;
    getDocument<{ name: string }>("companies", alumniProfile.companyId).then((company) => {
      if (company?.name) setCompanyName(company.name);
    }).catch(() => {});
  }, [alumniProfile?.companyId]);

  if (!alumniProfile) return null;
  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-navy">
          Questions from {companyName || "your former company"}
        </h1>
        <p className="text-sm text-mist mt-1">
          Former colleagues have follow-up questions about your work
        </p>
      </div>

      {threads.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <MessageCircle size={32} className="text-navy/20" />
          <p className="text-sm text-mist font-medium">No questions yet.</p>
          <p className="text-xs text-mist">
            When your former colleagues have questions about your work, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <ThreadItem
              key={t.id}
              thread={t}
              alumniId={alumniProfile.id}
              alumniName={alumniProfile.name}
              isExpanded={expandedId === t.id}
              onToggle={() => setExpandedId((prev) => (prev === t.id ? null : t.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
