# OffboardKit — QA Test Cases

> **Instructions for Tester**
> Work through each test case in order. For every case, fill in **Actual Result** and mark **Status** as `PASS` or `FAIL`.
> If FAIL, write the reason under **Notes**. Return the completed document when done.

---

## Sample Test Data

Use the credentials and data below throughout all test cases.

### Test Accounts

| Role | Email | Password | Expected Access |
|------|-------|----------|-----------------|
| Super Admin | admin@testcorp.com | Test@1234 | Full access to everything |
| HR Admin | hr@testcorp.com | Test@1234 | Offboardings, interviews, alumni, settings |
| Manager | manager@testcorp.com | Test@1234 | Assigned offboardings, task review |
| IT Admin | it@testcorp.com | Test@1234 | Access revocation tasks only |

> Create these accounts via the Signup page before starting tests.

### Sample Company

| Field | Value |
|-------|-------|
| Company Name | TestCorp Solutions |
| Domain | testcorp.com |
| Company Size | 50–200 |
| Industry | Technology |
| Country | United States |
| Timezone | America/New_York |

### Sample Employees (for creating offboarding flows)

| # | Name | Email | Role | Department | Exit Type | Last Working Day |
|---|------|-------|------|------------|-----------|-----------------|
| 1 | John Doe | john.doe@testcorp.com | Software Engineer | Engineering | Voluntary | 2 weeks from today |
| 2 | Jane Smith | jane.smith@testcorp.com | Sales Representative | Sales | Voluntary | 3 weeks from today |
| 3 | Mike Johnson | mike.johnson@testcorp.com | Product Manager | Product | Retirement | 1 month from today |
| 4 | Sarah Lee | sarah.lee@testcorp.com | HR Coordinator | HR | Involuntary | 1 week from today |
| 5 | Tom Brown | tom.brown@testcorp.com | IT Specialist | IT | Contract End | 10 days from today |

### Sample Knowledge Items

| Title | Type | Description |
|-------|------|-------------|
| Deployment Process | Process | Steps to deploy to production using CI/CD pipeline |
| AWS Account Credentials | Credential Handover | Root and IAM credentials for AWS account |
| Q3 Sales Pipeline | Document | Active deals and contacts in HubSpot CRM |
| System Architecture Overview | Video Link | Loom video walkthrough of microservices setup |
| Key Client: Acme Corp | Contact | Primary contact is David Lee, david@acme.com, renewal due June |

### Sample Exit Interview Answers

Use these answers when filling exit interview forms in the employee portal:

| Question Type | Sample Answer |
|---------------|---------------|
| Why are you leaving? (text) | I received a better opportunity with higher compensation and growth potential. |
| Overall satisfaction rating (rating 1–5) | 3 |
| Would you recommend working here? (yes/no) | Yes |
| What did you enjoy most? (text) | The team culture and collaborative environment. |
| What could be improved? (text) | Career progression paths and salary reviews need improvement. |
| Biggest challenge faced (text) | Unclear product direction at times made prioritization difficult. |

---

## Test Cases

---

### Module 1 — Authentication

---

