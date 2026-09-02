# Visual Rebrand V4 — Pillar Capital OS

Status: selected direction documented. Implementation follows this file.

This is a first-principles visual language, not an incremental polish pass.
Workflow, Queue Truth, readiness, conditions, communications, and schema are unchanged.

---

## A. Current visual audit (V3.1 / Visual Wow)

Reviewed: Dashboard, Deals, Queue, Tasks, Team, Deal Overview / Needs / Documents / Conditions / Submission / People / Timeline, Borrower Portal.

### What currently feels premium

- Navy + teal pairing already reads more “lender” than generic SaaS.
- Deal header identity (borrower uppercase, amount, owner) is the strongest brand moment.
- Status chips as text (not rainbow pills) are disciplined.
- Document split-pane is closer to a workstation than a file manager.
- Staff photos / initials keep the product human.

### What feels generic

- Top-nav + floating bottom dock is a standard admin template pattern.
- Geist + white cards + teal chips could be any 2024 fintech starter.
- Metric cards with circular icon wells feel like a KPI carnival.
- Hover lift (`-translate-y`) on cards/buttons is consumer SaaS, not infrastructure.

### What feels busy

- Every section is a 16px-radius elevated card with multi-layer shadows.
- Queue section washes (danger/teal/amber/success) compete with work content.
- Dashboard greeting uses a decorative multi-stop gradient.
- Command Center stacks many bordered panels of equal visual weight.

### What feels too playful / Trello-like

- Colored footer tints on work cards.
- Pill-shaped action chips (`rounded-full`).
- Grid of “cards you pick up” rather than a work ledger.
- Soft 16–24px radii everywhere.

### What feels like an engineering UI

- Filter `<details>` + stacked native selects.
- Inconsistent spacing (arbitrary `3.5`, `2.5`, `1.5` mix).
- Chrome tokens exist, but local magic values still dominate.

### Where density vs whitespace is appropriate

- Dense: Queue, Deals table, Tasks, Documents inbox, Conditions.
- Editorial: Dashboard greeting, Deal Overview, Submission package, Borrower Portal.
- V3 treats both the same (card + shadow).

### CRM scalability gap

The shell is a 5-item top nav. It cannot absorb Contacts, Pipeline, Lenders, Communications, Reports, Settings without a redesign. Tables are decent; there is no reusable directory + inspector primitive.

---

## B. Three directions

### Concept A — Institutional Private Capital

Strong ink foundation, warm paper, editorial hierarchy, champagne accent, minimal motion.
**Strengths:** credibility, longevity, borrower-facing dignity.
**Weaknesses:** can feel conservative; less CRM-app energy for daily processors.

### Concept B — Modern Capital Operating System

High information density, polished chrome, crisp spacing, dark/light contrast, tactile controls, mineral teal.
**Strengths:** processor usability, CRM scalability, distinctiveness as an OS.
**Weaknesses:** if overdone, becomes “fintech dashboard.”

### Concept C — Premium Real Estate Fintech

Warmer, property storytelling, photography.
**Strengths:** deal narrative.
**Weaknesses:** stock imagery risk; less institutional; weaker CRM longevity.

### Evaluation (1–5)

| Criterion | A | B | C |
|-----------|---|---|---|
| Credibility | 5 | 4 | 3 |
| Premium feel | 5 | 5 | 4 |
| Daily processor usability | 3 | 5 | 3 |
| Future CRM scalability | 3 | 5 | 3 |
| Borrower-facing usability | 5 | 4 | 4 |
| Distinctiveness | 4 | 5 | 3 |
| Longevity | 5 | 4 | 3 |

---

## C. Selected direction

**Concept B, with selected DNA from Concept A.**

- B supplies the OS: dark brand chrome, dense work ledgers, scalable rail, crisp controls.
- A supplies the materials: warm paper workspace, ink type, champagne used as a signature (never a button), editorial deal/submission moments.

Not three themes. One system: **Pillar Capital OS**.

---

