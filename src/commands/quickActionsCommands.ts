import * as vscode from 'vscode';
import { COMMANDS } from '../constants';
import { hasAnyEnabledLanguage, isLanguageEnabled } from '../settings/languages';

async function runQuickActions(): Promise<void> {
  if (!hasAnyEnabledLanguage()) {
    void vscode.window.showInformationMessage('All I\'m Too Lazy language features are disabled in settings.');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  const languageId = editor?.document.languageId;
  const line = editor?.selection.active.line;

  if ((languageId === 'json' || languageId === 'jsonc') && isLanguageEnabled('json')) {
    await vscode.commands.executeCommand(COMMANDS.jsonConvertMenu);
    return;
  }

  if (languageId === 'go' && isLanguageEnabled('go')) {
    await vscode.commands.executeCommand(COMMANDS.goTagMenuCurrent, line);
    return;
  }

  if (languageId === 'python' && isLanguageEnabled('python')) {
    await vscode.commands.executeCommand(COMMANDS.pythonPropsMenuClass, line);
    return;
  }

  if (
    (languageId === 'typescript' || languageId === 'typescriptreact')
    && isLanguageEnabled('typescript')
    && isLanguageEnabled('json')
  ) {
    await vscode.commands.executeCommand(COMMANDS.pasteToMenu);
    return;
  }

  if (languageId === 'rust' && isLanguageEnabled('rust') && isLanguageEnabled('json')) {
    await vscode.commands.executeCommand(COMMANDS.pasteToMenu);
    return;
  }

  void vscode.window.showInformationMessage('No enabled action for this file type. Check I\'m Too Lazy language settings.');
}

// Register quick action command that routes to language-specific flows.
export function registerQuickActionsCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.quickActionsMenu, async () => {
      await runQuickActions();
    })
  );
}