**TC-AUTH-01**
**Feature:** Sign Up — New User Registration
**Pre-condition:** App is running. No account exists for the email.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/signup` | Sign up form is displayed with Name, Email, Password fields |
| 2 | Enter Name: `Admin User`, Email: `admin@testcorp.com`, Password: `Test@1234` | Fields accept input |
| 3 | Click **Sign Up** | User is created and redirected to `/setup` (Setup Wizard) |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-AUTH-02**
**Feature:** Setup Wizard — Company Onboarding
**Pre-condition:** Logged in as `admin@testcorp.com`. Redirected to `/setup`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill Company Name: `TestCorp Solutions`, Domain: `testcorp.com` | Fields accept input |
| 2 | Select Size: `50–200`, Industry: `Technology` | Dropdowns work correctly |
| 3 | Select offboarding template: `General Employee Exit` | Template highlighted/selected |
| 4 | Click **Finish Setup** | Company is saved. Redirected to `/dashboard` |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-AUTH-03**
**Feature:** Login — Email & Password
**Pre-condition:** Account `admin@testcorp.com / Test@1234` exists.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/login` | Login form is displayed |
| 2 | Enter `admin@testcorp.com` and `Test@1234` | Fields accept input |
| 3 | Click **Sign In** | Redirected to `/dashboard` |
| 4 | Verify top bar shows the user's name or avatar | User name/avatar visible |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-AUTH-04**
**Feature:** Login — Invalid Credentials
**Pre-condition:** None.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/login` | Login form shown |
| 2 | Enter `wrong@email.com` and `WrongPass` | Fields accept input |
| 3 | Click **Sign In** | Error message displayed (e.g., "Invalid email or password"). Not redirected. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-AUTH-05**
**Feature:** Logout
**Pre-condition:** Logged in as `admin@testcorp.com`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click user avatar or account menu | Dropdown or menu appears |
| 2 | Click **Sign Out** / **Logout** | Session cleared. Redirected to `/login` |
| 3 | Try navigating to `/dashboard` manually | Redirected back to `/login` |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-AUTH-06**
**Feature:** Invite — Team Member Signup via Invite Link
**Pre-condition:** Logged in as `admin@testcorp.com`. Go to `/settings/team`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Invite Member** | Modal or form appears |
| 2 | Enter Email: `hr@testcorp.com`, Role: `HR Admin` | Fields accept input |
| 3 | Click **Send Invite** | Success message shown. Invite stored in system. |
| 4 | Open a new browser/incognito and sign up with `hr@testcorp.com / Test@1234` | Signup succeeds. User is automatically assigned HR Admin role and linked to TestCorp Solutions. |
| 5 | Log in and check role | Dashboard shows HR Admin view, not setup wizard |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-AUTH-07**
**Feature:** Google Sign-In
**Pre-condition:** Google account available.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/login` | Login page displayed |
| 2 | Click **Continue with Google** | Google OAuth popup appears |
| 3 | Select a Google account | Popup closes. Redirected to `/dashboard` or `/setup` |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 2 — Dashboard

---

