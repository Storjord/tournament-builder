# Copilot instructions

Read and follow the repository's root `AGENTS.md` before making changes. It documents the app's architecture, product boundaries, conventions, and validation commands. In particular, keep the app frontend-only and bracket behavior in `src/lib` covered by tests in `tests`.

For Next.js changes, follow the version-specific documentation and cautions in `AGENTS.md` rather than relying on assumptions from other Next.js versions. Avoid unrelated changes, and run the relevant npm validation scripts for the files you touch.
