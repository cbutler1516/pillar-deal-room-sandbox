# CRM Design Foundation

V4 does **not** build CRM features. It establishes visual primitives so future screens can ship without another rebrand.

Future surfaces this system must absorb: contact profile, company profile, lead, opportunity/pipeline, activity feed, email/SMS history, referral partner, lender directory, notes, files, reporting.

---

## Navigation scalability

Desktop uses a **compact dark left rail**. Today’s destinations remain:

Dashboard · Deals · Queue · Tasks · Team

The rail is grouped so later items can land in labeled clusters without a new chrome:

```
WORK
  Dashboard
  Queue
  Tasks

PIPELINE          ← future
  Deals
  Leads
  Opportunities

RELATIONSHIPS     ← future
  Contacts
  Lenders
  Partners

SYSTEM            ← future
  Communications
  Reports
  Settings
```

Rules:

- Do not add those routes now.
- Do not change permissions.
- Active state is a 2px champagne/mineral pillar on the rail edge — reusable for any future item.
- Mobile keeps the current three-destination bottom nav. Additional destinations stay in an overflow/account area later.

Search: the rail reserves vertical space under the lockup for a future command field. V4 does not add a fake search control.

---

## Table system

Default information pattern is a **work ledger**, not a board.

Primitives:

- Sticky header row, 11px labels, muted ink
- Body: 13–14px, tabular currency
- Hover: stone wash
- Selected: 2px mineral left edge + stone fill
- Status: small text, not a badge farm
- Filters live in a slim toolbar above the table (not a card carnival)

This pattern covers: Deals, Tasks, Queue, Contacts, Lenders, Files, Reports.

Kanban is allowed only when it materially improves a workflow (future pipeline). It is not the default.

---

## Detail page system

Every record (deal today; contact/lead/lender later) uses the same dossier:

1. **Identity header** — name, secondary identity, amount or key metric, owner, status, file/id
2. **Tab rail** — precise underline, not pills; tabs can grow
3. **Overview composition** — unboxed sections, not a stack of equal cards
4. **Contextual inspector** — right panel on desktop for the selected child object

Deal Overview is the reference implementation.

---

## Activity system

Ledger rows, not a chat feed:

```
[avatar]  Actor  verb  object          2:14p
          quiet system metadata
```

Human actions stay at body contrast. System events stay muted. Same component should later render email/SMS history without a new visual language.

---

## Relationship / contact system

People is the precursor:

- Left: compact directory (name, role, company)
- Right: selected contact identity + facts + related deal actions

Do not ship CRM mutations in V4. The layout should already look like a relationship record, not a stack of vCards.

---

## Action hierarchy

Every surface has **one** primary action. Secondary actions sit in a bordered button or overflow.

| Level | Use |
|-------|-----|
| Primary | Claim, Prepare submission, Save follow-up |
| Secondary | Open file, View queue |
| Tertiary | Overflow, cancel |
| Danger | Irreversible only, never inline on Queue in V1 action layer |

Future CRM actions (log email, convert lead, create opportunity) must adopt this same four-level system.

---

## Panel / drawer system

Reusable inspector:

- Desktop: right column, `elevated` surface, sticky under deal tabs
- Mobile: full-screen sheet (existing inspector-enter, 160ms)
- Used today: document inspector
- Future: task, condition, contact, communication

Do not invent a second drawer language.

---

## Responsive strategy

| Width | Behavior |
|-------|----------|
| 1920 / 1440 | Rail + dense workspace + inspector |
| 1366 | Rail + workspace; inspector may stack |
| 1024 | Rail collapses to icon-width or hides; workspace full |
| 768 | Top bar + stacked panels |
| 390 | Action-first; My Next Work / due / review; bottom nav |

Do not shrink the desktop dossier onto a phone.

---

## Primitive inventory (build only what repeats)

AppShell · PageHeader · SectionHeader · DataTable · WorkRow · StatusChip · Avatar · Metric (inline, not carnival) · DetailPanel · ActionMenu · Toolbar · FilterChip · EmptyState · TimelineItem · DocumentRow · ContactRow · FinancialValue

V4 maps existing components onto these names. It does not add an abstraction layer for unused CRM objects.
