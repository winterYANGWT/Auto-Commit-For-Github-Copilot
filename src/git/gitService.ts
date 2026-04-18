import { execFile } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

// ─── Minimal types for the VS Code Git extension API ─────────────────────────

interface GitExtension {
    getAPI(version: 1): GitAPI;
}

interface GitAPI {
    repositories: GitRepository[];
}

export interface GitRepository {
    rootUri: vscode.Uri;
    diff(cached?: boolean): Promise<string>;
    state: {
        indexChanges: Array<{ uri: vscode.Uri }>;
    };
}

// ─── GitService ───────────────────────────────────────────────────────────────

export class GitService {
    readonly repoRoot: string;

    constructor(private readonly repo: GitRepository) {
        this.repoRoot = repo.rootUri.fsPath;
    }

    /** Returns the first open repository, or undefined if none found. */
    static async getRepository(): Promise<GitRepository | undefined> {
        const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
        if (!ext) {
            return undefined;
        }
        if (!ext.isActive) {
            try {
                await ext.activate();
            } catch {
                return undefined;
            }
        }
        const api = ext.exports.getAPI(1);
        return api.repositories[0];
    }

    /** Returns the full staged diff text. */
    async getStagedDiff(): Promise<string> {
        return this.repo.diff(true);
    }

    /** Returns staged file paths (relative to repo root, forward slashes). */
    getStagedFilePaths(): string[] {
        return this.repo.state.indexChanges.map((c) =>
            c.uri.fsPath.replace(this.repoRoot + '/', '').replace(/\\/g, '/')
        );
    }

    /**
     * Detects the language of the current git user's commits.
     * Reads up to 20 commit subjects authored by the current user.
     * Returns 'zh' if non-ASCII characters make up >20% of total, else 'en'.
     */
    async detectLanguage(): Promise<'en' | 'zh'> {
        try {
            const { stdout: emailOut } = await this.git(['config', 'user.email']);
            const userEmail = emailOut.trim().toLowerCase();

            const { stdout: logOut } = await this.git([
                'log',
                '--format=%ae\t%s',
                '-50',
                '--no-merges',
            ]);

            const subjects = logOut
                .trim()
                .split('\n')
                .filter((line) => {
                    const tab = line.indexOf('\t');
                    return tab !== -1 && line.slice(0, tab).toLowerCase() === userEmail;
                })
                .map((line) => line.slice(line.indexOf('\t') + 1))
                .slice(0, 20);

            if (subjects.length === 0) {
                return 'en';
            }

            const allText = subjects.join('');
            const nonAsciiCount = (allText.match(/[^\x00-\x7F]/g) ?? []).length;
            return nonAsciiCount / allText.length > 0.2 ? 'zh' : 'en';
        } catch {
            return 'en';
        }
    }

    /**
     * Stages exactly `files`, then commits with `message`.
     * Caller is responsible for having called unstageAll() first.
     */
    async stageAndCommit(files: string[], message: string): Promise<void> {
        await this.git(['add', '--', ...files]);
        await this.git(['commit', '-m', message]);
    }

    /** Unstages all currently staged files. */
    async unstageAll(): Promise<void> {
        await this.git(['restore', '--staged', '.']);
    }

    /**
     * Returns the most recent commits on the current branch (up to `count`).
     */
    async getRecentCommits(count: number = 20): Promise<Array<{ hash: string; message: string; author: string; date: string }>> {
        try {
            const { stdout } = await this.git([
                'log',
                `--max-count=${count}`,
                '--no-merges',
                '--format=%H%x1f%s%x1f%an%x1f%ai',
            ]);
            if (!stdout.trim()) return [];
            return stdout.trim().split('\n').map((line) => {
                const [hash, message, author, date] = line.split('\x1f');
                return { hash: hash.slice(0, 8), message, author, date: date.slice(0, 16) };
            });
        } catch {
            return [];
        }
    }

    /** Re-stages the given files (used to restore unchecked candidates). */
    async restoreStaged(files: string[]): Promise<void> {
        if (files.length === 0) {
            return;
        }
        await this.git(['add', '--', ...files]);
    }

    private async git(args: string[]): Promise<{ stdout: string; stderr: string }> {
        return execFileAsync('git', args, { cwd: this.repoRoot });
    }
}
