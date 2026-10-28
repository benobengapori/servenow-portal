# ServeNow — Client Portal

Next.js App Router portal for law-firm clients (Blueprint §2.1, §6.3).

## Run

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_MOCK=1 runs without the NestJS API
npm install
npm run dev                  # http://localhost:3000/jobs/new
npm run typecheck
npm run build
```

## Layout

```
app/
  layout.tsx                    root layout; self-hosted IBM Plex fonts
  globals.css                   design tokens (light/dark) + component classes
  (portal)/
    layout.tsx                  authenticated shell (sidebar); add the auth guard here
    jobs/page.tsx               active jobs
    jobs/new/
      page.tsx                  server shell for the intake wizard
      _components/
        IntakeWizard.tsx        state, API calls, step navigation, submit + 3-D Secure
        Stepper.tsx
        StepMatter.tsx          search existing matters or create one
        StepDocuments.tsx       drag-and-drop PDFs, local SHA-256, upload progress
        StepRecipient.tsx       person/corporation, description, method of service
        AddressCard.tsx         address entry + validation result
        MapPreview.tsx          schematic pin + ~1 km server-visible area
        StepCheckout.tsx        priority, live quote, payment option, hold wording
        JobSummary.tsx          sticky summary rail
        SubmitSuccess.tsx
        MockBankChallenge.tsx   3-D Secure stand-in (mock mode only)
        ui.tsx                  Field, Section, Callout, Icon, ProgressBar…
      _lib/
        constants.ts            courts, forms, rules, priorities   ← verify with counsel
        dates.ts                business days, Ontario holidays, due dates
        pdf.ts                  header check, page count, sample PDFs
        state.ts                form-state types
        format.ts, useCountdown.ts
lib/
  api/client.ts                 typed fetch client (§6.3 + additions below)
  api/mock.ts                   in-memory ApiClient for local dev
  api/errors.ts, idempotency.ts, index.ts
  payments/stripe.ts            Stripe.js loader + handleNextAction
types/jobs.ts                   domain types
```

## Installable demo (phone "app")

A static build with sample data and the in-memory API: no backend, no real charges. It installs to
a phone's home screen and opens full screen with its own icon.

```bash
npm run build:demo                       # → out/ (served from the domain root)
NEXT_PUBLIC_BASE_PATH=/servenow-portal npm run build:demo   # if hosted under a sub-path
```

**GitHub Pages:** push to `main`; `.github/workflows/demo-pages.yml` builds and deploys. One-time:
repo Settings → Pages → Source: **GitHub Actions**. On the free plan the repo must be public.

**Installing:** Android Chrome shows an **Install** button in the app. On iPhone, open the link in
Safari → Share → **Add to Home Screen** (the app shows these steps itself).

Demo data resets when the app is closed. Static hosting can't send security headers, so the
server build (`npm run build`) is what real firms use.

## Job tracking, dispatch and affidavits

`/jobs/view/?id=…` (a query parameter so it works as a static export) shows:

- **Live map** (`components/map/LiveMap.tsx`): Leaflet with OpenStreetMap data and CARTO tiles.
  Fine for the demo; production volume needs a paid tile provider (only the tile URL changes).
- **Dispatch**: offer rounds to servers at 5 km, then 10 km, then "No server available" with
  *Widen search* / *Keep waiting*; on acceptance the server drives to the address. In the demo
  this is simulated in `jobs/view/_lib/useDispatch.ts`; in production the same events come from
  the API over a WebSocket.
- **Attempts**: GPS pin per attempt; points beyond 150 m are flagged (the disputed sample job).
- **Affidavit**: drafted from the job record on the court's form (16B / 8A / 6B), signed by the
  server, then affirmed before a commissioner for taking affidavits (in person or by video under
  O. Reg. 431/20), with signature and stamp. Demo mode can simulate both signatures and
  watermarks the document "DEMO SAMPLE · NOT FOR FILING". The wording is a draft; have Ontario
  counsel review it before production.

## Ask ServeNow (assistant)

A helper, not the main feature: Home leads with *Submit a job* and *Track jobs*; the assistant
sits below them, as a floating **Ask** button on every screen, and as "?" links on confusing steps.

It covers three things: how ServeNow works, general Ontario service rules, and why ServeNow's
evidence holds up (with rule citations). It declines advice on a specific case.

- `lib/assistant/guide.ts`: the vetted guide (answers + sources). Single source of truth.
- `lib/assistant/engine.ts`: demo engine that answers from the guide (used in mock mode).
- `components/assistant/*`: provider (page context), panel, floating button, help links.
- Production: `api.askAssistant` → `POST /assistant/messages` in the API, which calls Claude
  grounded on the same guide. The model may only cite sources from the guide's list and link to
  known app routes; anything else is dropped. The API key stays on the server.

## Endpoints the wizard needs beyond Blueprint §6.3

The NestJS API must implement these; they are typed in `lib/api/client.ts`.

| Method | Path | Why |
| --- | --- | --- |
| PATCH | `/jobs/{id}` | Change priority / method / matter on a draft (optimistic lock via `version`) |
| DELETE | `/jobs/{id}/documents/{docId}` | Remove an uploaded document from a draft |
| POST | `/addresses:validate` | Geocode pre-check; keeps the Google key server-side |
| POST | `/jobs/{id}/submit:confirm` | Finish submission after 3-D Secure (the submit key replays `requires_action`) |
| GET | `/me/payment-options` | Invoice terms and saved cards for the firm |
| GET | `/jobs/{id}/affidavit` | Affidavit draft / signed state for the job page |
| POST | `/assistant/messages` | Ask ServeNow answers (AI model, server-side key) |

## Conventions

- **Status is read-only on the client.** The API owns every `JobStatus` transition.
- **Money is integer cents.** The quote from the API is authoritative; priority cards show indicative "from" prices only.
- **Idempotency keys belong to user actions.** Create one when the user starts an action, keep it in state, reuse it on retry.
- **Branded IDs** (`JobId`, `MatterId`, …) stop IDs from being mixed up. Cast only at the API boundary.
- **The mock is typed as `ApiClient`**, so it can't drift from the real client without a compile error.
