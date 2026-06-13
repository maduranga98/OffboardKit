import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart3, Send, Eye, Edit2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { httpsCallable } from "firebase/functions";
import { Timestamp } from "firebase/firestore";
import clsx from "clsx";
import { functions } from "../../lib/firebase";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { CreateSurveyModal } from "../../components/alumni/CreateSurveyModal";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  updateDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type { PulseSurvey, PulseResponse } from "../../types/pulseSurveys.types";

interface Props {
  companyId: string;
}

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts || typeof (ts as Timestamp).toDate !== "function") return null;
  return (ts as Timestamp).toDate();
}

const SCHEDULE_LABELS: Record<PulseSurvey["schedule"], string> = {
  manual: "Manual only",
  monthly: "Monthly",
  quarterly: "Quarterly",
  biannual: "Bi-annual",
};

const TYPE_LABELS: Record<string, string> = {
  scale_1_5: "Scale 1–5",
  yes_no: "Yes / No",
  yes_maybe_no: "Yes / Maybe / No",
};

export default function PulseSurveys({ companyId }: Props) {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<PulseSurvey[]>([]);
  const [responses, setResponses] = useState<PulseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<PulseSurvey | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [surveyFilter, setSurveyFilter] = useState<string>("all");
  const resultsRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [surveyData, responseData] = await Promise.all([
        queryDocuments<PulseSurvey>("pulseSurveys", [
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
        ]),
        queryDocuments<PulseResponse>("pulseResponses", [
          where("companyId", "==", companyId),
          orderBy("sentAt", "desc"),
        ]),
      ]);
      setSurveys(surveyData);
      setResponses(responseData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeSurvey = surveys.find((s) => s.isActive) ?? null;

  async function handleSendNow() {
    if (!activeSurvey) return;
    setSending(true);
    try {
      const sendSurveys = httpsCallable<{ companyId: string; surveyId: string }, { sent: number }>(
        functions,
        "sendPulseSurvey"
      );
      const result = await sendSurveys({ companyId, surveyId: activeSurvey.id });
      showToast("success", "Survey sent", `Sent to ${result.data.sent} alumni`);
      await loadData();
    } catch (err) {
      showToast("error", "Send failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleDeactivate() {
    if (!activeSurvey) return;
    setDeactivating(true);
    try {
      await updateDocument("pulseSurveys", activeSurvey.id, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
      setSurveys((prev) => prev.map((s) => s.id === activeSurvey.id ? { ...s, isActive: false } : s));
      showToast("success", "Survey deactivated", activeSurvey.name);
    } catch {
      showToast("error", "Error", "Could not deactivate survey.");
    } finally {
      setDeactivating(false);
      setConfirmDeactivate(false);
    }
  }

  // Aggregate stats
  const filteredResponses = surveyFilter === "all"
    ? responses
    : responses.filter((r) => r.surveyId === surveyFilter);

  const completedResponses = filteredResponses.filter((r) => r.status === "completed");
  const responseRate = filteredResponses.length > 0
    ? Math.round((completedResponses.length / filteredResponses.length) * 100)
    : 0;

  const scoresWithValues = completedResponses
    .map((r) => r.satisfactionScore)
    .filter((s): s is number => s !== null && s !== undefined);
  const avgSatisfaction = scoresWithValues.length > 0
    ? (scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length).toFixed(1)
    : null;

  const returnYesMaybe = completedResponses.filter(
    (r) => r.wouldReturn === "yes" || r.wouldReturn === "maybe"
  ).length;
  const wouldReturnPct = completedResponses.length > 0
    ? Math.round((returnYesMaybe / completedResponses.length) * 100)
    : null;

  const referYes = completedResponses.filter((r) => r.wouldRefer === true).length;
  const wouldReferPct = completedResponses.length > 0
    ? Math.round((referYes / completedResponses.length) * 100)
    : null;

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section A — Survey Configuration */}
      <div>
        <h2 className="text-base font-semibold text-navy mb-4">Active Survey</h2>
        {!activeSurvey ? (
          <Card>
            <EmptyState
              icon={<BarChart3 size={32} className="text-mist" />}
              title="No pulse survey configured"
              description="Set up a survey to start collecting alumni feedback."
              action={
                <Button onClick={() => { setEditingSurvey(null); setShowModal(true); }}>
                  Set up a Pulse Survey
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="bg-white border border-teal/20 rounded-xl p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-navy">{activeSurvey.name}</span>
                <span className="px-2 py-0.5 text-xs font-medium bg-teal/10 text-teal rounded-full">
                  Active
                </span>
              </div>
              <button
                onClick={() => { setEditingSurvey(activeSurvey); setShowModal(true); }}
                className="text-xs text-mist hover:text-navy transition-colors"
              >
                <Edit2 size={13} className="inline mr-1" />
                Edit
              </button>
            </div>

            {/* Questions */}
            <ol className="space-y-1">
              {activeSurvey.questions
                .sort((a, b) => a.order - b.order)
                .map((q) => (
                  <li key={q.id} className="flex items-center gap-2 text-sm text-navy">
                    <span className="text-mist text-xs w-4 text-right">{q.order}.</span>
                    <span className="flex-1">{q.text}</span>
                    <span className="text-xs text-mist bg-navy/5 px-1.5 py-0.5 rounded">
                      {TYPE_LABELS[q.type]}
                    </span>
                  </li>
                ))}
            </ol>

            {/* Schedule info */}
            <p className="text-xs text-mist">
              {SCHEDULE_LABELS[activeSurvey.schedule]}
              {" · Last sent "}
              {toDate(activeSurvey.lastSentAt)
                ? format(toDate(activeSurvey.lastSentAt)!, "MMM d, yyyy")
                : "Never"}
              {" · Next: "}
              {toDate(activeSurvey.nextSendAt)
                ? format(toDate(activeSurvey.nextSendAt)!, "MMM d, yyyy")
                : "Manual only"}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button onClick={handleSendNow} loading={sending} size="sm">
                <Send size={13} className="mr-1.5" />
                {sending ? "Sending..." : "Send Now"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}
              >
                <Eye size={13} className="mr-1.5" />
                View Results
              </Button>
              <button
                onClick={() => { setEditingSurvey(activeSurvey); setShowModal(true); }}
                className="text-sm text-mist hover:text-navy transition-colors px-2 py-1"
              >
                Edit Survey
              </button>
              {confirmDeactivate ? (
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-xs text-ember">Deactivate?</span>
                  <button
                    onClick={handleDeactivate}
                    disabled={deactivating}
                    className="text-xs text-ember hover:underline"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDeactivate(false)}
                    className="text-xs text-mist hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeactivate(true)}
                  className="text-sm text-mist hover:text-navy transition-colors px-2 py-1 ml-auto"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>
        )}

        {!activeSurvey && surveys.some((s) => !s.isActive) && (
          <div className="mt-3">
            <p className="text-xs text-mist mb-2">Draft surveys:</p>
            <div className="space-y-2">
              {surveys
                .filter((s) => !s.isActive)
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-white border border-navy/10 rounded-lg px-4 py-2.5"
                  >
                    <span className="text-sm text-navy">{s.name}</span>
                    <button
                      onClick={() => { setEditingSurvey(s); setShowModal(true); }}
                      className="text-xs text-teal hover:underline"
                    >
                      Edit &amp; Activate
                    </button>
                  </div>
                ))}
          </div>
        </div>
        )}
      </div>

      {/* Section B — Results */}
      <div ref={resultsRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-navy">Survey Results</h2>
          <span className="text-xs text-mist">
            Last {completedResponses.length} responses
          </span>
        </div>

        {/* Survey filter */}
        {surveys.length > 1 && (
          <div className="mb-4">
            <select
              value={surveyFilter}
              onChange={(e) => setSurveyFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
            >
              <option value="all">All surveys</option>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Aggregate stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: "Response Rate",
              value: filteredResponses.length > 0 ? `${responseRate}%` : "—",
            },
            {
              label: "Avg Satisfaction",
              value: avgSatisfaction ? `${avgSatisfaction} / 5` : "—",
            },
            {
              label: "Would Return",
              value: wouldReturnPct !== null ? `${wouldReturnPct}%` : "—",
            },
            {
              label: "Would Refer",
              value: wouldReferPct !== null ? `${wouldReferPct}%` : "—",
            },
          ].map((stat) => (
            <Card key={stat.label}>
              <div>
                <p className="text-xs text-mist mb-0.5">{stat.label}</p>
                <p className="text-xl font-semibold text-navy">{stat.value}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Results table */}
        {filteredResponses.length === 0 ? (
          <Card>
            <EmptyState
              title="No responses yet"
              description="Send the survey to start collecting data."
            />
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/5">
                    <th className="text-left text-xs font-medium text-mist px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-mist px-4 py-3 hidden md:table-cell">Sent Date</th>
                    <th className="text-left text-xs font-medium text-mist px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-mist px-4 py-3">Satisfaction</th>
                    <th className="text-left text-xs font-medium text-mist px-4 py-3">Would Return</th>
                    <th className="text-left text-xs font-medium text-mist px-4 py-3">Would Refer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {filteredResponses.map((r) => {
                    const sentDate = toDate(r.sentAt);
                    const completedDate = toDate(r.completedAt);
                    const score = r.satisfactionScore;
                    return (
                      <tr key={r.id} className="hover:bg-navy/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-navy text-sm">{r.alumniName}</p>
                          <p className="text-xs text-mist">{r.alumniEmail}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-mist hidden md:table-cell">
                          {sentDate ? format(sentDate, "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {r.status === "completed" ? (
                            <span className="flex items-center gap-1 text-teal text-xs">
                              <CheckCircle size={12} />
                              {completedDate ? format(completedDate, "MMM d") : "Responded"}
                            </span>
                          ) : (
                            <span className="text-xs text-mist">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {score !== null && score !== undefined ? (
                            <span className={clsx(
                              "text-sm font-medium",
                              score <= 2 ? "text-ember" : score === 3 ? "text-yellow-600" : "text-teal"
                            )}>
                              {"★".repeat(score)}{"☆".repeat(5 - score)}
                              <span className="ml-1 text-xs font-normal text-mist">{score}/5</span>
                            </span>
                          ) : (
                            <span className="text-xs text-mist">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.wouldReturn === "yes" ? (
                            <span className="text-xs text-teal font-medium">Yes</span>
                          ) : r.wouldReturn === "maybe" ? (
                            <span className="text-xs text-yellow-600 font-medium">Maybe</span>
                          ) : r.wouldReturn === "no" ? (
                            <span className="text-xs text-mist">No</span>
                          ) : (
                            <span className="text-xs text-mist">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.wouldRefer === true ? (
                            <span className="text-xs text-teal font-medium">Yes</span>
                          ) : r.wouldRefer === false ? (
                            <span className="text-xs text-mist">No</span>
                          ) : (
                            <span className="text-xs text-mist">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Create/Edit Modal */}
      <CreateSurveyModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingSurvey(null); }}
        companyId={companyId}
        createdBy={user?.uid ?? ""}
        editingSurvey={editingSurvey}
        onSaved={(saved) => {
          setSurveys((prev) => {
            const idx = prev.findIndex((s) => s.id === saved.id);
            if (idx === -1) return [saved, ...prev];
            return prev.map((s) => s.id === saved.id ? saved : s);
          });
          if (saved.isActive) {
            setSurveys((prev) => prev.map((s) => s.id !== saved.id ? { ...s, isActive: false } : s));
          }
        }}
      />
    </div>
  );
}
