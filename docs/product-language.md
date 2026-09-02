# Pillar Deal Room — product language

Staff-facing vocabulary for processors and loan officers. Internal names stay in code.
Write UI at about an 8th-grade reading level: short, direct, action-oriented.

Do not use “Capital OS,” “operational work item,” or other implementation terms in the interface.

Industry terms (DSCR, LTV, LTC, ARV, Conditions, loan amount) stay. Product jargon goes.

---

## Navigation

| Internal | User-facing | Use | Avoid |
|---|---|---|---|
| `/dashboard` | Home | Start here. What to do first. | Dashboard, Command Center, Capital OS |
| `/deals` | Deals | File inventory. | Pipeline, Opportunities, CRM |
| `/processor-queue` | Work | What needs attention across files, in order. | Queue, Queue Truth, Operational work |
| `/tasks` | Tasks | Every assigned action, with filters. | All work, Work items |
| `/team` | Team | Who owns which files. | Workload engine, Processor roster |

Routes do not change. Labels do.

Work vs Tasks:

- **Work** = what to do now across files
- **Tasks** = the full list of assigned actions

---

## Deal workspace

| Internal | User-facing | Use | Avoid |
|---|---|---|---|
| `tab=overview` | Overview | What this file is, and what is next. | Dossier, Command surface |
| `tab=needs` | Requests | Documents and info we still need. | Client Needs, Need objects, Requirements |
| `tab=documents` | Documents | Files received and review. | Intake, Classification |
| `tab=conditions` | Conditions | Lender conditions. Keep this word. | Condition work items |
| `tab=submission` | Submission | Lender package. Can we send? | Submission readiness engine |
| `tab=people` | People | Contacts on the file. | CRM, Relationships |
| `tab=activity` | Activity | What changed. | Timeline, Audit log, Communication attempts |

---

## Work concepts

| Internal | User-facing | Use | Avoid |
|---|---|---|---|
| `client_need` | Request | A document or info item we need from someone. | Client Need, Need object, Requirement item |
| timing `required_now` | Needed now | Due for this file now. | Required now, Required-now band |
| timing `required_later` | Needed later | Not due yet. | Required later, Timing |
| Next Action | Next action | The one thing to do on this file. Keep. | Operational next, Ranked work item |
| Queue Today sections | Urgent / Due today / Needs review / Waiting / New | Keep. Already clear. | Priority rank, OperationalWorkItem |
| `ready_to_submit` | Ready to send | Package can be sent outside Deal Room. | Ready to submit (implies the app sends) |
| Waiting on | Waiting for | Who we need a reply from. | Waiting On, Waiting state |
| Recent responses | New replies | Someone wrote back. | Recent Responses, Response received events |
| Stuck files | Needs attention | Files that are not moving. | Stuck, Exceptions lane |
| My next work | Up next | The processor’s first actions. | My next 5, Highest-ranked assigned work |
| Processor Assist | File summary | Optional AI-assisted notes. Secondary. | Processor Assist, AI authority |
| Submission readiness | Ready to send | Whether needed-now items are done. | Readiness engine, Satisfied count |
| Playbook | (hide, or “Task type”) | Internal template. Do not say playbook in UI. | Playbook, Playbook key |
| Source type | Needed from | Borrower, title, insurance, etc. | Source type, External source |
| Communication attempt | Message | A recorded outreach or reply. | Communication attempt |
| Material mismatch | File may not match | Only when a linked file looks wrong. | Material mismatch |

---

## Documents

Prefer: Review, Approve, Needs replacement, Link to request, Uploaded, Received.

Avoid: classification state, document intelligence suggestion, relationship mapping.

AI suggestions stay secondary.

---

## Conditions

Keep: Conditions, Open, Waiting, Received, Cleared.

Avoid: condition work item, condition workflow state, resolution action.

---

## Submission

Ask: can this file be sent to a lender?

Use: Ready to send, Blocked by, Lender package.

If the app only records a send that happened elsewhere, say that. Never imply Deal Room emails the lender.

---

## Actions

Verb + object: Review document, Add request, Claim file, Set follow-up, Mark received.

Avoid: Manage, Process, Handle, Continue, Take action.

---

## Borrower portal

Even simpler. Prefer: We need this, Uploaded, Being reviewed, Complete.

Never show: Queue, Work, Conditions engine, Ready to send, AI, task status.

---

## Work vs Tasks

Do not merge these systems.

**Work** (`/processor-queue`): what needs attention across files, in order.

**Tasks** (`/tasks`): every assigned action, with filters.

---

## Recording a send

The app does not email lenders.

Use **Mark submitted** to record that the package was sent outside Deal Room.

Never label that action Send.

