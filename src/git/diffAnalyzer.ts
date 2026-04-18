import * as path from 'path';
import type { FileChange, FileGroup, GroupType } from '../types';

// ─── Diff parser ─────────────────────────────────────────────────────────────

/** Parses a raw `git diff --cached` output into individual FileChange objects. */
export function parseDiff(rawDiff: string): FileChange[] {
    const results: FileChange[] = [];
    // Each file diff starts with "diff --git a/... b/..."
    const segments = rawDiff.split(/^(?=diff --git )/m).filter(Boolean);

    for (const segment of segments) {
        const headerMatch = segment.match(/^diff --git a\/.+ b\/(.+)\n/);
        if (!headerMatch) {
            continue;
        }

        const filePath = headerMatch[1].trimEnd();
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
