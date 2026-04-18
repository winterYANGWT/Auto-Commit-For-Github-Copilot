import * as vscode from 'vscode';
import { clearModelCache } from './llm/llmService';
import { PanelManager } from './ui/panelManager';
import { createStatusBar } from './ui/statusBar';

export function activate(context: vscode.ExtensionContext): void {
    const panelManager = PanelManager.getInstance(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('autocommit.generate', () => {
            void panelManager.openAndGenerate();
        })
    );

    createStatusBar(context);
}

export function deactivate(): void {
    clearModelCache();
}