## D. Brand strategy

Positioning: **private capital infrastructure** — a processing OS that can grow into a full CRM without looking like project-management software.

Attributes: premium, institutional, modern, calm, precise, high-trust, expensive, fast, human, operational.

Voice of the UI: quiet confidence. One obvious next action. No carnival.

Sandbox lockup (typography + existing mark only):

```
PILLAR
Private Lending
Deal Room
```

Official wordmark/mark assets are reused. No invented logo.

---

## E. Color system

| Token | Hex | Role |
|-------|-----|------|
| `--pillar-ink` | `#0B1420` | Dark chrome, display type |
| `--pillar-navy` | `#132234` | Deep navy chrome hover / secondary dark |
| `--mineral` | `#194A48` | Deep teal, active nav, primary dark action |
| `--pillar-teal` | `#177D78` | Primary interactive accent |
| `--paper` | `#F8F8F5` | Workspace base |
| `--stone` | `#EFF1EE` | Soft stone / muted surface |
| `--line` | `#DCE1DE` | Borders |
| `--ink` | `#14202C` | Primary text |
| `--ink-muted` | `#66727D` | Secondary text |
| `--accent` | `#B59B67` | Champagne — signatures only |
| `--success` | `#1F6B4A` | Semantic |
| `--warning` | `#9A6B16` | Semantic |
| `--danger` | `#9B2C2C` | Semantic |
| `--info` | `#3D5A80` | Semantic |

Champagne is never a button, never a status, never a wash. Use for: 2px pillar rail marker, paired divider, selected brand moments.

---

## F. Typography

- **UI:** Geist Sans (existing) — tables, metadata, buttons, body.
- **Display:** Source Serif 4 — greeting, deal borrower name, portal welcome only.
- Tabular numerals on currency and KPIs.

Tokens: `--text-display`, `--text-page`, `--text-section`, `--text-card`, `--text-body`, `--text-meta`, `--text-label`, `--text-kpi`, `--text-table`, `--text-button`.

---

## G–J. Shell, surfaces, spacing

**Shell:** dark compact left rail (desktop) + warm paper workspace. Mobile: slim dark top bar + existing bottom destinations (routes unchanged).

**Surfaces:** `base` (flat paper) · `section` (unboxed) · `panel` (1px border, no lift) · `elevated` (inspector only) · `floating` (menus/dialogs).

**Radius:** controls 8px · panels 10–12px · heroes 14px max.

**Spacing scale:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64.

**Shadow:** almost none on panels. Soft float on menus only.

---

## K–L. Actions and status

Primary: mineral / teal. Secondary: bordered paper. Tertiary: ghost. Danger: reserved.

Status: small text + subtle color. Never color-only. Never giant pills.

---

## Screen transformations (M–Y)

| Surface | V4 treatment |
|---------|--------------|
| Dashboard | Editorial greeting + integrated counts (Today strip as ledger, not KPI carnival). My Next Work as a tape. |
| Queue | Work ledger: grouped rows, thin priority edge, quieter washes. |
| Deals | Premium data table: hover row, currency hierarchy, next action as text. |
| Deal Overview | Financial dossier: identity header, then unboxed sections. |
| Needs | Checklist rows, grouped Required now / later / optional. |
| Documents | Workstation: dense inbox + clean inspector. |
| Conditions | Ledger/checklist. Human clear only. |
| Submission | Institutional package: readiness header + paper preview. |
| People | Directory precursor (list + identity), not isolated cards. |
| Timeline | Activity ledger (actor / action / object / time). |
| Tasks | Dense professional rows. |
| Team | Capacity scan, not employee cards. |
| Portal | Same brand, more air, no internal density. |

---

## Implementation phases

1. Tokens + shell + typography
2. Dashboard / Command Center
3. Deal Overview + header
4. Queue + Deals + Tasks
5. Documents + Needs + Conditions
6. Submission + People + Timeline
7. Team
8. Borrower Portal

Functional freeze and no schema changes apply to all phases.
