# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses [SemVer](https://semver.org/).

## [1.1.0] - 2026-11-20

No breaking changes to the resulting environment: same pinned skill commit, same Remotion stack, same patches.

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
- Paths derive from `$HOME` and are overridable (`SKILL_DIR`, `PROJECT_DIR`); the defaults equal the old `/root/...`
  paths when running as root.
- Interrupted clones no longer leave a broken directory (clone happens in a temp dir, then moved into place).
- Fall back to `--break-system-packages` when pip refuses because of PEP 668.
- Prerequisite checks for `git`, `python3`, `npm`.

### Added
- Test suite (`tests/run.sh`, offline), GitHub Actions CI (shellcheck, tests, npm audit), `.shellcheckrc`,
  `.editorconfig`, `.gitignore`, `SECURITY.md`, this changelog.

### Deliberately not changed
- React 18 / fiber 8 / postprocessing 2 / three 0.170 stay (see README, "Why these versions").

## [1.0.0]
- Initial setup script and README.
