# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses [SemVer](https://semver.org/).

## [2.0.0] - 2026-11-20

### License
- The project is now licensed under the Apache License 2.0 (`LICENSE`).

The resulting environment is the same (same pinned skill commit, Remotion stack and patches), but a few behaviours of
the script itself changed. Because some can fail where the old script succeeded, this is a major release.

### Breaking / behaviour changes (migration notes in README)
- **Existing skill checkout must be at the pinned commit.** A checkout at any other commit now aborts the run
  (previously it was accepted silently). Remove the directory or set `SKILL_SHA` to a commit you reviewed.
- **Paths follow `$HOME`** (default `~/.claude/skills/cartoon-3d-short`, `~/remotion-shorts`) instead of fixed `/root/...`.
  Identical when running as root; override with `SKILL_DIR` / `PROJECT_DIR` otherwise. `HOME` unset falls back to `/root`.
- `bridge_merge.py` is patched with the absolute `$PROJECT_DIR` instead of `~/remotion-shorts`. Installs patched by
  earlier versions (`~/remotion-shorts`) are recognised and left as is.
- `PROJECT_DIR` / `SKILL_DIR` containing quotes, backslashes or newlines are rejected up front.
- Python packages are now range-bounded (`numpy>=1.26,<3`, `scipy>=1.11,<2`, `pillow>=10,<14`); majors beyond
  those are no longer picked up. Needs a Python that supports those ranges (3.9+ for these lower bounds).
- `npm ci` is used when a lockfile is present; if it fails (drifted `package.json`) the script falls back to
  `npm install` with a notice, as before.

The script is still self-contained: it can be pasted as the environment setup script or piped to `bash -s`. The
templates are embedded in it; `templates/` is kept in the repo as the reviewed copy (a test enforces they match) and
supplies the lockfile when the script is run from a checkout. Without a checkout, `npm install` is used (all direct
dependencies are exact pins).

### Security
- Pin the upstream skill by its full 40-char SHA (was the abbreviated `e3b817b`, which a same-named tag could hijack),
  fetch only that commit without tags, and verify `HEAD` after checkout.
- An existing skill checkout is now verified against the pin on every run; a mismatch aborts instead of being used.
- Install npm dependencies from a committed `package-lock.json` with `npm ci`; all direct dependencies are exact pins
  (`@react-three/fiber` 8.18.0, `@react-three/postprocessing` 2.19.1, `postprocessing` 6.39.6, `typescript` 5.9.3,
  `@types/react` 18.3.28; previously caret ranges resolving to these versions). `npm audit`: 0 vulnerabilities.
- Python packages come from `requirements.txt` with bounded ranges instead of unbounded `pip install`.

### Changed
- Patches to the upstream skill files are verified: the script fails with a clear message if the expected text is
  missing (previously `sed` silently did nothing).
- `package.json`, `tsconfig.json`, `src/Root.tsx`, `src/index.ts` are now only created when missing, matching what the
  README always claimed (previously `package.json` and `tsconfig.json` were overwritten on every run).
- Paths are overridable (`SKILL_DIR`, `PROJECT_DIR`); see breaking notes above.
- Interrupted clones no longer leave a broken directory (clone happens in a temp dir, then moved into place).
- Retry with `--break-system-packages` only when pip reports PEP 668 (`externally-managed-environment`); other pip
  errors are shown and abort.
- Prerequisite checks for `git`, `python3`, `npm`.

### Added
- Test suite (`tests/run.sh`, offline), GitHub Actions CI (shellcheck, tests, npm audit), `.shellcheckrc`,
  `.editorconfig`, `.gitignore`, `SECURITY.md`, this changelog.

### Deliberately not changed
- React 18 / fiber 8 / postprocessing 2 / three 0.170 stay (see README, "Why these versions").

## [1.0.0]
- Initial setup script and README.