**TC-DASH-01**
**Feature:** Dashboard — Initial Load
**Pre-condition:** Logged in as `admin@testcorp.com`. At least one offboarding flow exists.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/dashboard` | Page loads without errors |
| 2 | Check summary widgets | Cards show: Active Offboardings, Completed This Month, Pending Tasks, Knowledge Items |
| 3 | Check recent offboardings list | Table or card list of recent offboarding flows shown |
| 4 | Check sidebar navigation | Links: Dashboard, Offboardings, Templates, Interviews, Knowledge, Analytics, Alumni, Settings |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-DASH-02**
**Feature:** Dashboard — Notification Bell
**Pre-condition:** Logged in. A notification exists (triggered by creating an offboarding).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Look for bell icon in top bar | Bell icon visible, shows unread badge count |
| 2 | Click bell icon | Notification panel/dropdown opens |
| 3 | Click a notification | Navigates to the relevant page (e.g., offboarding detail) |
| 4 | Click **Mark All Read** | Badge count clears to zero |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 3 — Offboarding Flows

---

**TC-OB-01**
**Feature:** Create New Offboarding Flow
**Pre-condition:** Logged in as `admin@testcorp.com`. Templates seeded from setup.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Offboardings** in sidebar | `/offboardings` page loads, shows list (may be empty) |
| 2 | Click **New Offboarding** | Navigate to `/offboardings/new` |
| 3 | Fill Employee Name: `John Doe` | Field accepts input |
| 4 | Fill Employee Email: `john.doe@testcorp.com` | Field accepts input |
| 5 | Fill Role: `Software Engineer`, Department: `Engineering` | Fields accept input |
| 6 | Fill Manager ID / assign manager | Manager field filled |
| 7 | Select Exit Type: `Voluntary` | Dropdown works |
| 8 | Set Last Working Day to 2 weeks from today | Date picker works |
| 9 | Select Template: `Software Engineer Exit` | Template selected |
| 10 | Click **Create Offboarding** | Flow created. Redirected to offboarding detail page. Tasks pre-populated from template. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-OB-02**
**Feature:** Create Offboarding — Validation
**Pre-condition:** On `/offboardings/new`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Leave all fields blank and click **Create Offboarding** | Validation errors shown for required fields (Name, Email, Last Working Day) |
| 2 | Fill only the name and try to submit | Still shows errors for remaining required fields |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-OB-03**
**Feature:** Offboarding Detail — Task List
**Pre-condition:** John Doe's offboarding flow exists (from TC-OB-01).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open John Doe's offboarding from the list | Detail page loads at `/offboardings/:id` |
| 2 | Check task list | Tasks from "Software Engineer Exit" template are listed with due dates |
| 3 | Check task assignees | Tasks show correct assignee roles (HR Admin, Employee, IT Admin, Manager) |
| 4 | Check progress bar | Shows current completion percentage |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-OB-04**
**Feature:** Complete a Task
**Pre-condition:** John Doe's offboarding detail page is open.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find task "Send offboarding welcome email" | Task shown with status: Pending |
| 2 | Click the task or checkbox to mark complete | Task status changes to Completed |
| 3 | Check progress bar | Progress percentage increases |
| 4 | Reload the page | Task still shows as Completed (persisted to Firestore) |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-OB-05**
**Feature:** Skip a Non-Required Task
**Pre-condition:** John Doe's offboarding detail page is open.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find task "Send reference letter if applicable" (non-required) | Task shown |
| 2 | Click **Skip** on the task | Task status changes to Skipped. Does not block progress. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-OB-06**
**Feature:** Upload File to Upload Task
**Pre-condition:** John Doe's offboarding has an upload-type task.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find a task with type "upload" | Upload button visible on the task |
| 2 | Click upload and select a PDF file (< 25 MB) | File upload dialog opens |
| 3 | Confirm upload | File uploaded. Task shows file link or preview. Task marked complete. |
| 4 | Try uploading a file > 25 MB | Error: file size limit exceeded |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-OB-07**
**Feature:** Offboarding List — Filter and Sort
**Pre-condition:** Multiple offboarding flows exist (create at least Jane Smith and Mike Johnson flows).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/offboardings` | All flows listed |
| 2 | Filter by status "In Progress" | Only in-progress flows shown |
| 3 | Filter by department "Engineering" | Only Engineering flows shown |
| 4 | Search by name "Jane" | Jane Smith's flow appears |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-OB-08**
**Feature:** Portal Link — Generate and Copy
**Pre-condition:** John Doe's offboarding detail is open.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find "Portal Link" or "Employee Portal" section | Portal URL is displayed |
| 2 | Click **Copy Link** | Link copied to clipboard. Success toast shown. |
| 3 | Paste the link into a new tab | Navigates to `/portal/:token` — employee portal loads |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-OB-09**
**Feature:** Cancel Offboarding Flow
**Pre-condition:** Create a new offboarding flow for Sarah Lee.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Sarah Lee's offboarding detail | Detail page loads |
| 2 | Click **Cancel Offboarding** (or equivalent action) | Confirmation dialog appears |
| 3 | Confirm cancellation | Flow status changes to Cancelled. Cannot edit tasks. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-OB-10**
**Feature:** Completion Scores — All Sections
**Pre-condition:** John Doe's offboarding is in progress.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open John Doe's offboarding detail | Completion scores section visible |
| 2 | Check score breakdown | Separate scores shown for: Tasks, Knowledge, Access Revocation, Exit Interview, Assets |
| 3 | Complete the exit interview (via portal) | Exit Interview score updates (0 → 100) |
| 4 | Mark all access revocations complete | Access Revocation score updates |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 4 — Offboarding Templates

---

