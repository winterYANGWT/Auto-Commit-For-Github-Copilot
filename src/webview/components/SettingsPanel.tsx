import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { useState } from 'react';
import type { GenerateOptions } from '../../types';

interface Props {
    settings: GenerateOptions;
    models: Array<{ id: string; name: string }>;
    prompt: string;
    onUpdate: (key: string, value: unknown) => void;
    onPromptChange: (prompt: string) => void;
}

export default function SettingsPanel({ settings, models, prompt, onUpdate, onPromptChange }: Props) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="panel-card">
            <button className="panel-toggle" onClick={() => setExpanded(!expanded)}>
                <div className="panel-toggle-left">
                    <Settings size={16} />
                    <span>Configuration</span>
                </div>
                <div className="panel-toggle-right">
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </button>

            {expanded && (
                <div className="panel-body">
                    <div className="config-grid">
                        <div className="config-field">
                            <span className="config-label">Model</span>
                            <select
                                className="config-select"
                                value={settings.model || ''}
                                onChange={(e) => onUpdate('model', e.target.value)}
                            >
                                <option value="">Auto (gpt-4o)</option>
                                {models.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                                ))}
                            </select>
                        </div>
                        <div className="config-field">
                            <span className="config-label">Language</span>
                            <select
                                className="config-select"
                                value={settings.language}
                                onChange={(e) => onUpdate('language', e.target.value)}
                            >
                                <option value="en">English</option>
                                <option value="zh">中文</option>
                                <option value="auto">Auto</option>
                            </select>
                        </div>
                    </div>

                    <label className="config-checkbox-row">
                        <input
                            type="checkbox"
                            checked={settings.conventionalCommits}
                            onChange={(e) => onUpdate('conventionalCommits', e.target.checked)}
                        />
                        Use Conventional Commits format
                    </label>

                    <div className="config-textarea-wrap">
                        <span className="config-label">Custom Prompt</span>
                        <textarea
                            className="config-textarea"
                            value={prompt}
                            onChange={(e) => onPromptChange(e.target.value)}
                            placeholder="Enter additional prompt instructions..."
                            rows={3}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
