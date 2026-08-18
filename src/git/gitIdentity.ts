export type GitIdentityField = 'user.name' | 'user.email';

export class GitIdentityError extends Error {
    constructor(readonly missingFields: GitIdentityField[]) {
        super(
            `Git user identity is not configured. Missing: ${missingFields.join(', ')}. ` +
            'Configure user.name and user.email before committing.'
        );
        this.name = 'GitIdentityError';
    }
}

export function validateGitIdentity(name?: string, email?: string): void {
    const missingFields: GitIdentityField[] = [];
    if (!name?.trim()) {
        missingFields.push('user.name');
    }
    if (!email?.trim()) {
        missingFields.push('user.email');
    }
    if (missingFields.length > 0) {
        throw new GitIdentityError(missingFields);
    }
}
