import { useState } from "react";
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { setDocument, serverTimestamp } from "../../lib/firestore";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import type { KnowledgeThread } from "../../types/knowledgeThreads.types";

interface KnowledgeItemRef {
  id: string;
  title: string;
  type: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  flowId: string;
  alumniId: string;
  alumniName: string;
  alumniEmail: string;
  hrUserId: string;
  hrUserName: string;
  knowledgeItems: KnowledgeItemRef[];
  onCreated: (thread: KnowledgeThread) => void;
}

const MAX_CHARS = 1000;

export function AskExpertModal({
  isOpen,
  onClose,
  companyId,
  flowId,
  alumniId,
  alumniName,
  alumniEmail,
  hrUserId,
  hrUserName,
  knowledgeItems,
  onCreated,
}: Props) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedItem = knowledgeItems.find((i) => i.id === selectedItemId);

  async function handleSubmit() {
    if (!questionText.trim()) return;
    setSubmitting(true);
    try {
      const threadId = crypto.randomUUID();
      const now = serverTimestamp();

      await setDocument("knowledgeThreads", threadId, {
        id: threadId,
        companyId,
        flowId,
        alumniId,
        alumniName,
        alumniEmail,
        knowledgeItemId: selectedItemId || null,
        knowledgeItemTitle: selectedItem?.title || null,
        subject: questionText.trim(),
        status: "open",
        messageCount: 0,
        lastMessageAt: now,
        lastMessageBy: "hr",
        createdBy: hrUserId,
        createdByName: hrUserName,
        createdAt: now,
        updatedAt: now,
      });

      const msgId = crypto.randomUUID();
      await setDoc(
        doc(collection(db, "knowledgeThreads", threadId, "messages"), msgId),
        {
          id: msgId,
          threadId,
          content: questionText.trim(),
          senderType: "hr",
          senderId: hrUserId,
          senderName: hrUserName,
          createdAt: serverTimestamp(),
        }
      );

      const thread: KnowledgeThread = {
        id: threadId,
        companyId,
        flowId,
        alumniId,
        alumniName,
        alumniEmail,
        knowledgeItemId: selectedItemId || null,
        knowledgeItemTitle: selectedItem?.title || null,
        subject: questionText.trim(),
        status: "open",
        messageCount: 0,
        lastMessageAt: null as unknown as import("firebase/firestore").Timestamp,
        lastMessageBy: "hr",
        createdBy: hrUserId,
        createdByName: hrUserName,
        createdAt: null as unknown as import("firebase/firestore").Timestamp,
        updatedAt: null as unknown as import("firebase/firestore").Timestamp,
      };

      onCreated(thread);
      setQuestionText("");
      setSelectedItemId("");
      onClose();
    } catch (err) {
      console.error("Failed to create thread:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ask ${alumniName} a Question`}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-mist">
          They'll receive an email notification and can reply in their alumni portal
        </p>

        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Link to a knowledge item (optional)
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="">General question (not linked to a specific item)</option>
            {knowledgeItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Your question <span className="text-ember">*</span>
          </label>
          <textarea
            rows={4}
            value={questionText}
            onChange={(e) =>
              setQuestionText(e.target.value.slice(0, MAX_CHARS))
            }
            placeholder="e.g. Can you explain how the monthly reconciliation spreadsheet works? Where are the formulas documented?"
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
          />
          <p className="text-xs text-mist text-right mt-1">
            {questionText.length}/{MAX_CHARS}
          </p>
        </div>

        <Button
          className="w-full"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!questionText.trim()}
        >
          Send Question to {alumniName}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
