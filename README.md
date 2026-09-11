# HRExitFlow

Employee offboarding platform built with React, TypeScript, and Firebase. Manages the full exit lifecycle — task tracking, knowledge transfer, exit interviews, asset management, alumni network, and analytics.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, React Router v7
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions, Hosting)
- **Email**: Space Email / configurable SMTP (Nodemailer)
- **AI**: Google Gemini (knowledge gap analysis, sentiment analysis)
- **PDF**: Puppeteer (analytics reports)
- **Analytics**: Mixpanel

## Getting Started

### Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project with Firestore, Auth, Storage, and Functions enabled

### Local Development

1. **Clone and install dependencies**

   ```bash
   git clone https://github.com/maduranga98/hrexitflow.git
   cd hrexitflow
   npm install
   cd functions && npm install && cd ..
   ```

2. **Configure environment variables**

   ```bash
   cp .env.local.example .env.local
   # Fill in your Firebase project values
   ```

3. **Start Firebase emulators** (runs Auth, Firestore, Storage, and Functions locally)

   ```bash
   firebase emulators:start
   ```

4. **Start the dev server** (in a separate terminal)

   ```bash
   npm run dev
   ```

   The app runs at `http://localhost:5173` and connects to local emulators automatically.

### Cloud Functions Environment Variables

Set these before deploying functions. For Firebase Functions runtime config:

```bash
SMTP_HOST="mail.spacemail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="hello@feedsolve.com"
SMTP_PASSWORD="your_smtp_password"
SMTP_FROM_EMAIL="hello@feedsolve.com"
SMTP_FROM_NAME="HRExitFlow"
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="https://your-project.web.app"
```

For environment variables or `functions/.env`, use:

```bash
SMTP_HOST="mail.spacemail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="hello@feedsolve.com"
SMTP_PASSWORD="your_smtp_password"
SMTP_FROM_EMAIL="hello@feedsolve.com"
SMTP_FROM_NAME="HRExitFlow"
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="https://your-project.web.app"
```

## Deployment

The CI/CD pipeline deploys automatically via GitHub Actions:

- **Push to `main`** → deploys hosting + functions to production
- **Pull requests** → deploys a preview channel

Required GitHub Secrets:

| Secret | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_OFFBOARDKIT` | Firebase service account JSON |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase measurement ID (optional) |

To deploy manually:

```bash
npm run build
firebase deploy
```

### Free trial and the subscription lock

The last step of the setup wizard asks which package the company wants, and
it gets **7 days on that package** — no card, no Stripe object, nothing to
cancel. Choosing a plan there is not subscribing to it: no charge can happen
until someone goes through Stripe checkout, and nobody is ever put on a plan
they did not pick. Mid-trial they can move the remaining days to a different
package (`selectTrialPlan`) rather than paying to evaluate it. Enterprise is
not offered — it is quoted, not self-served.

Every plan in the price list is paid (Basic is $10/month), so there is no free
tier to fall back to. When the trial ends with nothing bought, the company is
**locked**: the app blocks and Firestore refuses its writes. Reads stay open —
the data is theirs, it is never deleted, and the billing page still has to
render.

| Where | What happens |
|---|---|
| `claimCompany` | Grants the trial in the same transaction that establishes ownership: `plan` is the package named by the wizard (validated against `TRIALABLE_PLANS`; an unknown one is refused, not silently swapped), plus `trialStatus: active`, `trialEndsAt: now + 7d`. Granted once — `trialStatus` is the record that a company already had its window. |
| `selectTrialPlan` | Moves a running trial to another package. Never touches `trialEndsAt`, so it cannot stretch the week, and refuses once the trial is over or a subscription exists. |
| `expireTrials` | Hourly sweep; lapsed trials get `trialStatus: expired` (and `plan: basic`, purely so the billing page has something coherent to show — it grants nothing). A company that subscribed meanwhile is marked `converted` and left alone. It also backfills a trial onto companies that predate trials. |
| `stripeWebhook` | Marks `trialStatus: converted` as soon as a subscription becomes active, so the sweep never touches a paying company's plan. |
| `src/lib/access.ts` | Derives the lock for the UI — `AppLayout` swaps the whole app for the lock screen, leaving only `/settings/billing` reachable. |
| `firestore.rules` | `companyActive()` — the enforcement. Every staff, team-admin and alumni write runs through it. |
| `functions/src/billing/access.ts` | `assertCompanyActive()` — callables use the admin SDK and never see security rules, so they check for themselves. |

A company is entitled when **any** of these holds, and locked otherwise:

- Stripe reports a subscription in `active`, `trialing` or `past_due` — a
  failing card keeps working while Stripe retries for weeks;
- the card-free trial window is still open;
- the company predates trials and has never touched Stripe (`legacy`). This
  exists so shipping the lock could not shut existing tenants out overnight;
  the `expireTrials` backfill hands each of them a real trial, after which
  they lock like everyone else. `stripeCustomerId` deliberately does not count
  as "has touched Stripe" — `createCheckoutSession` writes it before any
  payment is made.

The three implementations read the same fields and are deliberately derived
rather than stored: a saved flag would lag the deadline by up to an hour (the
sweep interval) and could drift from Stripe.

Every `trial*` field is server-owned: `firestore.rules` refuses both a client
write to them and a company created with them pre-set, so a trial can be
neither self-granted nor self-extended.

To change the length or which packages may be tried, edit `TRIAL_DAYS` /
`TRIALABLE_PLANS` in `functions/src/billing/trial.ts` — the server is what
validates the choice — and mirror them in `src/lib/trial.ts` and
`src/lib/plans.ts`. Plan names and prices live in `src/lib/plans.ts`, shared
by the wizard and the billing page so the two cannot quote different prices.

### Going live with Stripe

Switching from test to live mode is entirely a configuration change — no code
edits are needed, and the app refuses to run live keys against test-mode price
IDs rather than failing at the customer's checkout.

1. **Recreate the products and prices in live mode.** Toggle the Stripe
   dashboard out of test mode and create Basic, Starter, Growth and Business,
   each with a monthly and an annual recurring price. Live price IDs are
   different from the test ones — copy all eight.

2. **Set the live secrets** (Secret Manager, never committed):

   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY      # sk_live_…
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET  # whsec_… (step 4)
   ```