**TC-TMPL-01**
**Feature:** View Default Templates
**Pre-condition:** Company setup completed. Templates seeded.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/templates` | List shows: General Employee Exit, Software Engineer Exit, Sales Representative Exit |
| 2 | Click "General Employee Exit" | Template detail page opens at `/templates/:id` |
| 3 | Check task list | All 8 general tasks displayed with roles and day offsets |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-TMPL-02**
**Feature:** Create Custom Template
**Pre-condition:** Logged in as HR Admin or Super Admin.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On `/templates`, click **New Template** | Template creation form opens |
| 2 | Enter Name: `Finance Team Exit`, Description: `For finance staff departures`, Target Role: `Accountant` | Fields accept input |
| 3 | Add task: Title: `Transfer financial records`, Assigned to: `HR Admin`, Day Offset: `-5`, Required: Yes | Task added to list |
| 4 | Add task: Title: `Revoke accounting software access`, Assigned to: `IT Admin`, Day Offset: `0`, Required: Yes | Task added |
| 5 | Click **Save Template** | Template saved. Visible in template list. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-TMPL-03**
**Feature:** Edit Existing Template
**Pre-condition:** `Finance Team Exit` template exists.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open `Finance Team Exit` template | Template detail opens |
| 2 | Click **Edit** on a task | Task fields become editable |
| 3 | Change task title to `Archive and transfer financial records` | Field updated |
| 4 | Save changes | Updated title shown in task list |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-TMPL-04**
**Feature:** Set Default Template
**Pre-condition:** Multiple templates exist.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open any non-default template | Template detail open |
| 2 | Click **Set as Default** | Template marked as default. Previous default is unset. |
| 3 | Create a new offboarding | Default template is pre-selected |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 5 — Employee Exit Portal

---

**TC-PORTAL-01**
**Feature:** Portal Entry — Valid Token
**Pre-condition:** John Doe's offboarding portal link copied from TC-OB-08.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Paste portal link in a new incognito browser tab | Portal page loads at `/portal/:token` |
| 2 | Check page content | Greeting with John Doe's name, company name, last working day, and list of available actions |
| 3 | Check available sections | Should show: Exit Interview, Knowledge Transfer |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-PORTAL-02**
**Feature:** Portal — Submit Exit Interview
**Pre-condition:** Portal open for John Doe. Exit interview template exists.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Start Exit Interview** | Exit interview questions shown |
| 2 | Answer all questions using the sample answers from the test data section above | All fields filled |
| 3 | Click **Submit** | Success message displayed. Form cannot be re-submitted. |
| 4 | Go back to HR dashboard → Interviews page | John Doe's response appears in the list |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-PORTAL-03**
**Feature:** Portal — Add Knowledge Item
**Pre-condition:** Portal open for John Doe.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Add Knowledge Item** | Knowledge item form appears |
| 2 | Fill Title: `Deployment Process`, Type: `Process`, Description: `Steps to deploy to production using CI/CD pipeline`, Successor: `New DevOps Hire` | Fields filled |
| 3 | Click **Save** | Item saved. Appears in the knowledge list. |
| 4 | Add a second item: Title: `AWS Account Credentials`, Type: `Credential Handover` | Item saved |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-PORTAL-04**
**Feature:** Portal — Expired Token
**Pre-condition:** None (simulate by using a fake/modified token).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/portal/invalid-or-expired-token` | Page shows "Invalid or expired portal link" error. Does not show any employee data. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 6 — Exit Interviews

---

**TC-INT-01**
**Feature:** View Interview Responses
**Pre-condition:** John Doe submitted interview from TC-PORTAL-02.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/interviews` | Interviews list page loads |
| 2 | Verify John Doe's response appears | Response card shows employee name, department, sentiment label, and submitted date |
| 3 | Click on John Doe's response | Detail view opens showing all questions and answers |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-INT-02**
**Feature:** AI Sentiment Analysis
**Pre-condition:** John Doe's interview submitted. Wait 30–60 seconds for Cloud Function to run.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open John Doe's interview response | Detail page shown |
| 2 | Check for AI analysis section | Sentiment label shown (Positive / Neutral / Negative) |
| 3 | Check key themes | At least 2–3 themes listed (e.g., "Compensation", "Career Growth") |
| 4 | Check risk flags | If negative sentiment, risk flags shown (e.g., "Compensation concern") |
| 5 | Check recommended actions | At least 1 recommended action displayed |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-INT-03**
**Feature:** Create Exit Interview Template
**Pre-condition:** Logged in as HR Admin or Super Admin.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/interviews` | Interview list shown |
| 2 | Click **New Template** or equivalent | Template editor opens |
| 3 | Add question: `Why are you leaving?`, Type: `Text`, Required: Yes | Question added |
| 4 | Add question: `Overall satisfaction`, Type: `Rating (1–5)`, Required: Yes | Question added |
| 5 | Add question: `Would you recommend us as an employer?`, Type: `Yes/No`, Required: No | Question added |
| 6 | Add question: `Main reason for leaving`, Type: `Multiple Choice`, Options: `Better opportunity, Compensation, Work-life balance, Relocation, Other` | Question with options added |
| 7 | Click **Save Template** | Template saved and listed |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 7 — Knowledge Base

