// ─── Domain types ────────────────────────────────────────────────────────────

export interface GitLogEntry {
    hash: string;
    message: string;
    author: string;
    date: string;
}

export interface FileChange {
    path: string;
    type: 'added' | 'modified' | 'deleted' | 'renamed';
    diff: string;
}

export type GroupType = 'source' | 'test' | 'deps' | 'config' | 'docs' | 'misc';

export interface FileGroup {
    groupType: GroupType;
    label: string;
    files: FileChange[];
}

export interface CommitCandidate {
    id: string;
    message: string;
    reason: string;
    files: string[];   // relative paths from repo root
    checked: boolean;
}

export interface GenerateOptions {
    conventionalCommits: boolean;
    language: string;  // 'en' | 'zh' | 'auto'
    model?: string;    // e.g. 'gpt-4o', 'claude-3.5-sonnet', ''
    prompt?: string;   // user's custom instruction
}

// ─── postMessage protocol ────────────────────────────────────────────────────

/** Messages sent from the extension host → webview */
export type ExtensionMessage =
    | { type: 'loading' }
    | { type: 'addCandidate'; candidate: CommitCandidate }
    | { type: 'done' }
    | { type: 'error'; message: string }
    | { type: 'committed'; count: number }
    | { type: 'settings'; settings: GenerateOptions }
    | { type: 'availableModels'; models: Array<{ id: string; name: string }> }
    | { type: 'diffContent'; path: string; content: string }
    | { type: 'stagedFiles'; files: Array<{ path: string; type: string; diff: string }> }
    | { type: 'commitHistory'; commits: GitLogEntry[] };

/** Messages sent from the webview → extension host */
export type WebviewMessage =
    | { type: 'ready' }
    | { type: 'regenerate'; settings: GenerateOptions }
    | { type: 'commit'; ids: string[]; orderedCandidates?: CommitCandidate[] }
    | { type: 'openFile'; path: string }
    | { type: 'showDiff'; path: string }
    | { type: 'cancel' }
    | { type: 'refresh' };
