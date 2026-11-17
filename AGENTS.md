<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project guidance

- This is a frontend-only tournament bracket builder using Next.js App Router, React, TypeScript, and Tailwind CSS. Do not add a backend, persistence, authentication, or API routes unless requested.
- Keep route composition in `src/app`, interactive UI in `src/components`, and framework-independent bracket logic in `src/lib`. Add or update tests in `tests` for bracket behavior.
- Preserve the current behavior documented in `README.md`: individual recurve tournaments for 2-32 unique archers entered in qualification order (seed 1 first), in two formats:
  - Single elimination: fixed seeded bracket (top seeds separated until the final and semifinals), byes to the highest seeds for non-power-of-two fields, no reseeding, and a bronze match between semifinal losers.
  - Swiss system: fixed round count, no rematches, at most one bye per archer, standings by match points, then Buchholz, then Sonneborn-Berger.
  - Results are completed set points only (6-0, 6-2, 6-4, 7-1, 7-3, 6-5). Changing a winner clears dependent later results; score-only corrections keep them.
  - All state lives in browser memory and resets on refresh.
- Keep interactive controls accessible and the layout responsive. Follow the existing Tailwind CSS patterns.
- Use the repository npm scripts for validation: `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Use Node.js 22.17 or newer.
- Read `.github/copilot-instructions.md` for the Copilot-specific entry point. The generated Next.js block above is managed by Next.js; leave it intact.
