import * as vscode from 'vscode';
import { COMMANDS, GO_TAGS } from '../constants';
import { applyStructTags } from '../go/tagger';
import { isLanguageEnabled } from '../settings/languages';
import { replaceWholeDocument } from './editorHelpers';

const goTagMenuOptions: Array<{ label: string; target: readonly string[] }> = [
  { label: 'Convert to json+validate(required) tags', target: GO_TAGS.jsonValidateRequired },
  { label: 'Convert to bson tags', target: ['bson'] },
  { label: 'Convert to db tags', target: GO_TAGS.db },
  { label: 'Convert to gorm tags', target: ['gorm'] },
  { label: 'Convert to form tags', target: ['form'] },
  { label: 'Convert to xorm tags', target: ['xorm'] },
  { label: 'Convert to yaml tags', target: ['yaml'] },
  { label: 'Convert to toml tags', target: ['toml'] },
  { label: 'Convert to xml tags', target: ['xml'] },
  { label: 'Convert to mapstructure tags', target: ['mapstructure'] },
  { label: 'Convert to query tags', target: ['query'] },
  { label: 'Convert to json+bson tags', target: GO_TAGS.jsonBson },
  { label: 'Convert to json+bson+validate(required)', target: GO_TAGS.jsonBsonValidateRequired },
  { label: 'Convert to all tags (gorm, xorm, form, ...)', target: GO_TAGS.all }
];

function getGoEditor(): vscode.TextEditor | undefined {
  if (!isLanguageEnabled('go')) {
    return undefined;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'go') {
    return undefined;
  }

  return editor;
}

async function applyTags(editor: vscode.TextEditor, tagKeys: readonly string[], targetLine?: number): Promise<void> {
  const source = editor.document.getText();
  const result = applyStructTags(source, tagKeys, targetLine);

  if (!result.changed) {
    void vscode.window.showInformationMessage('No struct field updated.');
    return;
  }

  const updated = await replaceWholeDocument(editor, result.content);
  if (!updated) {
    void vscode.window.showErrorMessage('Could not update document.');
    return;
  }

  await vscode.commands.executeCommand('editor.action.formatDocument');
}

async function runGoTagMenu(scope: 'current' | 'all', line?: number): Promise<void> {
  if (!isLanguageEnabled('go')) {
    void vscode.window.showInformationMessage('Go features are disabled in I\'m Too Lazy settings.');
    return;
  }

  const editor = getGoEditor();
  if (!editor) {
    void vscode.window.showErrorMessage('Open a Go file first.');
    return;
  }

  const picked = await vscode.window.showQuickPick(
    goTagMenuOptions,
    { placeHolder: scope === 'all' ? 'Choose tag set for all structs' : 'Choose tag set for current struct' }
  );

  if (!picked) {
    return;
  }

  const targetLine = scope === 'current' ? (typeof line === 'number' ? line : editor.selection.active.line) : undefined;
  await applyTags(editor, picked.target, targetLine);
}

// Register Go struct tagging commands.
export function registerGoCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.goTagMenuCurrent, async (line?: number) => {
      await runGoTagMenu('current', line);
    }),
    vscode.commands.registerCommand(COMMANDS.goTagMenuAll, async () => {
      await runGoTagMenu('all');
    }),
    vscode.commands.registerCommand(COMMANDS.goTagCurrentJsonBson, async (line?: number) => {
      const editor = getGoEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a Go file first.');
        return;
      }

      const targetLine = typeof line === 'number' ? line : editor.selection.active.line;
      await applyTags(editor, GO_TAGS.jsonBson, targetLine);
    }),
    vscode.commands.registerCommand(COMMANDS.goTagCurrentAll, async (line?: number) => {
      const editor = getGoEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a Go file first.');
        return;
      }

      const targetLine = typeof line === 'number' ? line : editor.selection.active.line;
      await applyTags(editor, GO_TAGS.all, targetLine);
    }),
    vscode.commands.registerCommand(COMMANDS.goTagAllJsonBson, async () => {
      const editor = getGoEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a Go file first.');
        return;
      }

      await applyTags(editor, GO_TAGS.jsonBson);
    }),
    vscode.commands.registerCommand(COMMANDS.goTagAllAll, async () => {
      const editor = getGoEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a Go file first.');
        return;
      }

      await applyTags(editor, GO_TAGS.all);
    })
  );
}
