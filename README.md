# clinic-scheduler — Clera

A clinic check-in system with **two connected surfaces** — a staff board and a patient kiosk. **[Live demo →](https://scott-garvin.github.io/clinic-scheduler/)** (toggle **Staff board / Patient kiosk** in the header.)

Vue 3 + TypeScript + Vite.

- **Staff board** — a live front-desk monitor of today's schedule: check-in time, patient, appointment time, provider, location, visit type, insurance, copay, and status (scheduled → checked-in → roomed → completed / no-show), with filters and inline status changes.
- **Patient kiosk** — the touch-first flow a patient walks through on arrival: welcome → find your appointment (last name + date of birth) → confirm it's you → review contact, insurance & copay → consent → checked in. Big targets, one task per screen, a progress stepper.

They're **connected**: check a patient in on the kiosk and they flip to *checked-in* on the staff board. Sample data only, no backend, no real patient data. On the kiosk's find screen, tap a demo patient to fill the form and walk the flow.

## Run locally

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
```

## Stack

Vue 3 (`<script setup lang="ts">`), TypeScript (strict), Vite. A small step state-machine drives the flow; components and styling are hand-built (no UI framework). Deployed to GitHub Pages via GitHub Actions.

A healthcare-domain companion to the [invoice dashboard](https://github.com/scott-garvin/invoice-dashboard) — deliberately a *different kind of app* (a guided kiosk flow vs. an admin dashboard) to show range across product shapes, not just palettes.

Portfolio: [scott-garvin.github.io](https://scott-garvin.github.io)

## License

MIT — see [LICENSE](LICENSE).
