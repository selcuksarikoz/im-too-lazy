import * as vscode from 'vscode';
import { normalizeJsonInput, JsonValue } from '../converters/shared';

// Read selected text first; fallback to entire document.
export function getSelectionOrDocumentText(editor: vscode.TextEditor): string {
  const selected = editor.document.getText(editor.selection).trim();
  if (selected.length > 0) {
    return selected;
  }

  return editor.document.getText();
}

export function parseJsonFromEditor(editor: vscode.TextEditor): JsonValue {
  return normalizeJsonInput(getSelectionOrDocumentText(editor));
}

export async function openVirtualDocument(content: string, language: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({ content, language });
  await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside, true);
}

export async function replaceWholeDocument(editor: vscode.TextEditor, content: string): Promise<boolean> {
  const range = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(editor.document.getText().length)
  );

  return editor.edit((builder) => {
    builder.replace(range, content);
  });
}
