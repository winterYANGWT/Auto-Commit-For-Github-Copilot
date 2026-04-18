import type { GenerateOptions } from '../../types';

interface Props {
    settings: GenerateOptions;
    models: Array<{ id: string; name: string }>;
    onUpdate: (key: string, value: unknown) => void;
}

export default function SettingsBar({ settings, models, onUpdate }: Props) {
    return (
        <div className="settings-bar">
            <label>
                <input
                    type="checkbox"
                    checked={settings.conventionalCommits}
                    onChange={(e) => onUpdate('conventionalCommits', e.target.checked)}
                />
                Conventional Commits
            </label>
            <label>
                Model:&nbsp;
                <select
                    value={settings.model || ''}
                    onChange={(e) => onUpdate('model', e.target.value)}
                >
                    <option value="">Auto (gpt-4o)</option>
                    {models.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.name || m.id}
                        </option>
                    ))}
                </select>
            </label>
            <label style={{ marginLeft: 'auto' }}>
                Language:&nbsp;
                <select
                    value={settings.language}
                    onChange={(e) => onUpdate('language', e.target.value)}
                >
                    <option value="en">English</option>
                    <option value="zh">中文</option>
                    <option value="auto">Auto</option>
                </select>
            </label>
        </div>
    );
}
