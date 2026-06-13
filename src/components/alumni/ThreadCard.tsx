import { useState, useEffect, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy as fbOrderBy,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  updateDocument,
  serverTimestamp,
} from "../../lib/firestore";
import { User, BookOpen, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Timestamp } from "firebase/firestore";
import clsx from "clsx";
import type { KnowledgeThread, KnowledgeMessage } from "../../types/knowledgeThreads.types";

interface Props {
  thread: KnowledgeThread;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: (threadId: string) => void;
  hrUserId: string;
  hrUserName: string;
}

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

const STATUS_STYLES = {
  open: "bg-teal/10 text-teal",
  answered: "bg-green-50 text-green-700",
  closed: "bg-navy/5 text-mist",
};

export function ThreadCard({ thread, isExpanded, onToggle, onClose, hrUserId, hrUserName }: Props) {
  const [messages, setMessages] = useState<KnowledgeMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchMessages() {
    try {
      const q = query(
        collection(db, "knowledgeThreads", thread.id, "messages"),
        fbOrderBy("createdAt", "asc")
      );
      const snap = await getDocs(q);
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KnowledgeMessage);
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  useEffect(() => {
    if (!isExpanded) {
      setMessages([]);
      setReplyText("");
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    setLoadingMessages(true);
    fetchMessages().finally(() => setLoadingMessages(false));

    intervalRef.current = setInterval(fetchMessages, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isExpanded, thread.id]);

  async function handleSendReply() {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const { doc: fbDoc, collection: fbCollection, setDoc } = await import("firebase/firestore");
      const { db: fireDb } = await import("../../lib/firebase");
      const msgId = crypto.randomUUID();
      await setDoc(
        fbDoc(fbCollection(fireDb, "knowledgeThreads", thread.id, "messages"), msgId),
        {
          id: msgId,
          threadId: thread.id,
          content: replyText.trim(),
          senderType: "hr",
          senderId: hrUserId,
          senderName: hrUserName,
          createdAt: serverTimestamp(),
        }
      );
      await updateDocument("knowledgeThreads", thread.id, {
        messageCount: (thread.messageCount ?? 0) + messages.length + 1,
        lastMessageAt: serverTimestamp(),
        lastMessageBy: "hr",
        status: "open",
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

  async function handleCloseThread() {
    try {
      await updateDocument("knowledgeThreads", thread.id, {
        status: "closed",
        updatedAt: serverTimestamp(),
      });
      onClose(thread.id);
    } catch (err) {
      console.error("Failed to close thread:", err);
    }
  }

  return (
    <div className="bg-white border border-navy/10 rounded-xl overflow-hidden">
      {/* Collapsed header — always visible */}
      <div
        className="p-4 cursor-pointer hover:bg-navy/[0.02] transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className={clsx(
              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize",
              STATUS_STYLES[thread.status]
            )}
          >
            {thread.status}
          </span>
          <span className="text-xs text-mist">{timeAgo(thread.lastMessageAt)}</span>
        </div>
        <p className="text-sm font-semibold text-navy line-clamp-2 mb-2">
          {thread.subject}
        </p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-xs text-mist">
            <User size={12} />
            To: {thread.alumniName}
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

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-navy/5 px-4">
          {/* Messages */}
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
                const isHr = msg.senderType === "hr";
                return (
                  <div key={msg.id} className={clsx("flex", isHr ? "justify-end" : "justify-start")}>
                    <div
                      className={clsx(
                        "px-4 py-2.5 max-w-[80%]",
                        isHr
                          ? "bg-teal/10 rounded-xl rounded-tr-sm"
                          : "bg-navy/5 rounded-xl rounded-tl-sm"
                      )}
                    >
                      <p className={clsx("text-xs text-mist mb-1", isHr ? "text-right" : "")}>
                        {isHr ? `You · ${timeAgo(msg.createdAt)}` : `${thread.alumniName} · ${timeAgo(msg.createdAt)}`}
                      </p>
                      <p className="text-sm text-navy">{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Reply box */}
          {thread.status !== "closed" && (
            <div className="pb-3 space-y-2">
              <textarea
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value.slice(0, 1000))}
                placeholder="Type your follow-up..."
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

          {/* Close thread */}
          {thread.status !== "closed" && (
            <div className="pb-3 border-t border-navy/5 pt-2">
              <button
                onClick={handleCloseThread}
                className="text-xs text-mist hover:text-navy transition-colors"
              >
                Close Thread
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