---

**TC-KB-01**
**Feature:** View Knowledge Items
**Pre-condition:** John Doe submitted knowledge items from TC-PORTAL-03.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/knowledge` | Knowledge base page loads |
| 2 | Check that John Doe's items appear | "Deployment Process" and "AWS Account Credentials" visible |
| 3 | Filter by Type: `Process` | Only process-type items shown |
| 4 | Filter by Department: `Engineering` | Only Engineering items shown |
| 5 | Filter by Status: `Submitted` | Items awaiting review shown |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-KB-02**
**Feature:** Manager Verification of Knowledge Item
**Pre-condition:** A knowledge item with status `Submitted` exists.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as Manager (`manager@testcorp.com`) | Logged in |
| 2 | Navigate to `/knowledge` | Knowledge items visible |
| 3 | Open `Deployment Process` item | Detail or inline edit shown |
| 4 | Click **Approve** | Item marked as Manager Verified. Status changes to `Reviewed`. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-KB-03**
**Feature:** AI Knowledge Gap Detection
**Pre-condition:** John Doe's offboarding has at least 2 knowledge items. Logged in as Super Admin or HR Admin. Company plan is Pro or Enterprise.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open John Doe's offboarding detail | Detail page open |
| 2 | Click **Detect Knowledge Gaps** | Loading state shown. AI analysis starts. |
| 3 | Wait 15–30 seconds | Gap analysis results displayed: completeness score, identified gaps, strengths, overall assessment |
| 4 | Check `/knowledge/gaps` page | Detected gaps listed with severity (Critical / High / Medium / Low) |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-KB-04**
**Feature:** Knowledge Gap — Resolve Gap
**Pre-condition:** A gap exists from TC-KB-03.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/knowledge/gaps` | Gaps list shown |
| 2 | Click on a gap | Gap detail visible with severity and description |
| 3 | Click **Resolve** | Resolution dialog opens |
| 4 | Enter resolution note: `Employee added detailed video walkthrough covering this area.` | Note entered |
| 5 | Click **Mark Resolved** | Gap status changes to Resolved. Removed from open gaps list. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-KB-05**
**Feature:** Knowledge Gap Detection — Free Plan Restriction
**Pre-condition:** Company plan is set to Free.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open any offboarding detail | Detail page open |
| 2 | Attempt to click **Detect Knowledge Gaps** | Feature locked. Upgrade prompt shown (e.g., "Available on Pro plan and above") |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 8 — Access Revocation

---

**TC-REV-01**
**Feature:** View Access Revocation Checklist
**Pre-condition:** John Doe's offboarding detail open. Access revocation section visible.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to John Doe's offboarding detail | Page loaded |
| 2 | Find access revocation section | List of tools/systems to revoke shown (e.g., GitHub, AWS, Slack, Jira) |
| 3 | Check statuses | All items start as `Pending` |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-REV-02**
**Feature:** Mark Access as Revoked
**Pre-condition:** Logged in as IT Admin (`it@testcorp.com`).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open John Doe's offboarding (IT Admin can access it) | Detail page open |
| 2 | Find access revocation checklist | Checklist visible |
| 3 | Click **Revoke** on `GitHub` | Status changes to Revoked. Timestamp and IT Admin's name recorded. |
| 4 | Click **Revoke** on `AWS` | Same as above |
| 5 | Click **Not Applicable** on `Salesforce` | Status changes to N/A |
| 6 | Check overall Access Revocation completion score | Score increases proportionally |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 9 — Analytics