3. **Set the live price IDs and app URL** in `functions/.env` (or via your
   deploy pipeline). With a live secret key these are mandatory:

   ```
   APP_URL=https://offboardkit.web.app
   STRIPE_PRICE_BASIC_MONTHLY=price_…
   STRIPE_PRICE_BASIC_ANNUAL=price_…
   STRIPE_PRICE_STARTER_MONTHLY=price_…
   STRIPE_PRICE_STARTER_ANNUAL=price_…
   STRIPE_PRICE_GROWTH_MONTHLY=price_…
   STRIPE_PRICE_GROWTH_ANNUAL=price_…
   STRIPE_PRICE_BUSINESS_MONTHLY=price_…
   STRIPE_PRICE_BUSINESS_ANNUAL=price_…
   ```

4. **Register the live webhook.** Deploy functions first, then in Stripe →
   Developers → Webhooks add an endpoint for the deployed `stripeWebhook` URL
   subscribed to:

   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_succeeded`, `invoice.payment_failed`

   Copy its signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

5. **Enable the customer portal** at Stripe → Settings → Billing → Customer
   portal, allowing plan changes, cancellation and invoice history. The
   "Manage billing" button in Settings → Billing opens it; without this the
   portal session call fails.

6. **Clear stale test-mode customer IDs.** Companies that went through test
   checkout hold a test `stripeCustomerId`. The checkout function detects an
   ID that is unusable under the current keys and creates a fresh customer,
   but clearing them keeps the data honest:

   ```
   companies/*  →  delete stripeCustomerId, stripeSubscriptionId,
                   stripeSubscriptionStatus; set plan back to "basic"
   ```

7. **Verify with one real charge.** Subscribe on a live card, confirm the
   company document flips to the paid plan, then cancel from the portal and
   confirm it returns to `basic` — and, since that leaves it with no
   entitlement, that the app locks.

`VITE_STRIPE_PUBLIC_KEY` is only needed if the app ever moves to embedded
Stripe Elements; checkout today is Stripe-hosted and never loads Stripe.js in
the browser.

## Project Structure

```
src/
├── components/
│   ├── ui/          # Reusable UI primitives (Button, Card, Modal, Toast, …)
│   ├── layout/      # AppLayout, AlumniLayout, Sidebar, TopBar
│   └── shared/      # LoadingSpinner, EmptyState, ErrorBoundary
├── pages/           # Route pages (auth, dashboard, offboardings, …)
├── hooks/           # useAuth, useAlumniAuth, useNotifications, usePlanGate
├── store/           # Zustand stores (auth, company, notifications)
├── lib/             # Firebase init, Firestore helpers, PDF export
└── types/           # TypeScript interfaces for all domain models

functions/src/
├── triggers/        # Firestore event triggers and scheduled functions
├── ai/              # Gemini-powered knowledge gap and sentiment analysis
├── email/           # SMTP client and HTML email templates
└── analytics/       # Puppeteer-based PDF report generation
```

## Key Features

- **Offboarding flows** — templated task lists with dependency ordering, file upload, e-signature
- **Exit portal** — token-authenticated link sent to departing employees
- **Exit interviews** — configurable question templates with AI sentiment analysis
- **Knowledge base** — structured handover docs with AI gap detection
- **Alumni network** — opt-in alumni profiles and directory
- **Analytics** — completion rates, overdue tracking, exportable PDF reports
- **Team management** — role-based access (super_admin, hr_admin, it_admin, manager)
- **Email notifications** — automated emails on offboarding start, task assignment, overdue tasks

## Security

Firestore rules enforce:
- Authenticated users can only access data within their company
- The employee exit portal uses token-based access with field-level write restrictions
- Cloud Storage uploads are limited to 25 MB and common document/image MIME types

HTTP security headers are set via Firebase Hosting:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Static assets are cached immutably; `index.html` is never cached

## Firebase Collections

| Collection | Purpose |
|---|---|
| `users` | User profiles and roles |
| `companies` | Company settings |
| `offboardFlows` | Active offboarding processes |
| `flowTasks` | Individual tasks per flow |
| `offboardTemplates` | Reusable task list templates |
| `exitInterviewTemplates` | Interview question sets |
| `exitInterviewResponses` | Employee interview answers |
| `knowledgeItems` | Knowledge handover documents |
| `notifications` | In-app notification queue |
| `alumniProfiles` | Alumni network profiles |
| `invites` | Pending team invitations |
| `accessRevocations` | IT access removal tracking |
