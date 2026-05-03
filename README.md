# OffboardKit

Employee offboarding platform built with React, TypeScript, and Firebase. Manages the full exit lifecycle — task tracking, knowledge transfer, exit interviews, asset management, alumni network, and analytics.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, React Router v7
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions, Hosting)
- **Email**: Brevo (SMTP relay)
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
   git clone https://github.com/maduranga98/offboardkit.git
   cd offboardkit
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

Set these before deploying functions:

```bash
firebase functions:config:set \
  brevo.smtp_user="your_smtp_login@smtp-brevo.com" \
  brevo.smtp_key="your_brevo_smtp_password" \
  gemini.api_key="your_gemini_api_key" \
  app.url="https://your-project.web.app"
```

Or use a `functions/.env` file (Firebase Gen 2 / Node 20 supports this natively).

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
├── email/           # Brevo SMTP client and HTML email templates
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