---

**TC-ANA-01**
**Feature:** Analytics Dashboard
**Pre-condition:** At least 2 completed offboarding flows exist.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/analytics` | Analytics page loads |
| 2 | Check completion rate chart | Bar or line chart visible with completion data |
| 3 | Check average offboarding duration | Metric card shows average days |
| 4 | Check sentiment breakdown chart | Pie/bar chart with Positive / Neutral / Negative counts |
| 5 | Check offboardings by department | Chart grouped by department |
| 6 | Check knowledge transfer score | Average score displayed |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-ANA-02**
**Feature:** Export Analytics as PDF
**Pre-condition:** Logged in as HR Admin or Super Admin.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/analytics` | Analytics page loaded |
| 2 | Click **Export PDF** or **Download Report** | Loading indicator appears |
| 3 | Wait for PDF generation (up to 30 seconds) | PDF file downloaded. Contains charts and summary data. |
| 4 | Open PDF | Data in PDF matches data on screen |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 10 — Alumni Network

---

**TC-ALM-01**
**Feature:** Alumni Profile Auto-Creation
**Pre-condition:** John Doe's offboarding is marked Complete and he opted into alumni network.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/alumni` | Alumni list page loads |
| 2 | Verify John Doe appears | Profile card shows name, former role, department, exit date |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-ALM-02**
**Feature:** Update Alumni Status
**Pre-condition:** John Doe's alumni profile exists.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open John Doe's alumni profile | Profile detail shown |
| 2 | Change Status to `Rehire Candidate` | Dropdown/select updates |
| 3 | Set Rehire Priority to `High` | Priority updated |
| 4 | Add note: `Strong performer. Reach out in 6 months.` | Note saved |
| 5 | Add tags: `Engineering`, `Top Performer` | Tags added |
| 6 | Save changes | Changes persisted. Profile reflects new status and tags. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-ALM-03**
**Feature:** Update LinkedIn and Current Company
**Pre-condition:** John Doe's alumni profile exists.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open John Doe's alumni profile | Profile detail shown |
| 2 | Add LinkedIn URL: `https://linkedin.com/in/johndoe` | Field accepts URL |
| 3 | Add Current Company: `Acme Corp` | Field accepts text |
| 4 | Add Current Role: `Senior Engineer` | Field accepts text |
| 5 | Save | Changes saved and displayed |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-ALM-04**
**Feature:** Alumni Portal — Login
**Pre-condition:** Alumni opted in and has an alumni profile. Company plan includes Alumni Portal feature.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/alumni-login` | Alumni login page shown |
| 2 | Sign in with `john.doe@testcorp.com` (Google or email) | Logged in as alumni |
| 3 | Navigate to `/alumni-portal/profile` | Alumni profile page shown with their own profile data |
| 4 | Try to access `/dashboard` | Access denied. Alumni can only see their own portal. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-ALM-05**
**Feature:** Mark Alumni as Do Not Contact
**Pre-condition:** An alumni profile exists.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open any alumni profile | Profile detail shown |
| 2 | Change Status to `Do Not Contact` | Status updated |
| 3 | Save | Profile saved. Profile clearly marked as Do Not Contact. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 11 — Settings

---

**TC-SET-01**
**Feature:** Company Settings
**Pre-condition:** Logged in as Super Admin.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/settings` | Company settings page loads |
| 2 | Update notification email to `notifications@testcorp.com` | Field accepts input |
| 3 | Update brand color | Color picker opens and updates preview |
| 4 | Click **Save** | Success toast shown. Settings persisted. |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-SET-02**
**Feature:** Team Settings — View Members
**Pre-condition:** At least 2 user accounts linked to the company.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/settings/team` | Team settings page loads |
| 2 | Verify all team members are listed | Names, emails, and roles shown correctly |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-SET-03**
**Feature:** Team Settings — Role Restrictions
**Pre-condition:** Logged in as HR Admin (not Super Admin).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/settings/team` | Page loads |
| 2 | Attempt to change another user's role | Option either not visible or shows "Insufficient permissions" |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-SET-04**
**Feature:** Billing Settings — Plan Display
**Pre-condition:** Logged in as Super Admin.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/settings/billing` | Billing page loads |
| 2 | Check current plan displayed | Shows current plan (Free / Starter / Pro / Enterprise) |
| 3 | Check plan features listed | Feature list matches the plan tier |
| 4 | Click **Upgrade** (if on Free or Starter) | Redirects to upgrade flow or shows plan options |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-SET-05**
**Feature:** Integration Settings
**Pre-condition:** Logged in as Super Admin.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/settings/integrations` | Integration settings page loads |
| 2 | Find Slack integration | Webhook URL field visible |
| 3 | Enter a test Slack webhook URL | URL accepted |
| 4 | Save settings | Settings saved |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 12 — Role-Based Access Control

