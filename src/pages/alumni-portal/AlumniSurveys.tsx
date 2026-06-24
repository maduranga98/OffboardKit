import { useState, useEffect, useCallback } from "react";
import { BarChart3, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import { queryDocuments, where, orderBy } from "../../lib/firestore";
import type { PulseResponse } from "../../types/pulseSurveys.types";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts || typeof (ts as Timestamp).toDate !== "function") return null;
  return (ts as Timestamp).toDate();
}

export default function AlumniSurveys() {
  const { alumniProfile } = useAlumniAuth();
  const [responses, setResponses] = useState<PulseResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const loadResponses = useCallback(async () => {
    if (!alumniProfile) return;
    try {
      const data = await queryDocuments<PulseResponse>("pulseResponses", [
        where("alumniId", "==", alumniProfile.id),
        where("companyId", "==", alumniProfile.companyId),
        orderBy("sentAt", "desc"),
      ]);
      setResponses(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [alumniProfile]);

  useEffect(() => { loadResponses(); }, [loadResponses]);

  if (loading) return <div className="py-24 flex justify-center"><LoadingSpinner size="lg" /></div>;
  if (!alumniProfile) return null;

  const pending = responses.filter((r) => r.status !== "completed");
  const completed = responses.filter((r) => r.status === "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display text-navy">Pulse Surveys</h1>
        <p className="text-sm text-mist mt-0.5">Surveys sent to you by your former company</p>
      </div>

      {responses.length === 0 ? (
        <Card>
          <div className="py-10 text-center space-y-2">
            <BarChart3 size={28} className="text-mist mx-auto" />
            <p className="text-sm font-medium text-navy">No surveys yet</p>
            <p className="text-xs text-mist max-w-xs mx-auto">
              When your former employer sends a pulse survey, it will appear here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-navy">Pending</h2>
              {pending.map((r) => {
                const sentDate = toDate(r.sentAt);
                return (
                  <div
                    key={r.id}
                    className="bg-white border border-teal/20 rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0">
                        <Clock size={16} className="text-teal" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy truncate">Alumni Pulse Survey</p>
                        {sentDate && (
                          <p className="text-xs text-mist">Sent {format(sentDate, "MMM d, yyyy")}</p>
                        )}
                      </div>
                    </div>
                    <a
                      href={`/survey/${r.token}`}
                      className="flex-shrink-0 px-4 py-1.5 bg-teal text-white text-xs font-semibold rounded-lg hover:bg-teal/90 transition-colors"
                    >
                      Take Survey
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-navy">Completed</h2>
              {completed.map((r) => {
                const completedDate = toDate(r.completedAt);
                const score = r.satisfactionScore;
                return (
                  <div
                    key={r.id}
                    className="bg-white border border-navy/10 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0">
                          <CheckCircle size={16} className="text-teal" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy truncate">Alumni Pulse Survey</p>
                          {completedDate && (
                            <p className="text-xs text-mist">
                              Responded {format(completedDate, "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                      {score !== null && score !== undefined && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-mist mb-0.5">Your rating</p>
                          <p className={clsx(
                            "text-sm font-semibold",
                            score <= 2 ? "text-ember" : score === 3 ? "text-yellow-600" : "text-teal"
                          )}>
                            {"★".repeat(score)}{"☆".repeat(5 - score)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Response summary */}
                    {(r.wouldReturn || r.wouldRefer !== null) && (
                      <div className="mt-3 pt-3 border-t border-navy/5 flex flex-wrap gap-4 text-xs text-mist">
                        {r.wouldReturn && (
                          <span>
                            Would return:{" "}
                            <span className={clsx(
                              "font-medium",
                              r.wouldReturn === "yes" ? "text-teal" : r.wouldReturn === "maybe" ? "text-yellow-600" : "text-navy"
                            )}>
                              {r.wouldReturn.charAt(0).toUpperCase() + r.wouldReturn.slice(1)}
                            </span>
                          </span>
                        )}
                        {r.wouldRefer !== null && r.wouldRefer !== undefined && (
                          <span>
                            Would refer:{" "}
                            <span className={clsx("font-medium", r.wouldRefer ? "text-teal" : "text-navy")}>
                              {r.wouldRefer ? "Yes" : "No"}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
