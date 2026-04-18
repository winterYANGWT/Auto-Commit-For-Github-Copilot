import * as vscode from 'vscode';

let item: vscode.StatusBarItem | undefined;

export function createStatusBar(context: vscode.ExtensionContext): void {
    item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    item.command = 'autocommit-for-github-copilot.generate';
    item.text = '$(sparkle) AutoCommit For Github Copilot';
    item.tooltip = 'Generate commit messages for staged changes';
    item.show();
    context.subscriptions.push(item);
}
