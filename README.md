# clinic-scheduler — Clera

A patient scheduling / appointment tracker for a clinic front desk. **[Live demo →](https://scott-garvin.github.io/clinic-scheduler/)**

Vue 3 + TypeScript + Vite. A daily schedule with per-appointment status (scheduled → checked-in → in-progress → completed, plus no-show / cancelled), at-a-glance KPIs, a weekly appointment-volume chart, a patients view, and a new-appointment form. Data is seeded and persists in your browser (localStorage) — no backend, no real patient data, nothing leaves your machine. **Reset demo** restores the sample clinic.

A healthcare-domain companion to the [invoice dashboard](https://github.com/scott-garvin/invoice-dashboard): same engineering bar, deliberately different visual identity (calm clinical blue, different type) to show range.

## Run locally

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
```

## Stack

Vue 3 (`<script setup lang="ts">`), TypeScript (strict), Vite. No UI or charting library — components and the volume chart are hand-built. Deployed to GitHub Pages via GitHub Actions.

Portfolio: [scott-garvin.github.io](https://scott-garvin.github.io)

## License

MIT — see [LICENSE](LICENSE).
