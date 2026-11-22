# Security

## Reporting
Please open a private security advisory on this GitHub repository, or an issue without exploit details.

## Trust model
- `setup.sh` runs third-party code at install time: the upstream skill
  (`mromidev/claude-animated-shorts`) pinned to a full commit SHA, and npm/pip packages.
- The skill pin was reviewed for network calls, eval, credential reads, hidden Unicode and prompt injection.
  The review is by the repo owner and is not independently reproducible from this repo. Review any new commit, and
  upstream pull requests, before moving the pin.
- npm dependencies are exact-pinned and locked (`templates/package-lock.json`); npm lifecycle scripts remain enabled
  because `esbuild` needs its install script.
- Never commit credentials; none are needed.
