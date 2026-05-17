import { useEffect, useState } from "react";
import { Plus, Trash2, Power, AlertTriangle, CheckCircle, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Card } from "../../components/ui/Card";
import { usePlanGate } from "../../hooks/usePlanGate";
import { SettingsShell } from "./SettingsShell";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  setDocument,
  updateDocument,
  deleteDocument,
  serverTimestamp,
  where,
} from "../../lib/firestore";
import type {
  Integration,
  IntegrationProvider,
  IntegrationEvent,
} from "../../types/integration.types";

const PROVIDERS: { value: IntegrationProvider; label: string; hint: string }[] = [
  { value: "generic_webhook", label: "Generic webhook", hint: "Any HTTPS endpoint" },
  { value: "okta", label: "Okta", hint: "User deprovisioning hook" },
  { value: "azure_ad", label: "Azure AD", hint: "Account disable hook" },
  { value: "workday", label: "Workday", hint: "Worker termination event" },
  { value: "bamboohr", label: "BambooHR", hint: "Employee status update" },
];

const EVENT_OPTIONS: { value: IntegrationEvent; label: string }[] = [
  { value: "flow_completed", label: "Offboarding completed" },
  { value: "flow_cancelled", label: "Offboarding cancelled" },
  { value: "approval_completed", label: "Approval chain completed" },
  { value: "asset_wiped", label: "Asset wiped" },
];

