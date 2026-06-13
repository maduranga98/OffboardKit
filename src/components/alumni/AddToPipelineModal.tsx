import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { queryDocuments, updateDocument, serverTimestamp, where } from "../../lib/firestore";
import type { AlumniProfile } from "../../types/alumni.types";
import clsx from "clsx";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  onAdded: () => void;
  alreadyInPipeline: string[];
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-ember/10 text-ember",
  medium: "bg-yellow-50 text-yellow-700",
  low: "bg-navy/5 text-mist",
};

export function AddToPipelineModal({ isOpen, onClose, companyId, onAdded, alreadyInPipeline }: Props) {
  const [profiles, setProfiles] = useState<AlumniProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !companyId) return;
    setLoading(true);
    setSelected(new Set());
    setSearch("");
    queryDocuments<AlumniProfile>("alumniProfiles", [where("companyId", "==", companyId)])
      .then((docs) => {
        const pipelineSet = new Set(alreadyInPipeline);
        setProfiles(
          docs.filter(
            (d) => !pipelineSet.has(d.id) && (!d.boomerangStage || d.boomerangStage === "none")
          )
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, companyId, alreadyInPipeline]);

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        [...selected].map((id) =>
          updateDocument("alumniProfiles", id, {
            boomerangStage: "potential",
            updatedAt: serverTimestamp(),
          })
        )
      );
      onAdded();
      onClose();
    } catch (err) {
      console.error("Error adding to pipeline:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add to Boomerang Pipeline"
      size="lg"
      footer={
        <div className="flex justify-end gap-2 pt-4 border-t border-navy/5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} loading={saving} disabled={selected.size === 0}>
            Add Selected
            {selected.size > 0 && (
              <span className="ml-2 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                {selected.size}
              </span>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
          <input
            type="text"
            placeholder="Search alumni..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
          />
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-mist">Loading alumni...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-mist">
            {profiles.length === 0
              ? "All alumni are already in the pipeline."
              : "No alumni match your search."}
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto divide-y divide-navy/5 -mx-4 px-4">
            {filtered.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 py-3 cursor-pointer hover:bg-navy/[0.02] -mx-4 px-4 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4 rounded border-navy/20 text-teal focus:ring-teal/50 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{p.name}</p>
                  <p className="text-xs text-mist truncate">
                    {p.role}
                    {p.department ? ` · ${p.department}` : ""}
                  </p>
                </div>
                {p.rehirePriority !== "none" && (
                  <span
                    className={clsx(
                      "text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0",
                      PRIORITY_STYLES[p.rehirePriority] ?? "bg-navy/5 text-mist"
                    )}
                  >
                    {p.rehirePriority.charAt(0).toUpperCase() + p.rehirePriority.slice(1)}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
