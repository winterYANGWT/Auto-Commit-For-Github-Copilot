import { Check } from 'lucide-react';

interface Props {
    total: number;
    checked: number;
    onCommit: () => void;
}

export default function Footer({ total, checked, onCommit }: Props) {
    if (total === 0) return null;

    return (
        <div className="footer">
            <span className="footer-count">
                {checked} of {total} selected
            </span>
            <button
                className="btn-commit-all"
                disabled={checked === 0}
                onClick={onCommit}
            >
                <Check size={16} />
                Commit Selected{checked > 0 ? ` (${checked})` : ''}
            </button>
        </div>
    );
}
