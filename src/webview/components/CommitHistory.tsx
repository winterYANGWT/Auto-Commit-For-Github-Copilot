import { ChevronDown, ChevronRight, GitCommit } from 'lucide-react';
import { useState } from 'react';
import type { GitLogEntry } from '../../types';

interface Props {
    commits: GitLogEntry[];
}

export default function CommitHistory({ commits }: Props) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="panel-card">
            <button className="panel-toggle" onClick={() => setExpanded(!expanded)}>
                <div className="panel-toggle-left">
                    <GitCommit size={16} />
                    <span>Commit History</span>
                    <span className="panel-toggle-count">({commits.length})</span>
                </div>
                <div className="panel-toggle-right">
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </button>

            {expanded && (
                <div className="panel-body">
                    <div className="history-list">
                        {commits.map((c) => (
                            <div key={c.hash} className="history-item">
                                <GitCommit size={14} className="history-item-icon" />
                                <div className="history-item-body">
                                    <div className="history-item-message">{c.message}</div>
                                    <div className="history-item-meta">
                                        {c.author} · {c.date} · {c.hash}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
