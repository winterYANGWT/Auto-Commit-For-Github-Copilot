import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import DiffTable from './DiffTable';

interface StagedFileData {
    path: string;
    type: string;
    diff: string;
}

interface Props {
    files: StagedFileData[];
    loading: boolean;
    onRefresh?: () => void;
}

function countLines(diff: string, prefix: string): number {
    if (!diff) return 0;
    return diff.split('\n').filter(l => l.startsWith(prefix) && !l.startsWith(prefix + prefix + prefix)).length;
}

export default function FileChanges({ files, loading, onRefresh }: Props) {
    const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set());

    const toggle = (index: number) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const totalStats = useMemo(() => {
        let additions = 0;
        let deletions = 0;
        for (const f of files) {
            additions += countLines(f.diff, '+');
            deletions += countLines(f.diff, '-');
        }
        return { additions, deletions };
    }, [files]);

    const perFileStats = useMemo(() => {
        return files.map(f => ({
            additions: countLines(f.diff, '+'),
            deletions: countLines(f.diff, '-'),
        }));
    }, [files]);

    if (loading) {
        return (
            <div className="file-changes">
                <div className="file-changes-header">
                    <div className="file-changes-title">
                        <span>File Changes</span>
                    </div>
                    {onRefresh && (
                        <button className="btn-refresh" title="Refresh staged files" onClick={onRefresh}>
                            <RefreshCw size={13} />
                        </button>
                    )}
                </div>
                <div className="loading-wrap">
                    <div className="spinner" />
                    <span>Loading staged changes…</span>
                </div>
            </div>
        );
    }

    if (files.length === 0) {
        return (
            <div className="file-changes">
                <div className="file-changes-header">
                    <div className="file-changes-title">
                        <span>File Changes</span>
                    </div>
                    {onRefresh && (
                        <button className="btn-refresh" title="Refresh staged files" onClick={onRefresh}>
                            <RefreshCw size={13} />
                        </button>
                    )}
                </div>
                <div className="empty-state">
                    <p>No staged changes found.</p>
                    <p style={{ marginTop: 6 }}>
                        Run <code>git add &lt;files&gt;</code> to stage files first.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="file-changes">
            <div className="file-changes-header">
                <div className="file-changes-title">
                    <span>File Changes</span>
                    <span className="file-changes-count">
                        {files.length} {files.length === 1 ? 'file' : 'files'}
                    </span>
                </div>
                <div className="file-changes-stats">
                    <span className="stat-add">+{totalStats.additions}</span>
                    <span className="stat-del">-{totalStats.deletions}</span>
                    {onRefresh && (
                        <button className="btn-refresh" title="Refresh staged files" onClick={onRefresh}>
                            <RefreshCw size={13} />
                        </button>
                    )}
                </div>
            </div>
            <div className="file-changes-body">
                {files.map((file, index) => {
                    const isExpanded = expandedFiles.has(index);
                    const fs = perFileStats[index];
                    const total = fs.additions + fs.deletions;
                    const addRatio = total > 0 ? fs.additions / total : 0;
                    const filledBars = Math.round(addRatio * 10);

                    const statusCls =
                        file.type === 'added' ? 'added' :
                            file.type === 'deleted' ? 'deleted' :
                                file.type === 'renamed' ? 'renamed' : 'modified';
                    const badge =
                        statusCls === 'added' ? 'A' :
                            statusCls === 'deleted' ? 'D' :
                                statusCls === 'renamed' ? 'R' : 'M';

                    return (
                        <div key={index} className="file-row">
                            <button className="file-row-header" onClick={() => toggle(index)}>
                                <span className={`file-row-chevron${isExpanded ? ' expanded' : ''}`}>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </span>
                                <span className={`status-badge ${statusCls}`}>{badge}</span>
                                <span className="file-row-path">{file.path}</span>
                                <div className="file-row-stats">
                                    {fs.additions > 0 && <span className="stat-add">+{fs.additions}</span>}
                                    {fs.deletions > 0 && <span className="stat-del">-{fs.deletions}</span>}
                                    <div className="viz-bar">
                                        {Array.from({ length: 10 }).map((_, i) => {
                                            let cls = 'viz-seg empty';
                                            if (total > 0) {
                                                cls = i < filledBars ? 'viz-seg add' : 'viz-seg del';
                                            }
                                            return <div key={i} className={cls} />;
                                        })}
                                    </div>
                                </div>
                            </button>
                            {isExpanded && (
                                <div className="file-row-diff">
                                    <DiffTable content={file.diff} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
