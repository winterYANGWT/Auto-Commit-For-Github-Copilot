import { useState } from 'react';
import DiffTable from './DiffTable';

interface StagedFileData {
    path: string;
    type: string;
    diff: string;
}

interface Props {
    files: StagedFileData[];
}

const BADGE_MAP: Record<string, { cls: string; text: string }> = {
    added: { cls: 'badge-added', text: 'A' },
    deleted: { cls: 'badge-deleted', text: 'D' },
    renamed: { cls: 'badge-renamed', text: 'R' },
    modified: { cls: 'badge-modified', text: 'M' },
};

export default function StagedFiles({ files }: Props) {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const toggle = (i: number) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });
    };

    return (
        <div className="staged-files-list">
            {files.map((f, i) => {
                const badge = BADGE_MAP[f.type] ?? BADGE_MAP.modified;
                const isExpanded = expanded.has(i);
                return (
                    <div key={i} className={`staged-file${isExpanded ? ' expanded' : ''}`}>
                        <div className="staged-file-header" onClick={() => toggle(i)}>
                            <span className="staged-file-chevron">&#9654;</span>
                            <span className="staged-file-name">{f.path}</span>
                            <span className={`staged-file-badge ${badge.cls}`}>{badge.text}</span>
                        </div>
                        <div className="staged-file-diff">
                            {isExpanded && <DiffTable content={f.diff} />}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
