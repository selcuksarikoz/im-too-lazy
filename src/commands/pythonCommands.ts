import * as vscode from 'vscode';
import { COMMANDS } from '../constants';
import { AccessorMode, applyPythonAccessors } from '../python/accessors';
import { isLanguageEnabled } from '../settings/languages';
import { replaceWholeDocument } from './editorHelpers';

function getPythonEditor(): vscode.TextEditor | undefined {
  if (!isLanguageEnabled('python')) {
    return undefined;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'python') {
    return undefined;
  }

  return editor;
}

async function applyPythonProps(
  editor: vscode.TextEditor,
  mode: AccessorMode,
  target?: { scope: 'property' | 'class'; line: number } | { scope: 'all' }
): Promise<void> {
  const source = editor.document.getText();
  const result = applyPythonAccessors(source, mode, target);

  if (!result.changed) {
    void vscode.window.showInformationMessage('No property getter/setter generated.');
    return;
  }

  const updated = await replaceWholeDocument(editor, result.content);
  if (!updated) {
    void vscode.window.showErrorMessage('Could not update document.');
    return;
  }

  await vscode.commands.executeCommand('editor.action.formatDocument');
}

async function pickAccessorMode(scope: 'property' | 'class' | 'all'): Promise<AccessorMode | undefined> {
  const placeHolder = scope === 'property'
    ? 'Choose action for current property'
    : scope === 'class'
      ? 'Choose action for current class'
      : 'Choose action for all classes';

  const picked = await vscode.window.showQuickPick(
    [
      { label: 'Add getter+setter', mode: 'both' as const },
      { label: 'Add getter only', mode: 'getter' as const },
      { label: 'Add setter only', mode: 'setter' as const }
    ],
    { placeHolder }
  );

  return picked?.mode;
}

// Register Python getter/setter generation commands.
export function registerPythonCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.pythonPropsMenuCurrent, async (line?: number) => {
      if (!isLanguageEnabled('python')) {
        void vscode.window.showInformationMessage('Python features are disabled in I\'m Too Lazy settings.');
        return;
      }

      const editor = getPythonEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a Python file first.');
        return;
      }

      const mode = await pickAccessorMode('property');
      if (!mode) {
        return;
      }

      const targetLine = typeof line === 'number' ? line : editor.selection.active.line;
      await applyPythonProps(editor, mode, { scope: 'property', line: targetLine });
    }),
    vscode.commands.registerCommand(COMMANDS.pythonPropsMenuClass, async (line?: number) => {
      if (!isLanguageEnabled('python')) {
        void vscode.window.showInformationMessage('Python features are disabled in I\'m Too Lazy settings.');
        return;
      }

      const editor = getPythonEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a Python file first.');
        return;
      }

      const mode = await pickAccessorMode('class');
      if (!mode) {
        return;
      }

      const targetLine = typeof line === 'number' ? line : editor.selection.active.line;
      await applyPythonProps(editor, mode, { scope: 'class', line: targetLine });
    }),
    vscode.commands.registerCommand(COMMANDS.pythonPropsMenuAll, async () => {
      if (!isLanguageEnabled('python')) {
        void vscode.window.showInformationMessage('Python features are disabled in I\'m Too Lazy settings.');
        return;
      }

      const editor = getPythonEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a Python file first.');
        return;
      }

      const mode = await pickAccessorMode('all');
      if (!mode) {
        return;
      }

      await applyPythonProps(editor, mode, { scope: 'all' });
    })
  );
}
