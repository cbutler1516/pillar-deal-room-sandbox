# Third-party document storage provider evaluation

**Status:** Evaluation only. No production provider is connected.

**Sandbox provider in use:** `sandbox_mock` by default. `sharefile` is a sandbox-only spike behind the same factory. See `docs/sharefile-sandbox-spike.md`.

**Hard storage boundary:** Pillar must not permanently store borrower document files. File bytes belong with a third-party secure document provider. Pillar stores workflow state, document metadata, external references, review/classification status, and safe audit events.

**Intended production flow:**

1. Borrower browser uploads directly to the provider (when the provider supports it).
2. The provider returns an external document reference.
3. Pillar stores metadata and the reference only.
4. Temporary view/download URLs are issued only after server-side authorization and expire quickly.

Third-party storage reduces Pillar's infrastructure exposure but does not eliminate Pillar's privacy/security obligations. Using a vendor does not create legal immunity from data breaches. Pillar remains responsible for access control, vendor due diligence, contractual flow-downs, incident response, workforce training, and lawful processing of any metadata or references it retains.

Do not choose a winner solely on price.

---

## Comparison categories

Evaluated for later selection: **ShareFile**, **Box**, and **Dropbox Business**.

| Category | ShareFile | Box | Dropbox Business |
| --- | --- | --- | --- |
| Direct browser upload / API | Client and API upload paths; request-list / client upload flows are a historical strength. Confirm current CORS / direct-to-storage upload APIs and token scoping. | Mature upload APIs, including chunked upload and browser-oriented flows. Strong enterprise API surface. | Upload session APIs and file-request links. Confirm whether production can keep bytes off Pillar servers end-to-end. |
| Secure client upload / request flows | Built around requesting files from external parties (borrowers, brokers) without giving them a full workspace. | Shared folders, Box Relay, and external collaborator models. Often needs careful folder/permission design per deal. | File requests and shared folders are processor-familiar. External-user permissioning is simpler but can be looser if not designed carefully. |
| Short-lived access URLs | Shared links and client access can be time-bounded; confirm API-issued, short-TTL download URLs. | Shared links support expiration and access settings; Box APIs can mint time-limited representations. | Shared links with expiration on business plans; confirm API-level TTL and whether links can be scoped to a single file without folder leakage. |
| Audit logging | Admin and file-activity reporting aimed at accountancy / finance teams. Map events to Pillar activity without copying file contents. | Strong enterprise audit (admin events, access logs). Box Shield adds anomalous-access signals. | Team activity logs exist; enterprise-grade SIEM export is typically weaker than Box unless an advanced plan is used. |
| Role / access controls | Client vs employee roles; folder and request-list ACLs. Fit for “borrower uploads, processor reviews.” | Granular enterprise IAM, groups, and (on higher SKUs) classification-based controls. | Team folders and member roles are straightforward. Fine-grained per-deal isolation needs disciplined folder architecture. |
| Retention / deletion | Retention and legal-hold options vary by plan. Confirm API delete + retention policies for mortgage-file lifecycles. | Retention, legal hold, and disposition are mature on enterprise SKUs. Good fit if Pillar must delegate deletion. | Version history and delete/restore are solid. Policy-driven retention is less complete than Box without add-ons. |
| Versioning | File versioning available; confirm API access to versions for processor re-review. | Excellent versioning and file-lock behavior. | Strong everyday version history; API versioning is usable. |
| Malware scanning | Scanning capabilities exist; confirm what is included vs add-on and whether status is API-visible. | Box Shield / malware detection is a differentiator on higher tiers. Status can inform Pillar workflow. | Malware scanning is present; API-visible “clean/infected” status should be verified before relying on it in workflow. |
| Webhook support | Webhooks / event notifications exist for upload completion. Confirm reliability and signing. | Mature webhook catalog for file events. Good for “upload finished → Pillar metadata commit.” | Webhooks are available for file changes. Confirm retry, signing, and multi-tenant isolation. |
| API maturity | Long-standing content-collaboration API. Developer experience is uneven versus Box; validate current OAuth, upload, and link APIs. | Among the strongest content APIs for enterprise workflow integration. | Well-documented consumer-grade API that scales to business; some enterprise governance APIs lag Box. |
| SOC 2 / security documentation | SOC 2 and security whitepapers available. Review current reports, encryption, and subprocessors. | Broad compliance catalog (SOC 2 and additional public-sector / enterprise attestations on higher SKUs). | SOC 2 and standard enterprise security docs. Review the exact Business/Business Plus/Enterprise package. |
| Regulated financial-services suitability | Historically used by accounting and professional-services firms; evaluate current data-residency, BAAs/DPAs, and mortgage-file handling. | Common in regulated enterprises when Shield + Enterprise Key Management + retention are in scope. | Widely used; confirm whether the chosen SKU meets lender/investor and state-privacy expectations. Do not assume “Business” alone is enough. |
| Ease of integrating with Pillar workflow | Request-list model maps cleanly to Client Needs if APIs can create a request per need and return a file id. | Folder-per-deal (or metadata-per-deal) maps cleanly; webhooks + temporary links match the abstraction. | File requests and folders can map to Client Needs with less enterprise ceremony; deal isolation must be designed, not assumed. |
| Processor usability | Familiar “request documents from a client” mental model. | Powerful but can feel heavy; folder and classification UX needs training. | Lowest friction for day-to-day file drop and review. Risk is informal sharing if processors use personal-style links. |
| Cost / seat considerations | Often priced per user / client-access model. Can be efficient if borrower seats are cheap or unnecessary. Do not decide on price alone. | Enterprise features that Pillar likely needs (Shield, retention, granular admin) sit on higher SKUs. | Often cheaper to start. Hidden cost is buying a higher tier later for expiration, admin, or legal hold. |

---

## Capability mapping to Pillar’s provider model

Future adapters should declare, not assume, these capabilities:

- Direct browser upload
- Temporary download/view URLs
- File deletion
- Webhook completion
- Folder / deal organization
- Retention controls
- Audit events
- Virus scanning status
- Versioning

The UI and workflow must stay vendor-neutral. `sandbox_mock` already implements the interface so a later ShareFile, Box, or Dropbox adapter can be swapped behind `DOCUMENT_STORAGE_PROVIDER` without teaching the deal room a vendor-specific upload form.

---

## Selection guidance (not a winner)

Select after a time-boxed proof of concept that measures:

1. Direct browser upload that never sends file bytes through Pillar application servers.
2. API-issued short-lived access URLs that processors can use after deal authorization.
3. Reliable completion signal (webhook or confirmed session) that writes metadata only.
4. Deletion / retention that can be delegated and audited.
5. Processor UX for “request this Client Need” without exposing other deals.
6. Security review of SOC reports, encryption, identity, and incident-response terms.

Price is an input, not the decision.

---

## Legal and privacy reminder

Third-party storage reduces Pillar's infrastructure exposure but does not eliminate Pillar's privacy/security obligations.

Pillar still:

- decides who may request a file or a temporary URL
- stores identifiers and workflow state that can be sensitive in context
- must vet, contract, and monitor the vendor
- must respond to incidents that involve files the vendor holds on Pillar’s behalf

A vendor relationship is not legal immunity from data breaches.