export default function WebhookSettings() {
  const { companyId } = useAuth();
  const { requiresPlan, plan } = usePlanGate();
  const unlocked = requiresPlan("business");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    provider: "generic_webhook" as IntegrationProvider,
    webhookUrl: "",
    secret: "",
    events: ["flow_completed"] as IntegrationEvent[],
  });

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await queryDocuments<Integration>("integrations", [
          where("companyId", "==", companyId),
        ]);
        if (!cancelled) setIntegrations(rows);
      } catch (err) {
        console.error("Load webhooks failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const create = async () => {
    if (!companyId) return;
    if (!form.name.trim() || !form.webhookUrl.trim()) {
      showToast("error", "Name and webhook URL are required");
      return;
    }
    if (!/^https:\/\//i.test(form.webhookUrl)) {
      showToast("error", "Webhook URL must use HTTPS");
      return;
    }
    if (form.events.length === 0) {
      showToast("error", "Select at least one event to subscribe to");
      return;
    }
    try {
      const id = crypto.randomUUID();
      const doc: Integration = {
        id,
        companyId,
        name: form.name.trim(),
        provider: form.provider,
        webhookUrl: form.webhookUrl.trim(),
        secret: form.secret.trim(),
        events: form.events,
        isActive: true,
        lastTriggeredAt: null,
        lastStatus: null,
        lastError: "",
        createdAt: serverTimestamp() as never,
        updatedAt: serverTimestamp() as never,
      };
      await setDocument("integrations", id, doc as never);
      setIntegrations((prev) => [...prev, doc]);
      setShowForm(false);
      setForm({
        name: "",
        provider: "generic_webhook",
        webhookUrl: "",
        secret: "",
        events: ["flow_completed"],
      });
      showToast("success", "Webhook added");
    } catch {
      showToast("error", "Failed to add webhook");
    }
  };

  const toggle = async (i: Integration) => {
    try {
      await updateDocument("integrations", i.id, {
        isActive: !i.isActive,
        updatedAt: serverTimestamp(),
      });
      setIntegrations((prev) =>
        prev.map((x) => (x.id === i.id ? { ...x, isActive: !i.isActive } : x))
      );
    } catch {
      showToast("error", "Failed to toggle webhook");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDocument("integrations", id);
      setIntegrations((prev) => prev.filter((x) => x.id !== id));
      showToast("success", "Webhook removed");
    } catch {
      showToast("error", "Failed to remove webhook");
    }
  };

  const shellDescription = (
    <>
      Push offboarding events to your HRIS or identity provider. Each payload is
      POSTed as JSON; if you configure a secret, it's signed with HMAC-SHA256 in
      the <code>X-OffboardSet-Signature</code> header.
    </>
  );

  if (loading) {
    return (
      <SettingsShell title="HRIS Webhooks">
        <div className="py-24 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </SettingsShell>
    );
  }

  if (!unlocked) {
    return (
      <SettingsShell title="HRIS Webhooks">
        <Card>
          <div className="text-center py-8 space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-navy/5">
              <Lock size={20} className="text-navy" />
            </div>
            <h2 className="text-base font-semibold text-navy">
              HRIS webhooks require the Business plan
            </h2>
            <p className="text-sm text-mist max-w-md mx-auto">
              {shellDescription}
            </p>
            <p className="text-sm text-mist">
              You are currently on the <strong className="text-navy capitalize">{plan}</strong> plan.
            </p>
            <Link to="/settings/billing">
              <Button size="sm">Upgrade plan</Button>
            </Link>
          </div>
        </Card>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="HRIS Webhooks">
      <div>
        <p className="text-sm text-mist">{shellDescription}</p>
      </div>

      {integrations.length === 0 && !showForm ? (
        <Card>
          <EmptyState
            title="No webhooks configured"
            description="Add a webhook to automate deprovisioning, account disable, or downstream HR record updates."
            action={
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus size={14} className="mr-1" />
                Add webhook
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {integrations.map((i) => {
              const lastFired = i.lastTriggeredAt?.toDate?.();
              return (
                <Card key={i.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-navy">{i.name}</p>
                        <Badge variant={i.isActive ? "teal" : "mist"}>
                          {i.isActive ? "Active" : "Paused"}
                        </Badge>
                        <span className="text-xs text-mist">
                          {PROVIDERS.find((p) => p.value === i.provider)?.label ||
                            i.provider}
                        </span>
                      </div>
                      <p className="text-xs text-mist mt-1 truncate">
                        {i.webhookUrl}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(i.events ?? []).map((e) => (
                          <span
                            key={e}
                            className="text-xs bg-navy/5 text-navy px-2 py-0.5 rounded"
                          >
                            {EVENT_OPTIONS.find((o) => o.value === e)?.label || e}
                          </span>
                        ))}
                      </div>
                      {lastFired && (
                        <p className="text-xs text-mist mt-2 flex items-center gap-1">
                          {i.lastStatus === "error" ? (
                            <AlertTriangle size={12} className="text-ember" />
                          ) : (
                            <CheckCircle size={12} className="text-teal" />
                          )}
                          Last delivery {format(lastFired, "MMM d, yyyy h:mm a")}
                          {i.lastError ? ` — ${i.lastError}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggle(i)}
                        className="p-1 text-mist hover:text-navy transition-colors"
                        title={i.isActive ? "Pause" : "Resume"}
                      >
                        <Power size={14} />
                      </button>
                      <button
                        onClick={() => remove(i.id)}
                        className="p-1 text-mist hover:text-ember transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {!showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} className="mr-1" />
              Add webhook
            </Button>
          )}
        </>
      )}

      {showForm && (
        <Card className="border-teal/30 bg-teal/5">
          <h2 className="text-sm font-semibold text-navy mb-3">New webhook</h2>
          <div className="space-y-3">
            <Input
              label="Name"
              placeholder="e.g., Okta production"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Provider
              </label>
              <select
                value={form.provider}
                onChange={(e) =>
                  setForm({
                    ...form,
                    provider: e.target.value as IntegrationProvider,
                  })
                }
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} — {p.hint}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Webhook URL (HTTPS)"
              placeholder="https://hooks.example.com/offboarding"
              value={form.webhookUrl}
              onChange={(e) =>
                setForm({ ...form, webhookUrl: e.target.value })
              }
            />
            <Input
              label="Shared secret (optional)"
              placeholder="Used to sign the payload"
              value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Events
              </label>
              <div className="space-y-1">
                {EVENT_OPTIONS.map((e) => {
                  const checked = form.events.includes(e.value);
                  return (
                    <label key={e.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(ev) =>
                          setForm({
                            ...form,
                            events: ev.target.checked
                              ? [...form.events, e.value]
                              : form.events.filter((x) => x !== e.value),
                          })
                        }
                        className="rounded border-navy/20 text-teal focus:ring-teal"
                      />
                      <span className="text-sm text-navy">{e.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={create}>
                Save webhook
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </SettingsShell>
  );
}