---

**TC-RBAC-01**
**Feature:** Manager Access Restrictions
**Pre-condition:** Logged in as `manager@testcorp.com`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/offboardings` | Manager sees only offboardings they are assigned to as manager |
| 2 | Try to navigate to `/settings/billing` | Access denied or page not visible in sidebar |
| 3 | Try to navigate to `/settings/team` | Access denied or restricted view |
| 4 | Try to create a new offboarding | Option not available or returns permissions error |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-RBAC-02**
**Feature:** IT Admin Access Restrictions
**Pre-condition:** Logged in as `it@testcorp.com`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check sidebar | IT Admin does not see Alumni, Analytics, Billing, Team Settings |
| 2 | Navigate to an offboarding detail | Can view detail. Can mark access revocations. |
| 3 | Try to edit offboarding details (employee name, dates) | Cannot edit employee info fields |
| 4 | Try to complete HR-assigned tasks | Cannot mark HR Admin tasks as complete |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-RBAC-03**
**Feature:** HR Admin Access
**Pre-condition:** Logged in as `hr@testcorp.com`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/offboardings` | Sees all company offboardings |
| 2 | Create a new offboarding | Able to create |
| 3 | Navigate to `/analytics` | Can view analytics |
| 4 | Navigate to `/alumni` | Can view and manage alumni |
| 5 | Navigate to `/settings/billing` | Access denied (billing is Super Admin only) |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 13 — Email Notifications (Cloud Functions)

> These tests require the Cloud Functions to be deployed and the email service (Brevo) to be configured.

---

**TC-EMAIL-01**
**Feature:** Portal Link Email — On Offboarding Created
**Pre-condition:** Brevo SMTP configured. Employee email is a real/test inbox.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create a new offboarding for `john.doe@testcorp.com` | Offboarding created |
| 2 | Wait up to 2 minutes | Email received at `john.doe@testcorp.com` with subject containing "Your Offboarding Portal" |
| 3 | Check email content | Contains portal link, employee name, last working day, company name |
| 4 | Click the portal link in the email | Portal opens correctly |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-EMAIL-02**
**Feature:** HR Notification Email — On Offboarding Created
**Pre-condition:** Company notification email set to `notifications@testcorp.com` (a real inbox).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create a new offboarding | Offboarding saved |
| 2 | Wait up to 2 minutes | Email received at `notifications@testcorp.com` with subject "New Offboarding Started" |
| 3 | Check email content | Contains employee name, role, department, last working day |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-EMAIL-03**
**Feature:** Overdue Task Email — Scheduled Function
**Pre-condition:** A task's due date is set to yesterday (past due). Scheduled function runs daily at 09:00 UTC.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set a task's due date to yesterday | Task due date in the past |
| 2 | Wait for scheduled function to run (or trigger manually via emulator) | Email received at HR notification email with list of overdue tasks |
| 3 | Check email content | Task name, assigned offboarding, days overdue listed |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-EMAIL-04**
**Feature:** Team Invite Email
**Pre-condition:** Brevo SMTP configured.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to `/settings/team` and invite `newmember@testcorp.com` | Invite sent |
| 2 | Wait up to 2 minutes | Email received at `newmember@testcorp.com` |
| 3 | Check email content | Contains signup link with role and company name |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 14 — Plan Feature Gating

