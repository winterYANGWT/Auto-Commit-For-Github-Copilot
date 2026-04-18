# Auto Commit For GitHub Copilot

A VS Code extension that automatically generates intelligent git commit messages from your staged changes using GitHub Copilot.

## Features

- **AI-Powered Commit Messages** — Leverages GitHub Copilot (via `vscode.lm` API) to analyze your staged diff and generate meaningful commit messages
- **Smart File Grouping** — Groups staged files by category (source, tests, dependencies, config, docs) and generates a separate commit candidate for each group, enabling atomic commits
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

| Setting | Type | Default | Description |
|---|---|---|---|
| `autocommit.conventionalCommits` | `boolean` | `true` | Use Conventional Commits style (`feat/fix/docs/…`) |
| `autocommit.language` | `"en" \| "zh" \| "auto"` | `"en"` | Language for generated commit messages. `auto` detects from your git log history |

Settings can also be changed at any time from the **Configuration** panel inside the AutoCommit webview.

## How It Works

```
Staged Changes (git diff --cached)
        │
        ▼
  Parse & Group Files
  ┌─────────────────────────────────────────────┐
  │  source │ tests │ deps │ config │ docs │ misc │
  └─────────────────────────────────────────────┘
        │
        ▼  (one LLM call per group)
  GitHub Copilot (vscode.lm API)
        │
        ▼
  CommitCandidates  ──►  Webview Panel (React)
        │                  Review / Edit / Reorder
        ▼
  git commit (per candidate, in order)
```

### File Grouping Rules

| Group | Matched Files |
|---|---|
| `deps` | `package.json`, `*.lock`, `requirements.txt`, `Cargo.toml`, `poetry.lock`, … |
| `test` | `*.test.ts`, `__tests__/`, `test/`, `e2e/`, … |
| `config` | `*.config.*`, `.env*`, `*.yaml`, `tsconfig.*`, `.eslintrc`, … |
| `docs` | `*.md`, `docs/` directory |
| `source` | All other source files, sub-grouped by top-level directory |
| `misc` | Root-level files that don't fit any other group |

## Commands

| Command | Description |
|---|---|
| `AutoCommit: Generate Commits` | Open the AutoCommit panel and generate commit candidates for staged changes |

## Known Limitations

- Requires an active internet connection and a valid GitHub Copilot subscription
- Very large diffs may be truncated depending on the selected model's context window
- The extension only processes **staged** changes (`git add` first)

## License

[MIT](LICENSE)
