import { useState, useEffect, useCallback } from "react";
import { MessageCircle } from "lucide-react";
import clsx from "clsx";
import { queryDocuments, where, orderBy } from "../../lib/firestore";
import { ThreadCard } from "../../components/alumni/ThreadCard";
import { useAuth } from "../../hooks/useAuth";
import { Card } from "../../components/ui/Card";
import type { KnowledgeThread, ThreadStatus } from "../../types/knowledgeThreads.types";

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
    loadThreads();

    const interval = setInterval(loadThreads, 60_000);
    function onFocus() { loadThreads(); }
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadThreads]);

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
  const hrUserName = appUser?.name ?? "HR Team";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display text-navy">Expert Threads</h2>
        <p className="text-sm text-mist mt-0.5">Post-departure knowledge questions</p>
      </div>

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
