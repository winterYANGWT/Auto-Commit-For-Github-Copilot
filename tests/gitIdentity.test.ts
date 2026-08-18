import assert from 'node:assert/strict';
import test from 'node:test';
import { GitIdentityError, validateGitIdentity } from '../src/git/gitIdentity';

test('rejects commit when user.name is missing', () => {
    assert.throws(
        () => validateGitIdentity('', 'developer@example.com'),
        (error) => error instanceof GitIdentityError &&
            (error as GitIdentityError).missingFields.join(',') === 'user.name'
    );
});

test('rejects commit when user.email is missing', () => {
    assert.throws(
        () => validateGitIdentity('Developer', '  '),
        (error) => error instanceof GitIdentityError &&
            (error as GitIdentityError).missingFields.join(',') === 'user.email'
    );
});

test('reports both missing identity fields', () => {
    assert.throws(
        () => validateGitIdentity(undefined, undefined),
        (error) => error instanceof GitIdentityError &&
            (error as GitIdentityError).missingFields.join(',') === 'user.name,user.email'
    );
});

test('accepts a complete git identity', () => {
    assert.doesNotThrow(() => validateGitIdentity('Developer', 'developer@example.com'));
});
