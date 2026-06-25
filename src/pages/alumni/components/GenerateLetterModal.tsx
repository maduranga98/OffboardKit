import { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../../../lib/firebase";
import { X, FileDown, Loader2, Calendar, ChevronDown } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import type { LetterTemplate } from "../../../types/letter.types";
import type { AlumniProfile } from "../../../types/alumni.types";

interface Props {
  alumni: AlumniProfile;
  onClose: () => void;
}

function formatLong(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function applyPreviewReplacements(
  text: string,
  replacements: Record<string, string>
): string {
  return text.replace(/\{\{[^}]+\}\}/g, (m) => replacements[m] ?? m);
}

function downloadBase64Pdf(base64: string, fileName: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GenerateLetterModal({ alumni, onClose }: Props) {
  const { companyId } = useAuth();
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTplId, setSelectedTplId] = useState("");
  const [letterDate, setLetterDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [recipientLine, setRecipientLine] = useState("To Whom It May Concern");
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customClosing, setCustomClosing] = useState("");
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [companyName, setCompanyName] = useState("");

  function selectTemplate(t: LetterTemplate) {
    setSelectedTplId(t.id);
    setCustomSubject(t.subject ?? "");
    setCustomBody(t.body);
    setCustomClosing(t.closing);
  }

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      getDocs(
        query(
          collection(db, "letterTemplates"),
          where("companyId", "==", companyId)
        )
      ),
      getDoc(doc(db, "companies", companyId)),
    ]).then(([snap, companySnap]) => {
      const tpls = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as LetterTemplate)
      );
      setTemplates(tpls);
      if (tpls.length > 0) selectTemplate(tpls[0]);
      setLoadingTemplates(false);
      const data = companySnap.data();
      if (data?.name) setCompanyName(data.name as string);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const replacements = useMemo<Record<string, string>>(() => {
    const exitDateStr = alumni.exitDate?.toDate
      ? formatLong(alumni.exitDate.toDate())
      : "";
    const letterDateStr = letterDate ? formatLong(new Date(letterDate)) : "";
    return {
      "{{employee_name}}": alumni.name,
      "{{role}}": alumni.role,
      "{{department}}": alumni.department,
      "{{exit_date}}": exitDateStr,
      "{{company_name}}": companyName,
      "{{letter_date}}": letterDateStr,
    };
  }, [alumni, companyName, letterDate]);

  const previewSubject = useMemo(
    () => applyPreviewReplacements(customSubject, replacements),
    [customSubject, replacements]
  );
  const previewBody = useMemo(
    () => applyPreviewReplacements(customBody, replacements),
    [customBody, replacements]
  );

  async function handleGenerate() {
    if (!companyId || !selectedTplId) return;
    setGenerating(true);
    try {
      const fn = httpsCallable(getFunctions(), "generateLetterPdf");
      const result = await fn({
        templateId: selectedTplId,
        alumniId: alumni.id,
        companyId,
        letterDate,
        recipientLine,
        customSubject,
        customBody,
        customClosing,
      });
      const data = result.data as { pdf: string; fileName: string };
      downloadBase64Pdf(data.pdf, data.fileName);
    } catch (err) {
      console.error("generateLetterPdf error", err);
      alert("Failed to generate PDF.");
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = !generating && !!selectedTplId && templates.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-navy/8">
          <div>
            <h3 className="text-base font-semibold text-navy">Generate Letter</h3>
            <p className="text-xs text-mist mt-0.5">
              {alumni.name} · {alumni.role}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-mist hover:text-navy transition-colors rounded mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Template selector */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1">
              Template
            </label>
            {loadingTemplates ? (
              <div className="h-10 bg-navy/5 rounded-lg animate-pulse" />
            ) : templates.length === 0 ? (
              <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                No templates found. Create one in Letter Templates first.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedTplId}
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) selectTemplate(t);
                  }}
                  className="w-full appearance-none px-3 py-2 pr-10 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mist pointer-events-none"
                />
              </div>
            )}
          </div>

          {/* Letter Date */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1">
              Letter Date
            </label>
            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-mist"
              />
              <input
                type="date"
                value={letterDate}
                onChange={(e) => setLetterDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
              />
            </div>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1">
              Recipient Line
            </label>
            <input
              type="text"
              value={recipientLine}
              onChange={(e) => setRecipientLine(e.target.value)}
              placeholder="To Whom It May Concern"
              className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          </div>

          {/* Tab switcher */}
          <div>
            <div className="flex border-b border-navy/10 mb-4">
              {(["edit", "preview"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                    tab === t
                      ? "border-teal text-teal"
                      : "border-transparent text-mist hover:text-navy"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "edit" && (
              <div className="space-y-4">
                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-navy mb-1">
                    Subject / Heading
                  </label>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="RE: Reference Letter for {{employee_name}}"
                    className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                  />
                </div>
                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-navy mb-1">
                    Letter Body
                  </label>
                  <textarea
                    rows={10}
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
                  />
                </div>
                {/* Closing */}
                <div>
                  <label className="block text-sm font-medium text-navy mb-1">
                    Closing Line
                  </label>
                  <input
                    type="text"
                    value={customClosing}
                    onChange={(e) => setCustomClosing(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                  />
                </div>
              </div>
            )}

            {tab === "preview" && (
              <div className="bg-[#FAFAFA] border border-navy/10 rounded-xl p-6 text-[#0F1C2E]">
                {/* Preview header */}
                <div className="flex justify-between items-end border-b-2 border-[#0D9E8A] pb-3 mb-5">
                  <span className="font-bold text-sm">{companyName}</span>
                  <span className="text-xs text-[#6B7280]">
                    {letterDate ? formatLong(new Date(letterDate)) : ""}
                  </span>
                </div>
                {/* Recipient */}
                <p className="text-sm mb-3">{recipientLine},</p>
                {/* Subject */}
                {previewSubject && (
                  <p className="text-xs font-bold uppercase tracking-wide mb-3">
                    {previewSubject}
                  </p>
                )}
                {/* Body */}
                <p className="text-sm whitespace-pre-wrap mb-6">{previewBody}</p>
                {/* Closing */}
                <p className="text-sm mb-12">{customClosing}</p>
                {/* Signature */}
                <div>
                  <div className="w-32 border-t border-[#9CA3AF] mb-1" />
                  <p className="text-xs text-[#6B7280]">Human Resources</p>
                  <p className="text-xs text-[#6B7280]">{companyName}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-navy/8">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-mist hover:text-navy transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Generating…
              </>
            ) : (
              <>
                <FileDown size={14} /> Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