---

**TC-PLAN-01**
**Feature:** Free Plan — Feature Restrictions
**Pre-condition:** Company plan is Free.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Try to use AI Knowledge Gap Detection | Upgrade prompt shown |
| 2 | Try to access Alumni Portal | Upgrade prompt shown |
| 3 | Try to export Analytics PDF | Upgrade prompt shown |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-PLAN-02**
**Feature:** Pro Plan — Features Unlocked
**Pre-condition:** Company plan is Pro.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Use AI Knowledge Gap Detection | Feature available and works |
| 2 | Access Alumni Portal | Feature available |
| 3 | Export Analytics PDF | Feature available |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

### Module 15 — General UI / UX

---

**TC-UI-01**
**Feature:** Responsive Layout — Mobile View
**Pre-condition:** Use browser dev tools to simulate mobile (375px width).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set viewport to 375px (iPhone) | Sidebar collapses or hides |
| 2 | Open hamburger/menu | Navigation accessible |
| 3 | Navigate between pages | All pages usable without horizontal scroll |
| 4 | Fill out a form (e.g., new offboarding) | Form usable on mobile |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-UI-02**
**Feature:** Empty States
**Pre-condition:** Freshly set up company with no data.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/offboardings` with no flows | Empty state message shown (e.g., "No offboardings yet. Create your first one.") |
| 2 | Navigate to `/knowledge` with no items | Empty state shown |
| 3 | Navigate to `/alumni` with no alumni | Empty state shown |
| 4 | Navigate to `/interviews` with no responses | Empty state shown |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-UI-03**
**Feature:** Loading States
**Pre-condition:** Logged in, navigating between pages.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/analytics` (data-heavy page) | Loading spinner or skeleton shown while data loads |
| 2 | Create a new offboarding and click Submit | Button shows loading state while saving |
| 3 | Trigger AI gap detection | Loading indicator shown during AI processing |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-UI-04**
**Feature:** Error Boundary
**Pre-condition:** Simulate a component error (or navigate to a broken route).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to a non-existent route (e.g., `/this-page-does-not-exist`) | 404 or redirect to dashboard, not a blank white screen |
| 2 | Open browser console | No unhandled React errors from normal usage |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

**TC-UI-05**
**Feature:** Toast Notifications
**Pre-condition:** Logged in, perform any save action.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Complete a task in an offboarding | Success toast appears in corner (e.g., "Task completed") |
| 2 | Save company settings | Success toast appears |
| 3 | Submit knowledge item | Success toast appears |
| 4 | Wait 3–5 seconds | Toast auto-dismisses |

**Actual Result:**
**Status:** PASS / FAIL
**Notes:**

---

## Test Completion Summary

Fill this out after completing all test cases.

| Module | Total Cases | Passed | Failed | Blocked |
|--------|-------------|--------|--------|---------|
| Authentication | 7 | | | |
| Dashboard | 2 | | | |
| Offboarding Flows | 10 | | | |
| Templates | 4 | | | |
| Employee Portal | 4 | | | |
| Exit Interviews | 3 | | | |
| Knowledge Base | 5 | | | |
| Access Revocation | 2 | | | |
| Analytics | 2 | | | |
| Alumni Network | 5 | | | |
| Settings | 5 | | | |
| Role-Based Access | 3 | | | |
| Email Notifications | 4 | | | |
| Plan Feature Gating | 2 | | | |
| General UI/UX | 5 | | | |
| **TOTAL** | **63** | | | |

---

## Failed Test Cases (Summary)

Use this table to report failures quickly.

| Test Case ID | Feature | Failure Reason | Severity (Critical / High / Medium / Low) |
|--------------|---------|----------------|------------------------------------------|
| | | | |
| | | | |
| | | | |

---

*Document version: 1.0 — OffboardKit Pre-Launch QA*
