import * as vscode from 'vscode';
import { getSettings } from '../config/settings';
import { groupFiles, parseDiff } from '../git/diffAnalyzer';
import { GitService } from '../git/gitService';
import { generateForAllGroups, getAvailableModels } from '../llm/llmService';
import type {
    CommitCandidate,
    ExtensionMessage,
    GenerateOptions,
    GitLogEntry,
    WebviewMessage,
} from '../types';

export class PanelManager {
    private static instance: PanelManager | undefined;

    private panel: vscode.WebviewPanel | undefined;
    private candidates: CommitCandidate[] = [];
    private fileDiffs: Map<string, string> = new Map();
    private sessionLanguage: string | undefined;
    private cancellation: vscode.CancellationTokenSource | undefined;
    private currentRepoRoot: string | undefined;
    private recentCommits: GitLogEntry[] = [];

    private constructor(private readonly context: vscode.ExtensionContext) { }

    static getInstance(context: vscode.ExtensionContext): PanelManager {
        PanelManager.instance ??= new PanelManager(context);
        return PanelManager.instance;
    }

    async openAndGenerate(): Promise<void> {
        this.ensurePanel();
        this.panel!.reveal(vscode.ViewColumn.One);
    }

    // ─── Panel lifecycle ────────────────────────────────────────────────────────

