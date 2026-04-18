
interface Props {
    prompt: string;
    onPromptChange: (val: string) => void;
    onGenerate: () => void;
    onRegenerate: () => void;
    generating: boolean;
    disabled: boolean;
    showRegen: boolean;
}

export default function PromptSection({
    prompt,
    onPromptChange,
    onGenerate,
    onRegenerate,
    generating,
    disabled,
    showRegen,
}: Props) {
    return (
        <div className="prompt-section">
            <div className="section-title">&#128221; Instructions</div>
            <textarea
                rows={2}
                placeholder="Additional instructions for commit message generation (optional)..."
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
            />
            <div className="generate-row">
                <button
                    className="btn-primary"
                    disabled={disabled || generating}
                    onClick={onGenerate}
                >
                    &#10024; Generate Commit Messages
                </button>
                {showRegen && (
                    <button className="btn-secondary" onClick={onRegenerate}>
                        &#8635; Regenerate
                    </button>
                )}
            </div>
        </div>
    );
}
