import * as vscode from 'vscode';
import { clearModelCache } from './llm/llmService';
import { PanelManager } from './ui/panelManager';
import { createStatusBar } from './ui/statusBar';

export function activate(context: vscode.ExtensionContext): void {
    const panelManager = PanelManager.getInstance(context);

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'autocommit-for-github-copilot.generate',
            (sourceControl?: { rootUri?: vscode.Uri }) => {
                // When invoked from the SCM title bar (`scm/title` menu),
                // VS Code passes the SourceControl whose ✨ button was clicked.
                // We forward its rootUri so the panel locks onto that exact repo.
                void panelManager.openAndGenerate(sourceControl?.rootUri);
            }
        )
    );

    createStatusBar(context);
}

export function deactivate(): void {
    clearModelCache();
}
