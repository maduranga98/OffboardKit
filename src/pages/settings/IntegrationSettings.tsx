import { useEffect, useState } from "react";
import {
  Hash,
  Plus,
  X,
  Circle,
  CheckCircle,
  Search,
  AlertCircle,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import { getDocument, updateDocument, serverTimestamp } from "../../lib/firestore";
import { db } from "../../lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import type { Company } from "../../types/company.types";

interface System {
  id: string;
  companyId: string;
  name: string;
  category: "Communication" | "Development" | "Design" | "Productivity" | "Finance" | "CRM" | "Other";
  isActive: boolean;
  isCustom: boolean;
  createdAt: any;
}

const DEFAULT_SYSTEMS: Omit<System, "id" | "companyId" | "createdAt">[] = [
  { name: "Slack", category: "Communication", isActive: true, isCustom: false },
  { name: "Microsoft Teams", category: "Communication", isActive: true, isCustom: false },
  { name: "Gmail", category: "Communication", isActive: true, isCustom: false },
  { name: "Outlook", category: "Communication", isActive: true, isCustom: false },
  { name: "GitHub", category: "Development", isActive: true, isCustom: false },
  { name: "GitLab", category: "Development", isActive: true, isCustom: false },
  { name: "Jira", category: "Development", isActive: true, isCustom: false },
  { name: "Linear", category: "Development", isActive: true, isCustom: false },
  { name: "AWS", category: "Development", isActive: true, isCustom: false },
  { name: "GCP", category: "Development", isActive: true, isCustom: false },
  { name: "Azure", category: "Development", isActive: true, isCustom: false },
  { name: "Figma", category: "Design", isActive: true, isCustom: false },
  { name: "Adobe Creative Cloud", category: "Design", isActive: true, isCustom: false },
  { name: "Notion", category: "Productivity", isActive: true, isCustom: false },
  { name: "Confluence", category: "Productivity", isActive: true, isCustom: false },
  { name: "Google Drive", category: "Productivity", isActive: true, isCustom: false },
  { name: "Dropbox", category: "Productivity", isActive: true, isCustom: false },
  { name: "QuickBooks", category: "Finance", isActive: true, isCustom: false },
  { name: "Expensify", category: "Finance", isActive: true, isCustom: false },
  { name: "Xero", category: "Finance", isActive: true, isCustom: false },
  { name: "HubSpot", category: "CRM", isActive: true, isCustom: false },
  { name: "Salesforce", category: "CRM", isActive: true, isCustom: false },
];

const CATEGORY_ORDER: System["category"][] = [
  "Communication",
  "Development",
  "Design",
  "Productivity",
  "Finance",
  "CRM",
  "Other",
];

const COMING_SOON_INTEGRATIONS = [
  "Google Workspace",
  "BambooHR",
  "Workday",
  "Rippling",
  "Okta",
  "ADP",
];

export default function IntegrationSettings() {
  const { companyId } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingSlack, setTestingSlack] = useState(false);
  const [savingSlack, setSavingSlack] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newSystemName, setNewSystemName] = useState("");
  const [newSystemCategory, setNewSystemCategory] = useState<System["category"]>("Other");

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        // Load company data
        const companyData = await getDocument<Company>("companies", companyId);
        if (companyData) {
          setCompany(companyData);
          setSlackWebhookUrl(companyData.settings?.slackWebhookUrl || "");
        }

        // Load systems
        const systemsRef = collection(db, "systemCatalog", companyId, "systems");
        const snapshot = await getDocs(systemsRef);
        const systemsList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as System));

        // Seed defaults if empty
        if (systemsList.length === 0) {
          const seedPromises = DEFAULT_SYSTEMS.map((system) => {
            const id = crypto.randomUUID();
            return setDoc(
              doc(db, "systemCatalog", companyId, "systems", id),
              {
                ...system,
                id,
                companyId,
                createdAt: new Date(),
              }
            );
          });
          await Promise.all(seedPromises);

          // Reload
          const newSnapshot = await getDocs(systemsRef);
          const newList = newSnapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          } as System));
          setSystems(newList);
        } else {
          setSystems(systemsList);
        }
      } catch (error) {
        console.error(error);
        showToast("error", "Failed to load integration settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const handleSaveSlackWebhook = async () => {
    if (!companyId) return;
    setSavingSlack(true);
    try {
      await updateDocument("companies", companyId, {
        "settings.slackWebhookUrl": slackWebhookUrl,
        updatedAt: serverTimestamp(),
      });
      showToast("success", "Slack webhook saved");
    } catch {
      showToast("error", "Failed to save Slack webhook");
    } finally {
      setSavingSlack(false);
    }
  };

  const handleTestSlackWebhook = async () => {
    if (!slackWebhookUrl.trim()) {
      showToast("error", "Please enter a webhook URL first");
      return;
    }

    setTestingSlack(true);
    try {
      const response = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "✅ OffboardKit connected successfully!" }),
      });

      if (!response.ok) {
        throw new Error("Webhook request failed");
      }

      showToast("success", "Test message sent to Slack!");
    } catch {
      showToast("error", "Could not reach webhook. Check the URL.");
    } finally {
      setTestingSlack(false);
    }
  };

  const handleToggleSystem = async (system: System) => {
    if (!companyId) return;
    try {
      const systemRef = doc(db, "systemCatalog", companyId, "systems", system.id);
      await updateDoc(systemRef, { isActive: !system.isActive });

      setSystems((prev) =>
        prev.map((s) => (s.id === system.id ? { ...s, isActive: !s.isActive } : s))
      );
    } catch {
      showToast("error", "Failed to update system");
    }
  };

  const handleDeleteSystem = async (system: System) => {
    if (!window.confirm(`Remove ${system.name} from catalog?`)) {
      return;
    }

    if (!companyId) return;
    try {
      const systemRef = doc(db, "systemCatalog", companyId, "systems", system.id);
      await deleteDoc(systemRef);
      setSystems((prev) => prev.filter((s) => s.id !== system.id));
      showToast("success", `${system.name} removed`);
    } catch {
      showToast("error", "Failed to delete system");
    }
  };

  const handleAddCustomSystem = async () => {
    if (!newSystemName.trim() || !companyId) return;

    try {
      const id = crypto.randomUUID();
      const newSystem: System = {
        id,
        companyId,
        name: newSystemName.trim(),
        category: newSystemCategory,
        isActive: true,
        isCustom: true,
        createdAt: new Date(),
      };

      await setDoc(
        doc(db, "systemCatalog", companyId, "systems", id),
        newSystem
      );

      setSystems((prev) => [...prev, newSystem]);
      setNewSystemName("");
      setNewSystemCategory("Other");
      showToast("success", "System added");
    } catch {
      showToast("error", "Failed to add system");
    }
  };

  const groupedSystems = systems.reduce(
    (acc, system) => {
      if (!acc[system.category]) {
        acc[system.category] = [];
      }
      acc[system.category].push(system);
      return acc;
    },
    {} as Record<System["category"], System[]>
  );

  const filteredGroupedSystems = Object.entries(groupedSystems).reduce(
    (acc, [category, list]) => {
      const filtered = list.filter((s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[category as System["category"]] = filtered;
      }
      return acc;
    },
    {} as Record<System["category"], System[]>
  );

  const activeSystemsCount = systems.filter((s) => s.isActive).length;

  if (loading) {
    return (
      <Card>
        <LoadingSpinner />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Slack Integration */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Hash size={20} className="text-navy" />
            <h3 className="text-base font-semibold text-navy">Slack Integration</h3>
          </div>

          <p className="text-sm text-mist">
            Send task reminders and offboarding alerts to a Slack channel.
          </p>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-navy">
              Webhook URL
            </label>
            <input
              type="text"
              placeholder="https://hooks.slack.com/services/..."
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
              className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder-mist/50 focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          </div>

          <p className="text-xs text-mist">
            Create a webhook in your Slack app settings. Paste the URL here to receive
            notifications.
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestSlackWebhook}
              loading={testingSlack}
            >
              Test Connection
            </Button>
            <Button size="sm" onClick={handleSaveSlackWebhook} loading={savingSlack}>
              Save
            </Button>
          </div>
        </div>
      </Card>

      {/* System Catalog */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-navy">System Catalog</h3>
              <p className="text-xs text-mist mt-1">
                {activeSystemsCount} system{activeSystemsCount !== 1 ? "s" : ""} active
              </p>
            </div>
          </div>

          <p className="text-sm text-mist">
            Manage the tools tracked during access revocation. Active systems appear in
            every new offboarding's access checklist.
          </p>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-mist" />
            <input
              type="text"
              placeholder="Search systems..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-md border border-navy/20 pl-9 pr-3 py-2 text-sm text-navy placeholder-mist/50 focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          </div>

          {/* Systems grouped by category */}
          <div className="space-y-5">
            {CATEGORY_ORDER.map((category) => {
              const categoryItems = filteredGroupedSystems[category];
              if (!categoryItems) return null;

              return (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-mist uppercase tracking-wide mb-2">
                    {category}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {categoryItems.map((system) => (
                      <div
                        key={system.id}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm border transition-colors ${
                          system.isActive
                            ? "bg-teal/5 border-teal/30 text-teal"
                            : "bg-navy/5 border-navy/10 text-mist"
                        }`}
                      >
                        <button
                          onClick={() => handleToggleSystem(system)}
                          className="flex-shrink-0 hover:opacity-75"
                        >
                          {system.isActive ? (
                            <CheckCircle size={14} />
                          ) : (
                            <Circle size={14} />
                          )}
                        </button>
                        <span>{system.name}</span>
                        {system.isCustom && (
                          <button
                            onClick={() => handleDeleteSystem(system)}
                            className="ml-1 flex-shrink-0 text-mist hover:text-ember transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add custom system */}
          <div className="border-t border-navy/10 pt-4 mt-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-mist uppercase tracking-wide">
                Add Custom System
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Retool"
                  value={newSystemName}
                  onChange={(e) => setNewSystemName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleAddCustomSystem();
                  }}
                  className="flex-1 rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder-mist/50 focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
                <select
                  value={newSystemCategory}
                  onChange={(e) =>
                    setNewSystemCategory(e.target.value as System["category"])
                  }
                  className="rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                >
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomSystem}
                >
                  <Plus size={14} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Coming Soon */}
      <Card>
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-navy">More integrations coming soon</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {COMING_SOON_INTEGRATIONS.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg border border-navy/10 p-4 opacity-50"
              >
                <span className="text-sm text-navy font-medium">{name}</span>
                <Badge variant="mist">Coming Soon</Badge>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
