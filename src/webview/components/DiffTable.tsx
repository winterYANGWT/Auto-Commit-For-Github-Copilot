import { useMemo } from 'react';

interface Props {
    content: string;
}

interface DiffLine {
    type: 'add' | 'del' | 'ctx' | 'hunk' | 'meta';
    oldN?: number;
    newN?: number;
    sign: string;
    text: string;
    raw: string;
}

function parseDiffLines(content: string): DiffLine[] {
    if (!content) return [];
    // Trim trailing newline so we don't emit a phantom empty line.
    const text = content.endsWith('\n') ? content.slice(0, -1) : content;
    const lines = text.split('\n');
    const result: DiffLine[] = [];
    let oldN = 0;
    let newN = 0;
    let sawHunk = false;

    for (const line of lines) {
        if (line.startsWith('@@')) {
            const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (m) {
                oldN = parseInt(m[1], 10);
                newN = parseInt(m[2], 10);
            }
            sawHunk = true;
            result.push({ type: 'hunk', sign: '', text: line, raw: line });
        } else if (
            line.startsWith('diff ') || line.startsWith('index ') ||
            line.startsWith('--- ') || line.startsWith('+++ ') ||
            line.startsWith('new file') || line.startsWith('deleted file') ||
            line.startsWith('similarity') || line.startsWith('rename') ||
            line.charCodeAt(0) === 92
        ) {
            result.push({ type: 'meta', sign: '', text: line, raw: line });
        } else if (!sawHunk) {
            // Anything before the first @@ that isn't a known meta header is
            // just header noise (or, for empty new/deleted files, nothing at
            // all). Don't render it as a context row with phantom "0 0" gutters.
            continue;
        } else if (line.startsWith('+')) {
            result.push({ type: 'add', newN: newN++, sign: '+', text: line.slice(1), raw: line });
        } else if (line.startsWith('-')) {
            result.push({ type: 'del', oldN: oldN++, sign: '-', text: line.slice(1), raw: line });
        } else {
            const text = line.startsWith(' ') ? line.slice(1) : line;
            result.push({ type: 'ctx', oldN: oldN++, newN: newN++, sign: ' ', text, raw: line });
        }
    }
    return result;
}

export default function DiffTable({ content }: Props) {
    const lines = useMemo(() => parseDiffLines(content), [content]);

    if (lines.length === 0) return null;

    return (
        <table className="diff-table">
            <tbody>
                {lines.map((l, i) => {
                    if (l.type === 'meta') {
                        return (
                            <tr key={i} className="diff-meta">
                                <td colSpan={4}>{l.raw}</td>
                            </tr>
                        );
                    }
                    if (l.type === 'hunk') {
                        return (
                            <tr key={i} className="diff-hunk">
                                <td className="diff-gutter" />
                                <td className="diff-gutter" />
                                <td colSpan={2} className="diff-hunk-content">{l.raw}</td>
                            </tr>
                        );
                    }
                    const cls = l.type === 'add' ? 'diff-add' : l.type === 'del' ? 'diff-del' : 'diff-ctx';
                    return (
                        <tr key={i} className={cls}>
                            <td className="diff-gutter">{l.oldN ?? ''}</td>
                            <td className="diff-gutter">{l.newN ?? ''}</td>
                            <td className="diff-sign">{l.sign}</td>
                            <td className="diff-code">{l.text}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
