# Stratium — AI Strategic Boardroom & Corporate Finance Platform

**Stratium** is an AI-powered Strategic Boardroom Assistant and Corporate Financial Management Platform built for the hackathon central workflow:

`Company Data → Company Intelligence → Boardroom Discussion → Strategic Decision → Financial Planning → Human Approval → Payment Execution → Outcome Tracking`

All 9 modules share one unified relational database so company intelligence, board decisions, budgets, invoices, payment requests, and the financial calendar remain consistent at all times.

---

## Architecture & Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide icons.
- **Backend**: Next.js API Route Handlers (`src/app/api/*`) with server-side RBAC/ABAC and HMAC-signed demo session cookies.
- **Database**: Prisma ORM (`prisma/schema.prisma`) with SQLite (`file:./dev.db`) for zero-friction local hackathon execution. (To switch to PostgreSQL, change `provider = "postgresql"` in `prisma/schema.prisma` and update `DATABASE_URL` in `.env`.)
- **Document Parsing**: `unpdf` (PDF text extraction), `csv-parse` (CSV), `exceljs` (`.xlsx` workbooks), and UTF-8 text chunking.
- **AI Orchestration**: Single central orchestrator (`src/lib/ai/orchestrator.ts`) with 5 specialized callable tools (`retrieve_company_intelligence`, `query_financial_records`, `retrieve_historical_decisions`, `calculate_financial_scenario`, `search_public_benchmarks`). Supports OpenAI-compatible APIs, Google Gemini API, and a transparent **Deterministic Tool Engine** fallback when no external LLM API key is configured.
- **Payments**: Provider-independent adapter (`src/lib/payments/provider.ts`) implementing official **PayPal REST API v2 Sandbox** (`/v1/oauth2/token`, `/v2/checkout/orders`, `/v2/checkout/orders/{id}/capture`, `/v1/notifications/verify-webhook-signature`, and `/v1/payments/payouts` when enabled/eligible, with explicitly labeled simulation fallback when credentials or payouts entitlement are absent).

---

## Setup & Local Execution

### 1. Install Dependencies
```bash
cd Stratium
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (already initialized for local SQLite demo):
```bash
cp .env.example .env
```
Optional integrations in `.env`:
- **LLM API (Gemini Free Tier)**: Set `GEMINI_API_KEY` (and optional `GEMINI_MODEL`, default `gemini-3.6-flash`) from Google AI Studio. Leave blank to run Stratium's local Deterministic Tool Engine.
- **PayPal Sandbox**: Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID` from your PayPal Developer Sandbox app (`PAYPAL_ENV="sandbox"`). Set `PAYPAL_ENABLE_PAYOUTS="true"` only if your sandbox account has Payouts enabled.

### 3. Initialize Database & Seed Demo Data
```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

### 4. Run Development or Production Server
```bash
npm run dev
# or production build:
npm run build
npm run start
```
Open `http://localhost:3000`.

---

## Implemented Functionality

1. **Dashboard (`/`)**: Live recorded cash balance (strictly separated from 30d projected consumption), remaining budgets, open AR/AP, rolling cash-flow chart, human approval queue, upcoming calendar obligations, and decision memory.
2. **AI Boardroom (`/boardroom`)**: Multi-participant & transcript-based strategic discussion workspace with tool execution trace, source verification badges (`VERIFIED_PUBLIC`, `SYNTHETIC_RECORD`, `USER_PROVIDED_UNVERIFIED`), conflict evaluation (independent of executive seniority), deterministic scenario launcher, and human-confirmed decision drafting.
3. **Company Intelligence (`/intelligence`)**: Structured 9-domain knowledge repository, manual entry forms, real PDF/CSV/XLSX/TXT document upload and chunk extraction, editable corporate profile, and RBAC/ABAC access scoping (`HR_RESTRICTED`, `FINANCE_AND_EXEC`, `LEADERSHIP_ONLY`, `COMPANY_WIDE`).
4. **Strategic Planning (`/planning`)**: Deterministic 3-scenario (Optimistic / Baseline / Adverse) financial and capacity modeling engine without fabricated probability percentages.
5. **Financial Management (`/finance`)**: Cash-flow reporting, department spend vs. allocation, AR/AP invoice issuance, refunds, and budget management.
6. **Financial Calendar (`/calendar`)**: Monthly calendar synced directly to invoices, payment requests, decision spending tranches, and AI projections across 8 semantic statuses.
7. **Payments & PayPal (`/payments`)**:
   - Outgoing workflow: `Request → AI Advisory Validation → Dept Manager → Finance Manager/CFO → Executive/Board → Payment Executor`. Self-approval and AI approval/execution are blocked on the server.
   - Incoming workflow: PayPal Sandbox Order creation, buyer approval link, order capture, webhook signature verification (`/api/paypal/webhook`), and invoice/ledger/calendar reconciliation.
