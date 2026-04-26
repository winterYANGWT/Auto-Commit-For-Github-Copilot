# Auto Commit For GitHub Copilot

A VS Code extension that automatically generates intelligent git commit messages from your staged changes using GitHub Copilot.

## Features

- **AI-Powered Commit Messages** — Leverages GitHub Copilot (via `vscode.lm` API) to analyze your staged diff and generate meaningful commit messages
- **AI-Driven File Grouping** — A single LLM call analyses every staged file together and groups them by *intent* (one feature / fix / refactor per commit), not by directory or extension. Falls back to a deterministic rule-based grouping if the model output is malformed
- **One Feature Per Commit** — The grouping prompt enforces atomic commits: feature work, unrelated refactors, docs, config and dependency bumps are split into separate commits automatically
- **Conventional Commits Support** — Optionally enforces `feat/fix/docs/style/refactor/test/chore/ci/build` prefixes
- **Multi-Language** — Generate commit messages in English, Chinese, or auto-detect from your git log history
- **Model Selection** — Choose from all GitHub Copilot models available in your VS Code instance
- **Custom Prompt** — Append your own instructions to guide the generated output
- **Real-Time Streaming** — Commit candidates appear as they are generated, one by one
- **Inline Editing** — Edit any generated commit message before committing
- **Drag to Reorder** — Drag commit candidates to control execution order
- **Selective Commit** — Check or uncheck individual candidates; only selected commits are executed
- **Diff Viewer** — Inspect a full line-by-line diff for each staged file directly in the panel
- **Style Matching** — References your recent commit history to maintain a consistent tone

## Installation

You can install the extension either from a pre-built `.vsix` release or by
building it yourself from source.

### Option A — Install a pre-built `.vsix`

1. Download the latest `autocommit-for-github-copilot-<version>.vsix` from the
   project's [Releases](https://github.com/winterYANGWT/Auto-Commit-For-Github-Copilot/releases) page.
2. In VS Code, open the **Extensions** view (`Ctrl+Shift+X`), click the `…`
   menu in the top-right corner, choose **Install from VSIX…**, and select
   the downloaded file.

   Alternatively, from a terminal:

   ```bash
   code --install-extension autocommit-for-github-copilot-0.2.0.vsix
   ```

### Option B — Build from source

Requires **Node.js 20+** and **npm**.

```bash
# 1. Clone the repository
git clone https://github.com/winterYANGWT/Auto-Commit-For-Github-Copilot.git
cd Auto-Commit-For-Github-Copilot

# 2. Install dependencies
npm install

# 3. Compile the extension and the React webview
npm run compile

# 4. Package into a .vsix (requires the `vsce` CLI)
npx --yes @vscode/vsce package \
    --no-dependencies \
    --allow-missing-repository \
    --out autocommit-for-github-copilot-0.2.0.vsix

# 5. Install the resulting .vsix into VS Code
code --install-extension autocommit-for-github-copilot-0.2.0.vsix
```

After installation, reload VS Code if prompted. You should see a
**✨ AutoCommit** entry in the status bar and a sparkle icon in the Source
Control panel title bar.

> Tip: for development you can also press `F5` in this repo to launch a new
> **Extension Development Host** window with the extension loaded — no
> packaging required.

## Requirements

- VS Code **1.90.0** or later
- The built-in **Git** extension must be enabled
- An active **GitHub Copilot** subscription with the VS Code extension installed and signed in

## Getting Started

1. Stage the files you want to commit with `git add` (or via the VS Code Source Control panel)
2. Open the AutoCommit panel using any of the following:
   - Click the **✨ AutoCommit** item in the status bar
   - Click the **sparkle (✨)** icon in the Source Control panel title bar
   - Run the command **AutoCommit: Generate Commits** from the Command Palette (`Ctrl+Shift+P`)
3. Wait for commit candidates to stream in
4. Review, edit, reorder, or deselect candidates as needed
5. Click **Commit Selected** to execute the commits in order

## Extension Settings

| Setting                                             | Type                     | Default | Description                                                                      |
| --------------------------------------------------- | ------------------------ | ------- | -------------------------------------------------------------------------------- |
| `autocommit-for-github-copilot.conventionalCommits` | `boolean`                | `true`  | Use Conventional Commits style (`feat/fix/docs/…`)                               |
| `autocommit-for-github-copilot.language`            | `"en" \| "zh" \| "auto"` | `"en"`  | Language for generated commit messages. `auto` detects from your git log history |

Settings can also be changed at any time from the **Configuration** panel inside the AutoCommit webview.

## How It Works

```
Staged Changes (git diff --cached)
        │
        ▼
  Parse per-file diffs
        │
        ▼  (single LLM call: grouping + messages together)
  GitHub Copilot (vscode.lm API)
   ─ groups files by INTENT (one feature per commit)
   ─ produces one message + reason per group
        │
        ▼  (fallback if model output is invalid)
  Rule-based grouping (source / test / deps / config / docs / misc)
        │
        ▼
  CommitCandidates  ──►  Webview Panel (React)
                          Review / Edit / Reorder
        │
        ▼
  git commit (per candidate, in order)
```

### Grouping Strategy

The model is instructed to follow one golden rule: **each commit must
represent exactly one feature, fix, refactor, or chore.** Files only share
a group when they jointly implement that single intent (e.g. a feature's
source file together with its own tests). Unrelated changes — even within
the same directory — are split into separate commits.

If the model returns an invalid response (missing files, duplicates, or
unparseable JSON), the extension automatically falls back to the
deterministic rule-based grouping below:

| Group    | Matched Files                                                                |
| -------- | ---------------------------------------------------------------------------- |
| `deps`   | `package.json`, `*.lock`, `requirements.txt`, `Cargo.toml`, `poetry.lock`, … |
| `test`   | `*.test.ts`, `__tests__/`, `test/`, `e2e/`, …                                |
| `config` | `*.config.*`, `.env*`, `*.yaml`, `tsconfig.*`, `.eslintrc`, …                |
| `docs`   | `*.md`, `docs/` directory                                                    |
| `source` | All other source files, sub-grouped by top-level directory                   |
| `misc`   | Root-level files that don't fit any other group                              |

## Commands

| Command                        | Description                                                                 |
| ------------------------------ | --------------------------------------------------------------------------- |
| `AutoCommit: Generate Commits` | Open the AutoCommit panel and generate commit candidates for staged changes |

## Known Limitations

- Requires an active internet connection and a valid GitHub Copilot subscription
- Very large diffs may be truncated depending on the selected model's context window
- The extension only processes **staged** changes (`git add` first)

## License

[GPL-3.0](LICENSE)