    private ensurePanel(): void {
        if (this.panel) {
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'autocommit',
            'AutoCommit',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview'),
                ],
            }
        );

        this.panel.webview.html = buildWebviewHtml(this.panel.webview, this.context.extensionUri);

        this.panel.webview.onDidReceiveMessage(
            (msg: WebviewMessage) => {
                this.handleMessage(msg).catch((err) => {
                    console.error('[AutoCommit] handleMessage error:', err);
                    this.post({ type: 'error', message: String(err) });
                });
            },
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.cancellation?.cancel();
        });
    }

    // ─── Message handler ────────────────────────────────────────────────────────

    private async handleMessage(msg: WebviewMessage): Promise<void> {
        switch (msg.type) {
            case 'ready': {
                const settings = this.effectiveSettings();
                this.post({ type: 'settings', settings });
                await this.loadModels();
                await this.loadStagedFiles();
                await this.loadCommitHistory();
                break;
            }

            case 'regenerate': {
                if (msg.settings.language !== 'auto') {
                    this.sessionLanguage = msg.settings.language;
                }
                await this.loadStagedFiles();
                await this.generate(msg.settings);
                break;
            }

            case 'commit': {
                await this.commitSelected(msg.ids, msg.orderedCandidates);
                break;
            }

            case 'openFile': {
                if (!this.currentRepoRoot) {
                    return;
                }
                const uri = vscode.Uri.joinPath(
                    vscode.Uri.file(this.currentRepoRoot),
                    msg.path
                );
                try {
                    await vscode.window.showTextDocument(uri, { preview: true });
                } catch {
                    vscode.window.showWarningMessage(`Could not open file: ${msg.path}`);
                }
                break;
            }

            case 'showDiff': {
                await this.sendFileDiff(msg.path);
                break;
            }

            case 'cancel': {
                this.cancellation?.cancel();
                break;
            }

            case 'refresh': {
                await this.loadStagedFiles();
                await this.loadCommitHistory();
                break;
            }
        }
    }

    // ─── Load models ────────────────────────────────────────────────────────────

    private async loadModels(): Promise<void> {
        try {
            const models = await getAvailableModels();
            this.post({ type: 'availableModels', models });
        } catch (err) {
            console.error('[AutoCommit] Failed to load models:', err);
        }
    }

    // ─── Load staged files ──────────────────────────────────────────────────────

    private async loadCommitHistory(): Promise<void> {
        try {
            const repo = await GitService.getRepository();
            if (!repo) {
                this.post({ type: 'commitHistory', commits: [] });
                return;
            }
            const gitService = new GitService(repo);
            this.recentCommits = await gitService.getRecentCommits(20);
            this.post({ type: 'commitHistory', commits: this.recentCommits });
        } catch (err) {
            console.error('[AutoCommit] Failed to load commit history:', err);
            this.post({ type: 'commitHistory', commits: [] });
        }
    }

    private async loadStagedFiles(): Promise<void> {
        try {
            const repo = await GitService.getRepository();
            if (!repo) {
                this.post({ type: 'stagedFiles', files: [] });
                return;
            }
            const gitService = new GitService(repo);
            this.currentRepoRoot = gitService.repoRoot;
            const diff = await gitService.getStagedDiff();
            if (!diff.trim()) {
                this.post({ type: 'stagedFiles', files: [] });
                return;
            }
            const changes = parseDiff(diff);
            this.fileDiffs.clear();
            for (const change of changes) {
                this.fileDiffs.set(change.path, change.diff);
            }
            this.post({
                type: 'stagedFiles',
                files: changes.map((c) => ({ path: c.path, type: c.type, diff: c.diff })),
            });
        } catch (err) {
            console.error('[AutoCommit] Failed to load staged files:', err);
            this.post({ type: 'stagedFiles', files: [] });
        }
    }

    // ─── Generation pipeline ────────────────────────────────────────────────────

    private async generate(overrideSettings?: GenerateOptions): Promise<void> {
        this.cancellation?.cancel();
        this.cancellation = new vscode.CancellationTokenSource();
        const token = this.cancellation.token;

        this.candidates = [];
        this.post({ type: 'loading' });

        try {
            const repo = await GitService.getRepository();
            if (!repo) {
                this.post({ type: 'error', message: 'No Git repository found. Make sure the workspace contains a git repository.' });
                return;
            }

            const gitService = new GitService(repo);
            this.currentRepoRoot = gitService.repoRoot;

            let settings = overrideSettings ?? this.effectiveSettings();

            if (settings.language === 'auto') {
                settings = { ...settings, language: await gitService.detectLanguage() };
            }

            let diff: string;
            try {
                diff = await gitService.getStagedDiff();
            } catch (err) {
                this.post({ type: 'error', message: `Failed to read staged diff: ${String(err)}` });
                return;
            }

            if (!diff.trim()) {
                this.post({
                    type: 'error',
                    message: 'No staged changes found. Please run git add to stage files first.',
                });
                return;
            }

            const changes = parseDiff(diff);
            const groups = groupFiles(changes);

            this.fileDiffs.clear();
            for (const change of changes) {
                this.fileDiffs.set(change.path, change.diff);
            }

            if (groups.length === 0) {
                this.post({ type: 'error', message: 'Could not analyse the staged changes.' });
                return;
            }

            try {
                const candidates = await generateForAllGroups(groups, settings, token, this.recentCommits);
                for (const candidate of candidates) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    this.candidates.push(candidate);
                    this.post({ type: 'addCandidate', candidate });
                }
            } catch (err) {
                if (!(token.isCancellationRequested || err instanceof vscode.CancellationError)) {
                    this.post({ type: 'error', message: `Generation failed: ${String(err)}` });
                }
            }
        } catch (err) {
            this.post({ type: 'error', message: `Generation failed: ${String(err)}` });
        }

        this.post({ type: 'done' });
    }

    // ─── Commit execution ───────────────────────────────────────────────────────

    private async commitSelected(ids: string[], orderedCandidates?: CommitCandidate[]): Promise<void> {
        // Use ordered candidates from webview if provided (user may have reordered/edited)
        let selected: CommitCandidate[];
        if (orderedCandidates) {
            selected = orderedCandidates.filter((c) => ids.includes(c.id));
        } else {
            selected = this.candidates.filter((c) => ids.includes(c.id));
        }
        if (selected.length === 0) {
            return;
        }

        const unchecked = this.candidates.filter((c) => !ids.includes(c.id));
        const uncheckedFiles = unchecked.flatMap((c) => c.files);

        const repo = await GitService.getRepository();
        if (!repo) {
            this.post({ type: 'error', message: 'Git repository not found.' });
            return;
        }

        const gitService = new GitService(repo);

        try {
            await gitService.unstageAll();

            for (const candidate of selected) {
                await gitService.stageAndCommit(candidate.files, candidate.message);
            }

            if (uncheckedFiles.length > 0) {
                await gitService.restoreStaged(uncheckedFiles);
            }

            this.post({ type: 'committed', count: selected.length });

            void vscode.window.showInformationMessage(
                `AutoCommit: ${selected.length} commit${selected.length > 1 ? 's' : ''} created.`
            );

            // Refresh staged-files panel and commit history after committing
            await this.loadStagedFiles();
            await this.loadCommitHistory();
        } catch (err) {
            this.post({ type: 'error', message: `Commit failed: ${String(err)}` });
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private async sendFileDiff(filePath: string): Promise<void> {
        const content = this.fileDiffs.get(filePath);
        if (content !== undefined) {
            this.post({ type: 'diffContent', path: filePath, content });
        } else {
            const repo = await GitService.getRepository();
            if (!repo) { return; }
            const gitService = new GitService(repo);
            try {
                const fullDiff = await gitService.getStagedDiff();
                const changes = parseDiff(fullDiff);
                const found = changes.find((c) => c.path === filePath);
                if (found) {
                    this.post({ type: 'diffContent', path: filePath, content: found.diff });
                }
            } catch {
                // ignore
            }
        }
    }

    private effectiveSettings(): GenerateOptions {
        const base = getSettings();
        if (this.sessionLanguage) {
            return { ...base, language: this.sessionLanguage };
        }
        return base;
    }

    private post(msg: ExtensionMessage): void {
        void this.panel?.webview.postMessage(msg);
    }
}

// ─── Webview HTML ─────────────────────────────────────────────────────────────

function buildWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'index.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>AutoCommit</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars[Math.floor(Math.random() * chars.length)];
    }
    return nonce;
}
