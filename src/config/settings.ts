import * as vscode from 'vscode';
import type { GenerateOptions } from '../types';

export function getSettings(): GenerateOptions {
    const config = vscode.workspace.getConfiguration('autocommit-for-github-copilot');
    return {
        conventionalCommits: config.get<boolean>('conventionalCommits', true),
        language: config.get<string>('language', 'en'),
    };
}

export async function updateSettings(partial: Partial<GenerateOptions>): Promise<void> {
    const config = vscode.workspace.getConfiguration('autocommit-for-github-copilot');
    if (partial.conventionalCommits !== undefined) {
        await config.update(
            'conventionalCommits',
            partial.conventionalCommits,
            vscode.ConfigurationTarget.Global
        );
    }
    if (partial.language !== undefined) {
        await config.update('language', partial.language, vscode.ConfigurationTarget.Global);
    }
}
