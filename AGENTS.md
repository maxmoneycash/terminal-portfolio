# AGENTS.md

## Cursor Cloud specific instructions

MaxXP is a single-page portfolio app (Vite + React 19 + TypeScript) themed as a Windows XP desktop. There is no backend service — it is a static client app. See `PRODUCT.md` for product context and `package.json` for the full script list.

### Services / commands

- Dev server: `npm run dev` (Vite, binds `0.0.0.0:5173`). This is the primary way to run the app while developing.
- Build (also the only type-check gate): `npm run build` runs `tsc -b && vite build`. There is **no ESLint config and no automated test framework** in this repo, so `npm run build` is what you run to validate a change compiles/type-checks.
- Preview a production build: `npm run preview` (binds `0.0.0.0`).

### Non-obvious notes

- Dependencies install with **npm** (`package-lock.json`). `.npmrc` maps the `@jsr` scope to `https://npm.jsr.io` — this is required for the `@etareduction/humantypingts` dependency to resolve, so don't remove it.
- Vite dev-server proxies `/cm/*` to `https://commits.sh/api/*` (see `vite.config.ts`); `vercel.json` does the same rewrite in production. The "Dev Stats" window and other live panels fetch real GitHub / commits.sh data at runtime. The desktop boots and is fully interactive **without** network access — only the live-telemetry panels degrade when outbound network is unavailable.
- Clicking a project inside the "My Projects" explorer opens the real GitHub repo in a new browser tab; that is expected behavior, not a crash.
- Optional maintenance scripts are not needed to run the app: `npm run projects:refresh` (requires a GitHub token env var, see `scripts/fetch-github-projects.mjs`), `npm run videos:optimize` (requires `ffmpeg`), and `npm run resume:build` (requires a LaTeX `pdflatex` toolchain).
