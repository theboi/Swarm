# Swarm repository instructions

- Work directly on `main`. Pull before starting and before pushing; commit and push verified changes frequently.
- Preserve unrelated working-tree changes. Do not clean, reset, stash or force-push.
- Run npm commands from the repository root. `client/` is an npm workspace.
- Swarm code lives in `src/` and `client/`; reusable skills live in `.agents/skills/`.
- The `edenmind` symlink is a local shared-UI dependency on `../EdenMind`.
  Do not modify that checkout as part of Swarm work.
- Keep `.env`, `.data`, credential homes, dependency installs and generated builds out of Git.
- The existing EdenMind Swarm remains live on ports 4310 and 4311. Do not stop,
  restart or replace it, install the LaunchAgent template, or launch this copy
  until the product owner requests the temporary instance and its ports.
- Read `client/AGENTS.md` or `src/server/AGENTS.md` before changing those scopes.
  Those inherited files describe EdenMind conventions; Swarm uses the TypeScript
  runtime and commands in this repository's `package.json`.
- Historical plans/specifications under `docs/` retain their original paths as
  historical evidence. Use the root README for the current repository map.
