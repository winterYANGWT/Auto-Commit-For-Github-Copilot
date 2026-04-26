import * as path from 'path';
import type { FileChange, FileGroup, GroupType } from '../types';

// ─── Diff parser ─────────────────────────────────────────────────────────────

/** Parses a raw `git diff --cached` output into individual FileChange objects. */
export function parseDiff(rawDiff: string): FileChange[] {
    const results: FileChange[] = [];
    // Each file diff starts with "diff --git a/... b/..."
    const segments = rawDiff.split(/^(?=diff --git )/m).filter(Boolean);

    for (const segment of segments) {
        // Match either "diff --git a/PATH b/PATH" or "diff --git \"a/PATH\" \"b/PATH\""
        // (git uses the quoted form when paths contain non-ASCII bytes and
        // core.quotePath=true). Capture group 1 = unquoted b-path,
        // group 2 = quoted b-path with octal-escaped bytes.
        const headerMatch = segment.match(
            /^diff --git (?:a\/.+? b\/(.+)|"a\/(?:[^"\\]|\\.)+" "b\/((?:[^"\\]|\\.)+)")\n/
        );
        if (!headerMatch) {
            continue;
        }

        const filePath = headerMatch[1]
            ? headerMatch[1].trimEnd()
            : unescapeGitQuotedPath(headerMatch[2]);
        let type: FileChange['type'] = 'modified';

        if (/^new file mode/m.test(segment)) {
            type = 'added';
        } else if (/^deleted file mode/m.test(segment)) {
            type = 'deleted';
        } else if (/^rename /m.test(segment)) {
            type = 'renamed';
        }

        results.push({ path: filePath, type, diff: segment });
    }

    return results;
}

/**
 * Decodes a git "quoted" path, where non-ASCII bytes appear as `\NNN` octal
 * escapes and a few characters use C-style escapes (\\, \", \t, \n, \r).
 * The decoded byte sequence is interpreted as UTF-8.
 */
function unescapeGitQuotedPath(s: string): string {
    const bytes: number[] = [];
    const cEscapes: Record<string, number> = {
        '"': 0x22, '\\': 0x5c, t: 0x09, n: 0x0a, r: 0x0d, b: 0x08, f: 0x0c, a: 0x07, v: 0x0b,
    };
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '\\' && i + 3 < s.length && /[0-3]/.test(s[i + 1]) && /[0-7]/.test(s[i + 2]) && /[0-7]/.test(s[i + 3])) {
            bytes.push(parseInt(s.substr(i + 1, 3), 8));
            i += 3;
        } else if (ch === '\\' && i + 1 < s.length && cEscapes[s[i + 1]] !== undefined) {
            bytes.push(cEscapes[s[i + 1]]);
            i += 1;
        } else {
            // Plain ASCII char in the quoted path
            bytes.push(ch.charCodeAt(0) & 0xff);
        }
    }
    return new TextDecoder('utf-8').decode(Uint8Array.from(bytes));
}

// ─── File grouper ─────────────────────────────────────────────────────────────

/** Groups FileChange[] into FileGroup[] so each group → one LLM call → one commit. */
export function groupFiles(changes: FileChange[]): FileGroup[] {
    const map = new Map<string, FileGroup>();

    for (const change of changes) {
        const key = classifyFile(change.path);

        if (!map.has(key.groupKey)) {
            map.set(key.groupKey, {
                groupType: key.type,
                label: key.label,
                files: [],
            });
        }

        map.get(key.groupKey)!.files.push(change);
    }

    return Array.from(map.values());
}

// ─── Classification helpers ──────────────────────────────────────────────────

interface Classification {
    groupKey: string;
    type: GroupType;
    label: string;
}

/** Priority-ordered rules that assign a file to exactly one group. */
function classifyFile(filePath: string): Classification {
    const fileName = path.posix.basename(filePath);
    const ext = path.posix.extname(filePath).toLowerCase();
    const parts = filePath.split('/');

    // 1. Dependency lock / manifest files
    if (
        /^(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json|requirements\.txt|Pipfile|Pipfile\.lock|Cargo\.toml|Cargo\.lock|go\.mod|go\.sum|composer\.json|composer\.lock|Gemfile|Gemfile\.lock|pyproject\.toml|poetry\.lock)$/.test(
            fileName
        )
    ) {
        return { groupKey: 'deps', type: 'deps', label: 'deps' };
    }

    // 2. Test files
    if (
        /\.(test|spec)\.[jt]sx?$/.test(fileName) ||
        parts.some((p) => p === '__tests__' || p === 'test' || p === 'tests' || p === '__test__' || p === 'e2e')
    ) {
        return { groupKey: 'test', type: 'test', label: 'test' };
    }

    // 3. Config files
    if (
        /\.(config|rc)\.[jt]sx?$/.test(fileName) ||
        /^\.env/.test(fileName) ||
        ['.yaml', '.yml', '.toml', '.ini', '.editorconfig'].includes(ext) ||
        /^(tsconfig.*|jest\.config.*|vite\.config.*|webpack\.config.*|babel\.config.*|\.eslintrc.*|\.prettierrc.*|\.stylelintrc.*|\.babelrc.*)$/.test(
            fileName
        )
    ) {
        return { groupKey: 'config', type: 'config', label: 'config' };
    }

    // 4. Documentation
    if (['.md', '.mdx', '.rst', '.txt', '.adoc'].includes(ext) || parts[0] === 'docs' || parts[0] === 'doc') {
        return { groupKey: 'docs', type: 'docs', label: 'docs' };
    }

    // 5. Source files — group by top-level directory
    if (parts.length > 1) {
        const topDir = parts[0];
        return { groupKey: `source:${topDir}`, type: 'source', label: `source: ${topDir}/` };
    }

    // 6. Root-level miscellaneous files
    return { groupKey: 'misc', type: 'misc', label: 'misc' };
}
