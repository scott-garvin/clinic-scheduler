# Clera

[Open the live demo](https://clera-production.up.railway.app/) or [try the browser-only sample](https://scott-garvin.github.io/clinic-scheduler/). The live demo uses a Clera invitation key for private workspaces and AI. The sample works without a key.

Clera is a fictional clinic operations demo. It covers booking, rescheduling, cancellation, patient check-in, visit status, and an AI scheduling assistant. The assistant can look up records and propose a change. A person must review and approve that change before it reaches the schedule.

The frontend is Vue 3 and TypeScript. The backend is Express with PostgreSQL. OpenAI's Responses API supplies function calls. Scheduling rules live in shared TypeScript and run again on the server when a proposal is approved.

## Try the workflow

The public sample works without a key. It uses fictional patients and stores changes in the current browser tab. Use **Try a guided reschedule** to inspect a prepared proposal and approve it. This sample does not call a model.

For the live backend, open the key icon and enter a **Clera demo access key**. Each browser gets its own 24-hour demo session. The provider API key stays on the server.

1. Open Grace Bauer's appointment and reschedule it. Unavailable times are excluded.
2. Try the patient kiosk. Use the supplied fictional details, confirm the visit, and return to the staff schedule.
3. Move the checked-in patient through roomed and completed.
4. In live mode, ask: “Move Grace Bauer to next Monday at 10 AM with her existing provider. Reason: patient requested next week.” Select an appointment first, or include the patient's name.
5. Review the patient, provider, date, time, and reason in the approval card. Approve or dismiss it.
6. Reset your session to restore the fictional clinic day.

The demo day is the current clinic weekday, or the next Monday on weekends. It stays fixed for the session. Scheduling is limited to weekdays within 60 days of that date, 9 AM to 5 PM Eastern time, with a noon to 1 PM break. Visit duration, provider conflicts, and patient conflicts all affect availability.

## Run locally

Requires Node 22.12 or later and Docker.

```sh
npm ci
cp .env.example .env
docker compose up -d db
npm run dev:api
```

In a second terminal:

```sh
npm run dev
```

Open http://127.0.0.1:5175. The API runs on port 8085. Local PostgreSQL is bound to 127.0.0.1:5445.

Set `OPENAI_API_KEY` in the ignored `.env` to enable live AI. Set `DEMO_ACCESS_KEY` to a separate random value of at least 24 characters. Use that demo key in the app. Never put an OpenAI key in the browser or a `VITE_` variable.

For the containerized app:

```sh
docker compose up --build
```

Open http://127.0.0.1:8085. Compose uses a documented local-only demo key and leaves AI disabled unless you set `OPENAI_API_KEY` in the environment. Change the demo key before hosting. Do not run the host API and container API on port 8085 at the same time.

## How the AI works

```mermaid
sequenceDiagram
    participant User
    participant Vue
    participant API as Express API
    participant Model as OpenAI Responses
    participant DB as PostgreSQL
    User->>Vue: Scheduling request
    Vue->>API: Demo key + private session cookie
    API->>DB: Load this session and reserve AI budget
    API->>Model: Request + allowed tool schemas
    Model-->>API: Function name and arguments
    API->>API: Validate schema, record IDs and scheduling rules
    API-->>Model: Scoped lookup result, if needed
    Model-->>API: Proposed booking, move or cancellation
    API->>DB: Save expiring proposal; leave schedule unchanged
    API-->>Vue: Before/after review card and tool trace
    User->>Vue: Review and approve
    Vue->>API: Separate approval request
    API->>DB: Lock session and proposal
    API->>API: Verify owner, expiry, version and conflicts
    API->>DB: Commit schedule and proposal together
    API-->>Vue: Updated workspace
```

The model is hosted by OpenAI. It does not connect to the database or call a public tool execution endpoint. The backend receives function-call data in the provider's response and decides whether to execute the named function locally.

Available tools are `find_patients`, `find_appointments`, `find_open_slots`, `propose_booking`, `propose_reschedule`, and `propose_cancellation`. A proposal can only refer to records returned by a lookup or an appointment explicitly selected in the interface. The model sees appointment identifiers, fictional names, dates, providers, visit types, and statuses. Patient birth dates and phone numbers are excluded from tool responses.

The request loop stops after six model calls. Each call reserves a shared daily/monthly allowance in PostgreSQL, including failed attempts. The defaults are 60 calls per day and 600 per month, measured in UTC. These are request caps, not dollar caps. The model defaults to `gpt-4.1-mini-2025-04-14`, with a 900-token output limit and a 20-second timeout per call. No automatic retries are billed behind the scenes.

This project demonstrates function calling and human approval. Appointment lookups use structured records. The patient clinic guide adds retrieval over approved passages, with lexical ranking instead of embeddings. It does not use LangGraph; the bounded tool loop and persisted proposal state are explicit in the code.

## Review boundaries

- The server validates manual operations and AI proposals using the same rules.
- Schedule writes lock the session row and require its current version. A change from another tab makes an older proposal stale, even if its chosen slot is still open.
- Proposals expire after 15 minutes. Approval rechecks ownership, expiry, workflow state, and conflicts in one transaction. Repeating an approved request does not apply the change twice.
- The shared invite key admits a visitor. A random HttpOnly, SameSite cookie identifies that visitor's private workspace. The key stays in browser memory; reconnecting after a reload restores the session while its cookie remains valid.
- Session and proposal tables use forced row-level security as additional protection. Hosting must use a restricted database role that cannot bypass RLS. The local Docker database uses a development superuser; tests also exercise the policies under a restricted role.
- API writes have a 16 KB body limit and a 40-request-per-minute process-wide burst limit. AI quotas are database-backed. The active-run guard and burst limit assume one application instance; use shared rate limiting before scaling replicas.

The patient kiosk is part of the same staff demo session. It is not patient authentication. The separate patient portal uses its own scoped invitation/session and never receives the staff workspace. No real email, SMS, billing, insurance checks, clinical advice, or EHR integration occurs. The patient directory is fixed fictional data. This is a portfolio demonstration, not a system approved for real patient information.

Expired sessions are inaccessible but are not automatically physically purged. Add a retention job, production authentication/roles, operational monitoring, backups, and a healthcare-specific security review before considering real clinic use.

## Patient portal and existing kiosk

Open `/?patient=1` for the patient experience. The browser-only sample runs as fictional patient Grace and does not call a model. Its appointment state is independent of the staff sample and resets on reload.

For the live workflow, connect the staff demo, open **Patients**, and choose **Create patient invitation** on a patient card. The link carries a one-time token in its URL fragment, which is removed immediately after the portal opens. Redeeming it creates a separate HttpOnly, SameSite=Strict patient cookie. The staff key is not shared with the patient page.

The patient can book, move, or cancel their own appointments and confirm arrival for an appointment on the demo day. Arrival calls the same shared check-in transition used by the original kiosk and updates the staff schedule. The kiosk remains available for a front-desk walkthrough and now includes approved clinic help. Its help uses fixed source passages and has no conversation history.

Patient invitations expire after 10 minutes and cannot be replayed. Patient sessions expire after 30 minutes; logout revokes the server session. The page clears patient data after it detects expiry. Staff reset revokes that workspace's patient invitations, sessions, and proposals. A per-page session tag also rejects requests from a stale tab after the browser switches patient identities.

Every patient endpoint derives identity from the server session. There is no patient selector in model tools. Availability checks see the full schedule on the server but return only open times. Appointment responses exclude other patients, birth dates, contact details, and staff notes. Proposals are bound to both the workspace and patient; a different patient or the staff proposal route cannot approve them. Confirmed changes record the patient actor in appointment history. Raw AI requests and conversations are not persisted in application tables or logged by the application.

The database session policies scope the containing demo workspace. Patient-level projection and permission checks are enforced in the API and again inside mutation transactions. Invitation/session token hashes live in backend-only tables with RLS enabled; the backend table owner can access these token indexes. This is not a claim of per-patient SQL row isolation in the JSON workspace structure.

### Patient AI and clinic sources

The patient assistant has its own restricted tool schemas. It can read the signed-in patient's appointments, request openings, propose a change, retrieve clinic information, ask fixed clarification questions, or display a care-team handoff. There is no approval tool.

For a clinic question, `search_clinic_info` retrieves up to three approved source passages from `shared/patient.ts`. The model receives those passages as context and selects retrieved IDs with `show_clinic_answer`. The server validates those IDs and renders the exact approved text with its title, section, and review date. Arbitrary model-written answer text is not displayed. This is a retrieval-augmented tool workflow with lexical retrieval and source selection, not a vector database or unconstrained generated medical answer.

The guide covers fictional parking, hours, forms, scheduling, and demo privacy. Clinical questions use a fixed handoff that does not contact a clinician or claim to provide treatment. The same source material powers the kiosk help. Source text is version-controlled; there is no patient-uploaded document ingestion.

### Privacy architecture demonstration

This portfolio uses synthetic patient data to demonstrate scoped access, minimal model context, explicit confirmation, bounded provider calls, expiring sessions, and recorded approval actors. It is not HIPAA certification or approval for real PHI. A real deployment still needs verified patient identity, authorized caregiver/proxy access, organization and staff roles, appropriate vendor agreements and retention configuration, security/risk review, monitoring, incident procedures, and applicable state-law review. The current demo invitation proves possession of a link, not a person's real-world identity. Vendor account settings and paid compliance arrangements have not been changed for this demo.

## Embedded check-in guide

The existing kiosk includes a guide at every step: welcome, finding an appointment, confirming the visit, and completion. Ordinary form validation produces a small error code such as `missing-dob` or `not-found`. The guide receives that code, the current step, and the user's question. It does not receive entered names, birth dates, appointment IDs, or patient records.

`server/kiosk-guide.ts` uses `@langchain/core` directly. A `RunnableSequence` retrieves approved passages, builds a `ChatPromptTemplate` with the step/error context, calls the existing OpenAI adapter, and validates the structured source selection. The adapter requires a function response for this guide. The server displays approved passages rather than arbitrary model-written medical text. Each answer includes its source and a pipeline trace. The small corpus uses lexical retrieval, not vectors; LangGraph is not involved.

The sample performs the same approved-guidance lookup without a model call. Missing fields, confirmation, and saved check-in status remain application responsibilities. Clinical requests use a fixed care-team handoff. Common email, numeric date, phone, and identifier patterns are removed from questions before the model call; this is a precaution, not certified de-identification. Names or other sensitive information typed into free text cannot be reliably removed, so the demo explicitly requires fictional input. Raw questions are not saved in the help queue. External LangSmith/LangChain tracing is disabled by configuration policy; startup rejects enabled tracing flags.

A patient can review and send a **front-desk help request** from any kiosk step, whether AI is enabled or not. Only an approved category, current step, and anonymous visit code are persisted. The model may suggest a category but cannot send the request. Requests appear on the staff Schedule dashboard, refresh every 15 seconds while that dashboard is open, and can be marked resolved. Repeated sends for an open visit are deduplicated. Requests are isolated to the demo workspace using SQL ownership checks and forced RLS. Resolving a request is idempotent and does not alter appointments. The sample queue persists in the current tab; the live queue uses PostgreSQL. No real messages are delivered outside the demo.

A 90-second inactivity timeout clears kiosk form values and assistant drafts, with a warning during the last 30 seconds. Completion clears entered identity fields immediately and returns to the welcome screen after 20 seconds without activity. Delayed assistant responses are discarded when the visitor or step changes. The containing staff demo session remains available; this is not a standalone, authenticated physical kiosk deployment.

Try it: open **Patient kiosk**, choose **Start check-in**, then choose **Find appointment** with empty fields. Read the step-specific explanation, ask the guide to explain it, or request front-desk help. Return to **Schedule** to resolve the request. The live guide uses the existing server API key and shared AI allowance.

## Tests and CI

Create a separate local test database. Test code refuses a URL whose database name is not `clera_test`.

```sh
docker compose exec db createdb -U clera clera_test
```

Set `TEST_DATABASE_URL=postgresql://clera:local-demo-only@127.0.0.1:5445/clera_test` in your shell, then run:

```sh
npm test
npm run build
npm run build:server
npx playwright install chromium
npm run test:e2e
docker build -t clera-check .
```

Unit and PostgreSQL integration tests cover conflicts, durations, state transitions, tool validation, quotas, session isolation, expiry, concurrent writes, and idempotent approval. Playwright runs the complete workflows on desktop and mobile against a real local API/database and a deterministic provider fixture. No CI job needs a paid API key.

GitHub Actions runs the checks before Pages deployment. Separate jobs scan for secrets with Gitleaks and analyze TypeScript with CodeQL. Dependabot opens dependency update PRs. Failure screenshots and traces are retained for seven days.

## Code map

| File                               | Responsibility                                                              |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `shared/domain.ts`                 | Typed records, availability, scheduling rules, state transitions, seed data |
| `server/kiosk-guide.ts`            | LangChain retrieval, step-aware prompt and validated guide response         |
| `src/components/KioskHelp.vue`     | Embedded guide and confirmed assistance requests                            |
| `src/components/HelpInbox.vue`     | Staff assistance queue                                                      |
| `server/patient-assistant.ts`      | Patient-only tools, source retrieval, fixed clinical handoff                |
| `server/patient-router.ts`         | Patient sessions, scoped endpoints and check-in                             |
| `shared/patient.ts`                | Patient projection, identity binding and approved clinic sources            |
| `src/components/PatientPortal.vue` | Patient appointment, confirmation and clinic-help interface                 |
| `server/assistant.ts`              | Provider request, tool allowlist, argument validation, bounded tool loop    |
| `server/store.ts`                  | Scoped transactions, version checks, proposal approval, shared AI quota     |
| `server/app.ts`                    | Demo authorization, session cookie, API routes, errors, burst limit         |
| `server/schema.sql`                | Session/proposal persistence and RLS policies                               |
| `src/components/Assistant.vue`     | Tool trace, proposal review, explicit approval                              |
| `src/components/Kiosk.vue`         | Simulated patient arrival workflow                                          |
| `src/workspace.ts`                 | Sample state and authenticated API access                                   |
| `e2e/workflow.spec.ts`             | Desktop/mobile workflow tests                                               |

GitHub Pages hosts the browser-only sample at `/clinic-scheduler/`. A live AI demo needs the container/backend and PostgreSQL. Configure `VITE_BASE_PATH=/clinic-scheduler/` for Pages and leave it `/` for the hosted application.

## Hosted configuration

`railway.json` builds the Docker image, checks `/api/health`, and limits the service to one replica. The container serves the frontend and API from the same origin. Keep database and provider credentials in Railway runtime variables.

For a shared database, use a dedicated `clera_app` schema and a restricted login with no superuser or RLS bypass permissions. Set `DATABASE_SCHEMA=clera_app` and `MIGRATE_ON_START=false`. Provision the schema and apply `scripts/migrate.ts` under the migration identity before starting the service. Local development defaults to the `public` schema and automatic migrations. Startup checks that the configured session table is accessible before accepting traffic.

Supabase connections should use `sslmode=verify-full` and `sslrootcert=server/certs/supabase-ca.crt` in the database URL. The included certificate is Supabase's public root certificate, copied from the existing portfolio deployment. It contains no private key. The Docker image includes it at that path.

Required runtime variables are `DATABASE_URL` and `DEMO_ACCESS_KEY`. Set `OPENAI_API_KEY` to enable the live assistants, plus `OPENAI_MODEL`, `MAX_AI_DAILY`, and `MAX_AI_MONTHLY` to control model choice and request allowances. The hosting platform supplies `PORT`; the Docker image sets `NODE_ENV=production` for secure cookies. The demo access key is separate from the OpenAI key.

Railway tracks the `main` branch through the Railway GitHub App. Include `scott-garvin/clinic-scheduler` in its selected repositories, connect the production environment to `main`, and enable automatic deployment with Wait for CI. After a release, verify the deployed commit and `/api/health`. Database migrations remain an explicit release step.
