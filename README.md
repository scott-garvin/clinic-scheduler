# clinic-scheduler — Clera

A **patient self check-in kiosk** for a clinic waiting room. **[Live demo →](https://scott-garvin.github.io/clinic-scheduler/)**

Vue 3 + TypeScript + Vite. Instead of a staff dashboard, this is the touch-first flow a patient walks through on arrival: **welcome → find your appointment (last name + date of birth) → confirm it's you → review your contact & insurance → consent → checked in.** Large targets, one task per screen, a progress stepper, and calm clinical styling — the shape of a real appointment check-in, not a data grid.

Sample patients only; no backend and no real data. On the "find" screen, tap one of the demo patients to fill the form and walk the flow.

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