8. **Meetings & Decisions (`/meetings`)**: Meeting agendas, decision memory, and one-click conversion of board-approved resolutions into Budgets and phased Financial Calendar tranches.
9. **Administration (`/admin`)**: Org hierarchy, 12-role directory, controlled Demo Role Switcher (`DEMO ONLY`), configurable approval policies, and backend security audit log (including denied actions).

---

## Genuinely Integrated vs. Simulated Components

| Capability | Genuine Integration | Simulated / Demo Boundary |
|---|---|---|
| Database & Financial Consistency | Real SQLite/Prisma relational tables shared across every module | Seeded operational transactions & invoices are marked `isSynthetic: true` |
| Document Parsing (PDF/CSV/XLSX) | Real binary extraction via `unpdf`, `csv-parse`, and `exceljs` | N/A |
| RBAC / ABAC & Self-Approval Blocks | Real server-side role/department validation and `AuditLog` persistence | Demo user/role switching (`DEMO ONLY`) replaces SSO/password login for hackathon demo |
| AI Boardroom Orchestration | Live Gemini tool-calling (`GEMINI_API_KEY`) | Runs transparent Deterministic Tool Engine over live DB tools when no API key is configured |
| PayPal Incoming Checkout & Webhooks | Official PayPal Sandbox REST v2 (`Orders`, `Capture`, `Verify Webhook`) when credentials are set in `.env` | Explicitly labeled `PAYPAL_SIMULATED` mode when sandbox keys are absent |
| PayPal Outgoing Payouts | Official PayPal Payouts REST v1 when `PAYPAL_ENABLE_PAYOUTS="true"` and account is eligible | Explicitly labeled `PAYPAL_SIMULATED` adapter when disabled or ineligible in sandbox |
| Historical Tesla Dataset | Publicly verified pre-December 31, 2012 filings/announcements strictly enforced | Internal org, budgets, invoices, and transcripts labeled Synthetic Demo Data |

---

## Test Instructions & Verification

1. **Automated Build & Type Check**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
2. **Core Demo Flows to Verify**:
   - **Company Onboarding & Isolation**: Switch between *Tesla Motors, Inc. (2012 Sim)* and *Meridian Mobility Labs* in the top bar; verify complete data isolation or create a new company via `+ Company`.
   - **Document Upload**: In `/intelligence`, upload a `.csv`, `.xlsx`, `.pdf`, or `.txt` file and verify `COMPLETED` extraction status and chunk indexing.
   - **Boardroom Scenario 1 (Disagreement)**: In `/boardroom`, click *Scenario 1: CEO vs CFO vs CTO Conflict* and submit. Verify independent critique of all three roles, evidence citations, and alternatives.
   - **Boardroom Scenario 2 (Unexpected Question)**: Click *Scenario 2: 10-Year Station Capacity Question* and click *Model Scenarios* to inspect the 3-scenario curve in `/planning`.
   - **Historical Cutoff Enforcement**: Ask about *Model 3 or Gigafactory 2016 revenue* in the Tesla 2012 workspace and verify the Dec 31, 2012 cutoff boundary blocks post-2012 claims.
   - **Decision → Budget → Calendar (Scenario 3)**: In `/meetings`, record a decision with estimated cost, switch to CEO/CFO/Board Member, approve it, and verify the auto-created Budget in `/finance` and tranches in `/calendar`.
   - **Payment Approval & Self-Approval Block (Scenario 4)**: In `/payments`, while signed in as *Hannah Park (Employee)*, verify you cannot approve your own request; switch to *Sanjay Rao (Department Manager)* → *Claire Lin (Finance Manager)* → *Deepak Kulkarni (CFO)* → *Trevor Mills (Payment Executor)* to step through and execute. Check `/admin` Audit Log for logged denials and executions.
   - **PayPal Incoming Reconciliation (Scenario 5)**: In `/payments → Incoming PayPal Checkout`, select `INV-TSL-AR-1042` ($12,500), click *Create PayPal Order*, then *Capture Order & Reconcile Invoice* (or *Simulate Webhook Reconciliation*). Verify invoice changes to `PAID`, Transaction is recorded, Cash Balance increases by $12,500, and Financial Calendar event changes to `PAID`.

---

## PayPal AI Hackathon Criteria Checklist

- **PayPal Developer Platform Integration**: Official PayPal REST API v2 Sandbox Orders (`/v2/checkout/orders`), Capture (`/v2/checkout/orders/{id}/capture`), Webhook signature verification (`/v1/notifications/verify-webhook-signature`), and Payouts adapter (`/v1/payments/payouts`) with transparent `PAYPAL_SIMULATED` labeling when sandbox credentials are not configured.
- **Meaningful AI Integration**: Central tool-calling AI Boardroom orchestrator (`retrieve_company_intelligence`, `query_financial_records`, `retrieve_historical_decisions`, `calculate_financial_scenario`, `search_public_benchmarks`) paired with strict human-in-the-loop governance (AI can validate risks but can never approve or release funds).
- **Open-Source License**: Included in [`LICENSE`](./LICENSE) (MIT License).
- **Clear Setup & Sandbox Configuration**: Documented above and via [`.env.example`](./.env.example).
