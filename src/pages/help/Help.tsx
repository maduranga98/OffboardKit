import { useState } from "react";
import {
  BookOpen,
  PlayCircle,
  Users,
  ShieldCheck,
  Package,
  GitBranch,
  TrendingUp,
  Webhook,
  Bell,
  CreditCard,
  FileText,
  HelpCircle,
  ExternalLink,
  Network,
  Briefcase,
  Megaphone,
  MessageCircle,
  BarChart3,
} from "lucide-react";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    title: "Getting started",
    icon: PlayCircle,
    body: (
      <>
        <p>
          OffboardSet walks a departing employee through every step of leaving
          your company — tasks, knowledge transfer, exit interview, asset
          return, and access revocation — and gives HR a real-time view of
          how each offboarding is progressing.
        </p>
        <ol className="list-decimal list-inside space-y-2 mt-3 text-sm">
          <li>
            <strong>Invite your team</strong> from{" "}
            <code>Settings → Team &amp; Roles</code>. Assign roles: HR
            admins start &amp; manage flows, IT admins handle access &amp;
            assets, managers approve and own their team's tasks.
          </li>
          <li>
            <strong>Create a template</strong> under{" "}
            <code>Templates</code>. Each template is a reusable checklist of
            tasks with assignees, due dates (offset from last working day),
            and optional dependencies.
          </li>
          <li>
            <strong>Start an offboarding</strong> from{" "}
            <code>Offboardings → New</code>. Pick the employee, last working
            day, template, and (optionally) approvers. The employee receives
            their portal link by email once any required approvals clear.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "starting-offboarding",
    title: "Starting an offboarding",
    icon: Users,
    body: (
      <>
        <p>
          On the New Offboarding screen, fill in the employee's details, pick
          the template that matches their role, and set the last working day.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Portal link</strong> — a unique URL is generated and
            emailed to the employee. It expires 7 days after their last day.
          </li>
          <li>
            <strong>Approvers (optional)</strong> — tick one or more team
            members to require sequential sign-off before the portal email is
            released. Order is set by the order you tick them.
          </li>
          <li>
            <strong>Task creation</strong> — tasks are created in a single
            atomic batch with usage counters; if anything fails, nothing is
            saved (no orphan flows).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "approvals",
    title: "Approval workflow",
    icon: ShieldCheck,
    body: (
      <>
        <p>
          When approvers are selected, the flow starts in{" "}
          <Badge variant="amber">Pending Approval</Badge>. The first approver
          is emailed (and gets an in-app notification). After they approve,
          the next person in the chain is notified — sequentially.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            Only the current approver sees Approve / Reject buttons in the
            <strong> Approval Chain</strong> card.
          </li>
          <li>
            If anyone rejects, the flow moves to{" "}
            <Badge variant="ember">Rejected</Badge> and HR is notified by
            email + in-app.
          </li>
          <li>
            Once the chain completes, the employee portal email goes out
            automatically.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "assets",
    title: "Asset return &amp; verification",
    icon: Package,
    body: (
      <>
        <p>
          Track every laptop, phone, badge, and access card through a
          four-state lifecycle: assigned → returned → verified → wiped.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Mark Returned</strong> — employee said it's back.
          </li>
          <li>
            <strong>Verify Return</strong> — IT physically inspected and
            accepted it (locks the condition rating).
          </li>
          <li>
            <strong>Mark Wiped</strong> — only shown for Laptop / Phone /
            Tablet. Records who performed the sanitization and when.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          The asset score on the offboarding header is weighted across all
          completed steps, so a verified-but-not-wiped laptop is only 2/3
          done.
        </p>
      </>
    ),
  },
  {
    id: "dependencies",
    title: "Task dependencies (DAG view)",
    icon: GitBranch,
    body: (
      <>
        <p>
          Open <code>Offboardings → [flow] → Dependencies</code> to see the
          tasks as a left-to-right graph.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Critical path</strong> (teal) — the longest chain of
            dependent tasks; if anything on it slips, the whole flow slips.
          </li>
          <li>
            <strong>Cycle warning</strong> (red) — if you accidentally make
            task A depend on B which depends on A, those tasks land in a
            trailing column flagged with a Cycle badge.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          Dependencies are defined on the template (
          <code>dependsOnTaskId</code>) and carried into every flow created
          from that template.
        </p>
      </>
    ),
  },
  {
    id: "audit-log",
    title: "Audit log (Activity tab)",
    icon: FileText,
    body: (
      <>
        <p>
          Every offboarding has an immutable activity log on the{" "}
          <strong>Activity</strong> tab. Entries cover flow creation,
          approval decisions, status changes, portal accesses, task updates,
          exit interview submissions, knowledge items added, and the asset
          lifecycle.
        </p>
        <p className="mt-3 text-sm">
          Writes come from Cloud Functions only — clients can't modify or
          delete entries, which makes the log usable as evidence for
          compliance (GDPR, SOX).
        </p>
      </>
    ),
  },
  {
    id: "trends",
    title: "Trend dashboard",
    icon: TrendingUp,
    body: (
      <>
        <p>
          <code>Analytics → Trends</code> rolls up every submitted exit
          interview:
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>Sentiment over time (line chart, monthly average).</li>
          <li>Positive / neutral / negative breakdown by department.</li>
          <li>
            Top themes ranked by frequency, each tagged with average
            sentiment.
          </li>
          <li>Top AI-extracted risk flags.</li>
          <li>3m / 6m / 12m / all-time range toggle.</li>
        </ul>
      </>
    ),
  },
  {
    id: "notifications",
    title: "Notifications &amp; escalation",
    icon: Bell,
    body: (
      <>
        <p>
          The bell icon in the top bar shows your recent notifications. For
          actionable items — overdue tasks, approval requests, risk flags —
          you'll see an "Acknowledge — I'll handle this" button.
        </p>
        <p className="mt-3 text-sm">
          Acknowledging is stronger than reading: it tells the system you're
          taking responsibility. If an actionable notification isn't acked
          within 3 days, it auto-escalates to every super admin (email +
          in-app) and is tagged <Badge variant="ember">Escalated</Badge>.
        </p>
      </>
    ),
  },
  {
    id: "webhooks",
    title: "HRIS webhooks",
    icon: Webhook,
    body: (
      <>
        <p>
          Configure outbound webhooks at{" "}
          <code>Settings → HRIS Webhooks</code> to push offboarding events
          into your HRIS or identity provider.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            Each delivery is a JSON POST:{" "}
            <code>{`{ event, occurredAt, data }`}</code>.
          </li>
          <li>
            If you set a shared secret, the request body is signed and the
            signature arrives in the <code>X-OffboardSet-Signature</code>{" "}
            header (HMAC-SHA256).
          </li>
          <li>
            Events: <code>flow_completed</code>, <code>flow_cancelled</code>,{" "}
            <code>approval_completed</code>, <code>asset_wiped</code>.
          </li>
          <li>
            Last delivery status and error are shown on each webhook so you
            can debug from the UI without checking logs.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "billing",
    title: "Billing &amp; plans",
    icon: CreditCard,
    body: (
      <>
        <p>
          Plans are managed at <code>Settings → Billing</code>. Only team
          admins (HR admin or super admin) can change the subscription.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Free</strong> — limited offboardings per year; counter
            resets automatically on January 1.
          </li>
          <li>
            Upgrades go through Stripe Checkout. Your plan updates within
            ~30 seconds of payment (the page polls automatically).
          </li>
          <li>
            Cancelling a subscription in Stripe drops the company back to
            free at the end of the billing period.
          </li>
          <li>
            Failed payments trigger an automatic downgrade — you'll see a{" "}
            <Badge variant="ember">past_due</Badge> status until the card is
            updated in Stripe.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "compliance-reports",
    title: "Monthly compliance reports",
    icon: FileText,
    body: (
      <>
        <p>
          On the 1st of each month, super admins and HR admins receive a CSV
          summary of every offboarding closed the prior month — employee,
          role, department, status, task completion %, approval status, and
          dates. The CSV is attached to the email and the run is logged in{" "}
          <code>complianceReports</code> for the audit trail.
        </p>
      </>
    ),
  },
  {
    id: "alumni-portal",
    title: "Alumni portal overview",
    icon: Network,
    body: (
      <>
        <p>
          The alumni portal (Growth plan and above) lets HR teams stay connected
          with former employees after offboarding. Opted-in alumni get a private
          portal where they can update their profile, view announcements, browse
          open roles, and respond to pulse surveys.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Opt-in only</strong> — alumni must explicitly consent during
            offboarding or via their portal invite. HR can see who has opted in
            from the Directory tab.
          </li>
          <li>
            <strong>Exit interview card</strong> — when an alumni was offboarded
            via OffboardKit, their exit interview data (sentiment, themes, risk
            flags, NPS) auto-populates their HR alumni profile. No manual entry
            required.
          </li>
          <li>
            <strong>Re-engagement score</strong> — a 0–100 score computed per
            alumni based on login recency, survey responses, job views, referrals,
            and return intent. Scores update automatically on every portal event.
          </li>
          <li>
            <strong>Network health widget</strong> — live snapshot on the Analytics
            page showing opted-in count, boomerang pipeline stages, referral
            conversion, and a suggested priority action.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "boomerang-pipeline",
    title: "Boomerang hire pipeline",
    icon: GitBranch,
    body: (
      <>
        <p>
          Track alumni you want to re-hire through a Kanban pipeline:{" "}
          <strong>Potential → Contacted → Interviewing → Rehired</strong>. Available
          on Growth (2 stages) and Business (full 4-stage) plans.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            Alumni cards show exit interview context, tenure, department, and
            recent portal activity to help prioritise outreach.
          </li>
          <li>
            Alumni can toggle <strong>Open to Return / Not Right Now</strong> from
            their portal. This flag is visible in the directory and affects the
            re-engagement score.
          </li>
          <li>
            Moving a card through stages records the action in the alumni's
            engagement log for audit purposes.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "job-board",
    title: "Job board &amp; referral flow",
    icon: Briefcase,
    body: (
      <>
        <p>
          Post open roles directly to your alumni network from the Job Board tab.
          Available on Growth and above.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Audience targeting</strong> (Business+) — limit visibility to
            all alumni, a specific department, or rehire candidates only.
          </li>
          <li>
            Alumni can <strong>Apply</strong>, <strong>Refer someone</strong>, or
            hide a post. Applications and referrals appear in the HR Job Board
            panel.
          </li>
          <li>
            Business plan adds hire conversion tracking — mark a referral as hired
            to measure referral analytics.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "pulse-surveys",
    title: "Pulse survey system",
    icon: BarChart3,
    body: (
      <>
        <p>
          Send short 3-question surveys to opted-in alumni to measure satisfaction
          and return intent. Available on Growth and above.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            Alumni receive a tokenised email link — <strong>no login required</strong>{" "}
            to respond. One question at a time, ~30 second completion.
          </li>
          <li>
            Results aggregate into: response rate, satisfaction score, would-return
            %, and would-refer %.
          </li>
          <li>
            <strong>Default questions:</strong> (1) How's your current role going?
            (1–5), (2) Would you consider returning? (Yes / Maybe / No), (3) Would
            you refer someone to work here? (Yes / No).
          </li>
          <li>
            Business plan adds scheduled surveys (quarterly / bi-annual) and full
            analytics filtering.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "announcements",
    title: "Company announcements feed",
    icon: Megaphone,
    body: (
      <>
        <p>
          HR can publish posts to opted-in alumni — news, open roles, milestones,
          and events. Alumni see an in-portal feed and receive an optional email
          digest.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            Posts are read-only for alumni. HR can target by audience on Growth+
            plans.
          </li>
          <li>
            Read tracking per alumni is recorded in{" "}
            <code>alumniAnnouncementReads</code> for engagement analytics.
          </li>
          <li>
            Starter plan gets basic announcements (news + roles). Growth and above
            unlock all post types with audience targeting.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "ask-the-expert",
    title: "Ask the Expert threads",
    icon: MessageCircle,
    body: (
      <>
        <p>
          Business plan only. Open a question thread directly from a completed
          offboarding record to retrieve post-departure knowledge from the former
          employee.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            The alumni receives an email notification and replies inline from their
            portal — no extra account setup.
          </li>
          <li>
            Threads are linked to specific knowledge items and remain searchable in
            the Knowledge Base.
          </li>
          <li>
            <strong>HR view:</strong> Thread inbox in Alumni tab · "Ask [Name]" button
            on completed offboarding records · Close thread when resolved.
          </li>
          <li>
            <strong>Alumni view:</strong> Question inbox in portal · Reply inline ·
            Email notification on each new question.
          </li>
        </ul>
        <p className="mt-3 text-sm text-mist">
          No other offboarding platform offers post-departure knowledge retrieval.
        </p>
      </>
    ),
  },
  {
    id: "consulting-pool",
    title: "Consulting &amp; gig requests",
    icon: Users,
    body: (
      <>
        <p>
          Business plan only. Alumni can toggle "Available for Consulting" in
          their profile and list their skills. HR browses a consulting pool
          filtered by skill and department.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            <strong>Send a gig request</strong> — include scope, timeline, and
            budget. Alumni accept, decline (with a note), or reconsider within 24h.
          </li>
          <li>
            Status lifecycle:{" "}
            <code>sent → accepted → declined → completed</code>
          </li>
          <li>
            Completed gigs are logged to the alumni's profile and appear in HR's
            consulting history.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "reference-letters",
    title: "Reference letters &amp; verification",
    icon: FileText,
    body: (
      <>
        <p>
          Business plan only. Alumni can request reference letters or employment
          verification certificates directly from their portal. HR approves with
          one click.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-3 text-sm">
          <li>
            A Cloud Function generates a branded PDF with company letterhead and
            delivers it by email. Also downloadable from the alumni portal.
          </li>
          <li>
            <strong>Employment verification</strong> includes: company name, employee
            name, role, department, employment dates, total tenure, and the
            approving HR user's signature. Gender-neutral language by default.
          </li>
          <li>
            Requests appear in the HR panel under{" "}
            <code>Alumni → Requests</code> with status tracking.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "faq",
    title: "FAQ",
    icon: HelpCircle,
    body: (
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-medium text-navy">
            Why didn't the employee receive their portal email?
          </dt>
          <dd className="text-mist mt-1">
            Most likely the flow is in <code>pending_approval</code> — the
            email is held until the approval chain completes. Check the
            Approval Chain card on the flow detail page.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            Can the portal link be used after the last working day?
          </dt>
          <dd className="text-mist mt-1">
            Yes, for 7 days after the last working day. After that the
            <code>portalExpiresAt</code> guard in Firestore rules blocks
            further access.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            Who can see the activity log?
          </dt>
          <dd className="text-mist mt-1">
            Any signed-in member of the company can read the log; nobody
            (including admins) can write to it from the client.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            What happens if an asset is marked missing?
          </dt>
          <dd className="text-mist mt-1">
            It still counts toward the asset return score, but you can flag
            its condition as "missing" so the audit log records it. Combine
            with an HRIS webhook on <code>flow_completed</code> to trigger
            downstream loss-prevention.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            How do I rotate the webhook secret?
          </dt>
          <dd className="text-mist mt-1">
            Edit the webhook entry under <code>Settings → HRIS Webhooks</code>
            , paste a new secret, and rotate it on the receiving end. There's
            no overlap window — coordinate the change.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            How does an alumni opt in to the portal?
          </dt>
          <dd className="text-mist mt-1">
            During the offboarding process the employee portal includes an opt-in
            checkbox. HR can also send a manual invite from the Alumni → Directory
            tab. Opted-out alumni don't appear in the directory and receive no
            communications.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            What plan do I need for the alumni portal?
          </dt>
          <dd className="text-mist mt-1">
            Growth ($79/mo) unlocks the full alumni directory, job board, pulse
            surveys, boomerang pipeline (2 stages), and re-engagement scores.
            Business ($199/mo) adds Ask the Expert threads, consulting pool,
            reference letter generation, 4-stage Kanban pipeline, and scheduled
            surveys.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-navy">
            Can an alumni withdraw consent?
          </dt>
          <dd className="text-mist mt-1">
            Yes. Alumni can opt out at any time from their portal profile. This
            immediately removes them from the directory, stops all email
            communications, and marks them as opted-out in Firestore. Their
            historical data is retained for the company's audit log.
          </dd>
        </div>
      </dl>
    ),
  },
];

export default function Help() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  const onJump = (id: string) => {
    setActive(id);
    const el = document.getElementById(`help-${id}`);
    if (!el) return;
    const scroller = el.closest("main");
    if (!scroller) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const top =
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      24;
    const max = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTo({ top: Math.min(Math.max(top, 0), max), behavior: "smooth" });
  };

  return (
    <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-6 max-w-full">
      <aside className="lg:sticky lg:top-6 lg:self-start min-w-0 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <Card padding="sm">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <BookOpen size={16} className="text-teal" />
            <p className="text-sm font-semibold text-navy">Help &amp; guides</p>
          </div>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => onJump(s.id)}
                  className={clsx(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left",
                    active === s.id
                      ? "bg-teal/10 text-teal"
                      : "text-mist hover:text-navy hover:bg-navy/5"
                  )}
                >
                  <Icon size={14} />
                  <span dangerouslySetInnerHTML={{ __html: s.title }} />
                </button>
              );
            })}
          </nav>
        </Card>
      </aside>

      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="text-2xl font-display text-navy">Help &amp; Instructions</h1>
          <p className="text-sm text-mist mt-1">
            How OffboardSet works, end to end. Use the sidebar to jump to a
            section.
          </p>
        </div>

        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.id} id={`help-${s.id}`} className="scroll-mt-6 min-w-0">
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={18} className="text-teal flex-shrink-0" />
                  <h2
                    className="text-lg font-semibold text-navy break-words min-w-0"
                    dangerouslySetInnerHTML={{ __html: s.title }}
                  />
                </div>
                <div className="text-sm text-navy/80 space-y-2 leading-relaxed break-words [&_code]:break-all">
                  {s.body}
                </div>
              </Card>
            </section>
          );
        })}

        <Card className="border-teal/30 bg-teal/5">
          <div className="flex items-start gap-3">
            <HelpCircle size={20} className="text-teal mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-navy">
                Still stuck?
              </p>
              <p className="text-sm text-mist mt-1">
                Email{" "}
                <a
                  href="mailto:support@offboardkit.com"
                  className="text-teal hover:underline inline-flex items-center gap-1"
                >
                  support@offboardkit.com <ExternalLink size={12} />
                </a>{" "}
                with the flow ID and a brief description of what you expected
                to happen.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
