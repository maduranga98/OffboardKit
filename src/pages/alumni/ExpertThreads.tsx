import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { collection, doc, setDoc } from "firebase/firestore";
import clsx from "clsx";
import { queryDocuments, setDocument, serverTimestamp, where, orderBy } from "../../lib/firestore";
import { db } from "../../lib/firebase";
import { ThreadCard } from "../../components/alumni/ThreadCard";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import type { KnowledgeThread, ThreadStatus } from "../../types/knowledgeThreads.types";
import type { AlumniProfile } from "../../types/alumni.types";

interface Props {
  companyId: string;
}

type StatusFilter = "all" | ThreadStatus;

export default function ExpertThreads({ companyId }: Props) {
  const { appUser } = useAuth();
  const [threads, setThreads] = useState<KnowledgeThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewThread, setShowNewThread] = useState(false);
  const [alumniList, setAlumniList] = useState<AlumniProfile[]>([]);
  const [threadAlumniId, setThreadAlumniId] = useState("");
  const [threadQuestion, setThreadQuestion] = useState("");
  const [creatingThread, setCreatingThread] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const data = await queryDocuments<KnowledgeThread>("knowledgeThreads", [
        where("companyId", "==", companyId),
        orderBy("lastMessageAt", "desc"),
      ]);
      setThreads(data);
    } catch (err) {
      console.error("Failed to load threads:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    queryDocuments<AlumniProfile>("alumniProfiles", [
      where("companyId", "==", companyId),
      orderBy("name", "asc"),
    ]).then(setAlumniList).catch(() => {});
  }, [companyId]);

  useEffect(() => {
    loadThreads();

    const interval = setInterval(loadThreads, 60_000);
    function onFocus() { loadThreads(); }
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadThreads]);

  async function handleCreateThread() {
    const alumni = alumniList.find((a) => a.id === threadAlumniId);
    if (!alumni || !threadQuestion.trim()) return;
    setCreatingThread(true);
    try {
      const threadId = crypto.randomUUID();
      const now = serverTimestamp();
      const thread = {
        id: threadId,
        companyId,
        flowId: "",
        alumniId: alumni.id,
        alumniName: alumni.name,
        alumniEmail: alumni.email,
        knowledgeItemId: null,
        knowledgeItemTitle: null,
        subject: threadQuestion.trim(),
        status: "open" as const,
        messageCount: 1,
        lastMessageAt: now,
        lastMessageBy: "hr" as const,
        createdBy: hrUserId,
        createdByName: hrUserName,
        createdAt: now,
        updatedAt: now,
      };
      await setDocument("knowledgeThreads", threadId, thread);
      const msgId = crypto.randomUUID();
      await setDoc(doc(collection(db, "knowledgeThreads", threadId, "messages"), msgId), {
        id: msgId,
        threadId,
        content: threadQuestion.trim(),
        senderType: "hr",
        senderId: hrUserId,
        senderName: hrUserName,
        createdAt: serverTimestamp(),
      });
      setThreads((prev) => [thread as unknown as KnowledgeThread, ...prev]);
      setShowNewThread(false);
      setThreadAlumniId("");
      setThreadQuestion("");
      showToast("success", "Thread started", `Question sent to ${alumni.name}`);
    } catch {
      showToast("error", "Failed to start thread");
    } finally {
      setCreatingThread(false);
    }
  }

  function handleCloseThread(threadId: string) {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, status: "closed" as const } : t))
    );
  }

  const open = threads.filter((t) => t.status === "open").length;
  const awaitingReply = threads.filter((t) => t.lastMessageBy === "alumni").length;
  const closed = threads.filter((t) => t.status === "closed").length;

  const filtered = threads.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.alumniName.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const hrUserId = appUser?.id ?? "";
  const hrUserName = appUser?.displayName ?? "HR Team";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-display text-navy">Expert Threads</h2>
          <p className="text-sm text-mist mt-0.5">Post-departure knowledge questions</p>
        </div>
        <Button onClick={() => setShowNewThread(true)}>
          <Plus size={14} className="mr-1.5" />
          New Thread
        </Button>
      </div>

      <Modal
        isOpen={showNewThread}
        onClose={() => { setShowNewThread(false); setThreadAlumniId(""); setThreadQuestion(""); }}
        title="Start Expert Thread"
        size="md"
        footer={
          <div className="flex justify-end gap-2 pt-4 border-t border-navy/5">
            <Button variant="ghost" onClick={() => setShowNewThread(false)}>Cancel</Button>
            <Button
              onClick={handleCreateThread}
              loading={creatingThread}
              disabled={!threadAlumniId || !threadQuestion.trim()}
            >
              Send Question
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-mist">The alumni will receive an email and can reply in their portal.</p>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Select Alumni <span className="text-ember">*</span></label>
            <select
              value={threadAlumniId}
              onChange={(e) => setThreadAlumniId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
            >
              <option value="">Choose an alumni…</option>
              {alumniList.map((a) => (
                <option key={a.id} value={a.id}>{a.name} — {a.role || a.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Your question <span className="text-ember">*</span></label>
            <textarea
              rows={4}
              value={threadQuestion}
              onChange={(e) => setThreadQuestion(e.target.value.slice(0, 1000))}
              placeholder="e.g. Can you explain how the monthly reconciliation process works?"
              className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
            />
            <p className="text-xs text-mist text-right mt-1">{threadQuestion.length}/1000</p>
          </div>
        </div>
      </Modal>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open", value: open },
          { label: "Awaiting Reply", value: awaitingReply },
          { label: "Closed", value: closed },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-navy/10 rounded-xl p-4">
            <p className="text-2xl font-semibold text-navy">{s.value}</p>
            <p className="text-xs text-mist mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by alumni name or question…"
          className="flex-1 px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
        />
        <div className="flex gap-1 bg-navy/5 rounded-md p-1">
          {(["all", "open", "answered", "closed"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors",
                statusFilter === s ? "bg-white text-navy shadow-sm" : "text-mist hover:text-navy"
              )}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Thread list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 bg-navy/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <MessageCircle size={32} className="text-navy/20" />
          <p className="text-sm text-mist">
            No expert threads yet. Start one from a completed offboarding record.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <ThreadCard
              key={t.id}
              thread={t}
              isExpanded={expandedId === t.id}
              onToggle={() => setExpandedId((prev) => (prev === t.id ? null : t.id))}
              onClose={handleCloseThread}
              hrUserId={hrUserId}
              hrUserName={hrUserName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
