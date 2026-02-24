import * as vscode from 'vscode';
import { COMMANDS, GO_TAGS } from '../constants';
import { jsonToGo } from '../converters/jsonToGo';
import { jsonToDrizzle } from '../converters/jsonToDrizzle';
import { jsonToPythonDataclass, jsonToPythonPydantic, jsonToPythonTypedDict } from '../converters/jsonToPython';
import { jsonToPrisma } from '../converters/jsonToPrisma';
import { jsonToRust } from '../converters/jsonToRust';
import { JsonValue, normalizeJsonInput } from '../converters/shared';
import { jsonToTypeScript } from '../converters/jsonToTypeScript';
import { jsonToTypeScriptZod } from '../converters/jsonToTypeScriptZod';
import { applyStructTags } from '../go/tagger';
import { isLanguageEnabled } from '../settings/languages';
import { getSelectionOrDocumentText, openVirtualDocument, parseJsonFromEditor } from './editorHelpers';

type ConvertTarget =
  | 'go'
  | 'typescript'
  | 'typescript-zod'
  | 'typescript-prisma'
  | 'typescript-drizzle'
  | 'rust'
  | 'python-pydantic'
  | 'python-dataclass'
  | 'python-typeddict';

interface ConvertChoice {
  label: string;
  target: ConvertTarget;
  goTags?: readonly string[];
}

function getActiveEditor(): vscode.TextEditor | undefined {
  return vscode.window.activeTextEditor;
}

function parseJsonFlexible(raw: string): JsonValue {
  const text = raw.trim();
  if (!text) {
    throw new Error('Selection is empty.');
  }

  try {
    return normalizeJsonInput(text);
  } catch {
    // Support selected JSON field fragments like: `"name": "x",` or `"name": "x", "age": 1,`
    const normalizedFragment = text
      .replace(/^\s*,+/, '')
      .replace(/,+\s*$/, '');
    const wrapped = `{${normalizedFragment}}`;
    return normalizeJsonInput(wrapped);
  }
}

function parseJsonFromEditorFlexible(editor: vscode.TextEditor): JsonValue {
  return parseJsonFlexible(getSelectionOrDocumentText(editor));
}

function getConvertChoices(): ConvertChoice[] {
  const choices: ConvertChoice[] = [];

  if (isLanguageEnabled('go')) {
    choices.push(
      { label: 'Convert to Go (json+validate required)', target: 'go', goTags: GO_TAGS.jsonValidateRequired },
      { label: 'Convert to Go (bson)', target: 'go', goTags: ['bson'] },
      { label: 'Convert to Go (db)', target: 'go', goTags: GO_TAGS.db },
      { label: 'Convert to Go (gorm)', target: 'go', goTags: ['gorm'] },
      { label: 'Convert to Go (form)', target: 'go', goTags: ['form'] },
      { label: 'Convert to Go (xorm)', target: 'go', goTags: ['xorm'] },
      { label: 'Convert to Go (yaml)', target: 'go', goTags: ['yaml'] },
      { label: 'Convert to Go (toml)', target: 'go', goTags: ['toml'] },
      { label: 'Convert to Go (xml)', target: 'go', goTags: ['xml'] },
      { label: 'Convert to Go (mapstructure)', target: 'go', goTags: ['mapstructure'] },
      { label: 'Convert to Go (query)', target: 'go', goTags: ['query'] },
      { label: 'Convert to Go (json+bson)', target: 'go', goTags: GO_TAGS.jsonBson },
      { label: 'Convert to Go (json+bson+validate required)', target: 'go', goTags: GO_TAGS.jsonBsonValidateRequired },
      { label: 'Convert to Go (all tags)', target: 'go', goTags: GO_TAGS.all }
    );
  }

  if (isLanguageEnabled('typescript')) {
    choices.push(
      { label: 'Convert to TypeScript', target: 'typescript' },
      { label: 'Convert to TypeScript (Zod)', target: 'typescript-zod' },
      { label: 'Convert to TypeScript (Prisma)', target: 'typescript-prisma' },
      { label: 'Convert to TypeScript (Drizzle ORM)', target: 'typescript-drizzle' }
    );
  }

  if (isLanguageEnabled('rust')) {
    choices.push({ label: 'Convert to Rust (serde)', target: 'rust' });
  }

  if (isLanguageEnabled('python')) {
    choices.push(
      { label: 'Convert to Python (Pydantic)', target: 'python-pydantic' },
      { label: 'Convert to Python (dataclass)', target: 'python-dataclass' },
      { label: 'Convert to Python (TypedDict)', target: 'python-typeddict' }
    );
  }

  return choices;
}

function convertJsonValue(parsed: JsonValue, choice: ConvertChoice): { content: string; language: string } {
  if (choice.target === 'go') {
    const baseGo = jsonToGo(parsed, 'Root', false);
    const finalGo = choice.goTags && choice.goTags.length > 0 ? applyStructTags(baseGo, choice.goTags).content : baseGo;
    return { content: finalGo, language: 'go' };
  }

  if (choice.target === 'typescript') {
    return { content: jsonToTypeScript(parsed, 'Root'), language: 'typescript' };
  }

  if (choice.target === 'typescript-zod') {
    return { content: jsonToTypeScriptZod(parsed, 'Root'), language: 'typescript' };
  }

  if (choice.target === 'typescript-prisma') {
    return { content: jsonToPrisma(parsed, 'Root'), language: 'prisma' };
  }

  if (choice.target === 'typescript-drizzle') {
    return { content: jsonToDrizzle(parsed, 'Root'), language: 'typescript' };
  }

  if (choice.target === 'rust') {
    return { content: jsonToRust(parsed, 'Root'), language: 'rust' };
  }

  if (choice.target === 'python-pydantic') {
    return { content: jsonToPythonPydantic(parsed, 'Root'), language: 'python' };
  }

  if (choice.target === 'python-dataclass') {
    return { content: jsonToPythonDataclass(parsed, 'Root'), language: 'python' };
  }

  return { content: jsonToPythonTypedDict(parsed, 'Root'), language: 'python' };
}

async function maybeSetEditorLanguage(editor: vscode.TextEditor, language: string): Promise<void> {
  const doc = editor.document;
  if (!doc.isUntitled) {
    return;
  }

  if (doc.languageId !== 'plaintext' && doc.languageId !== 'json' && doc.languageId !== 'jsonc') {
    return;
  }

  try {
    await vscode.languages.setTextDocumentLanguage(doc, language);
  } catch {
    // Ignore language set failures.
  }
}

async function pasteIntoActiveEditorOrOpen(content: string, language: string): Promise<void> {
  const editor = getActiveEditor();
  if (!editor) {
    const document = await vscode.workspace.openTextDocument({ content, language });
    await vscode.window.showTextDocument(document, vscode.ViewColumn.Active, false);
    return;
  }

  await maybeSetEditorLanguage(editor, language);
  await editor.edit((builder) => {
    if (!editor.selection.isEmpty) {
      builder.replace(editor.selection, content);
      return;
    }

    builder.insert(editor.selection.active, content);
  });
}

async function runConvertMenu(): Promise<void> {
  if (!isLanguageEnabled('json')) {
    void vscode.window.showInformationMessage('JSON features are disabled in I\'m Too Lazy settings.');
    return;
  }

  const editor = getActiveEditor();
  if (!editor) {
    void vscode.window.showErrorMessage('Open a JSON editor first.');
    return;
  }

  try {
    const parsed = parseJsonFromEditorFlexible(editor);
    const choices = getConvertChoices();
    if (choices.length === 0) {
      void vscode.window.showInformationMessage('No conversion targets are enabled. Enable Go, TypeScript, Rust, or Python in settings.');
      return;
    }

    const picked = await vscode.window.showQuickPick(choices, { placeHolder: 'Choose JSON conversion' });
    if (!picked) {
      return;
    }

    const converted = convertJsonValue(parsed, picked);
    await openVirtualDocument(converted.content, converted.language);
  } catch (error) {
    void vscode.window.showErrorMessage(`Invalid JSON: ${(error as Error).message}`);
  }
}

async function runPasteToMenu(): Promise<void> {
  if (!isLanguageEnabled('json')) {
    void vscode.window.showInformationMessage('JSON features are disabled in I\'m Too Lazy settings.');
    return;
  }

  const choices = getConvertChoices();
  if (choices.length === 0) {
    void vscode.window.showInformationMessage('No conversion targets are enabled. Enable Go, TypeScript, Rust, or Python in settings.');
    return;
  }

  const raw = (await vscode.env.clipboard.readText()).trim();
  if (!raw) {
    void vscode.window.showErrorMessage('Clipboard is empty.');
    return;
  }

  try {
    const parsed = normalizeJsonInput(raw);
    const picked = await vscode.window.showQuickPick(choices, { placeHolder: 'Paste JSON as...' });
    if (!picked) {
      return;
    }

    const converted = convertJsonValue(parsed, picked);
    await pasteIntoActiveEditorOrOpen(converted.content, converted.language);
  } catch (error) {
    void vscode.window.showErrorMessage(`Clipboard is not valid JSON: ${(error as Error).message}`);
  }
}

// Register JSON conversion and clipboard paste commands.
export function registerJsonCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.jsonConvertMenu, async () => {
      await runConvertMenu();
    }),
    vscode.commands.registerCommand(COMMANDS.pasteToMenu, async () => {
      await runPasteToMenu();
    }),
    vscode.commands.registerCommand(COMMANDS.jsonToGo, async () => {
      if (!isLanguageEnabled('json') || !isLanguageEnabled('go')) {
        void vscode.window.showInformationMessage('JSON or Go features are disabled in settings.');
        return;
      }

      const editor = getActiveEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a JSON editor first.');
        return;
      }

      try {
        const parsed = parseJsonFromEditorFlexible(editor);
        const converted = convertJsonValue(parsed, { label: 'Convert to Go (json+bson)', target: 'go', goTags: GO_TAGS.jsonBson });
        await openVirtualDocument(converted.content, converted.language);
      } catch (error) {
        void vscode.window.showErrorMessage(`Invalid JSON: ${(error as Error).message}`);
      }
    }),
    vscode.commands.registerCommand(COMMANDS.jsonToTypeScript, async () => {
      if (!isLanguageEnabled('json') || !isLanguageEnabled('typescript')) {
        void vscode.window.showInformationMessage('JSON or TypeScript features are disabled in settings.');
        return;
      }

      const editor = getActiveEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a JSON editor first.');
        return;
      }

      try {
        const parsed = parseJsonFromEditorFlexible(editor);
        const converted = convertJsonValue(parsed, { label: 'Convert to TypeScript', target: 'typescript' });
        await openVirtualDocument(converted.content, converted.language);
      } catch (error) {
        void vscode.window.showErrorMessage(`Invalid JSON: ${(error as Error).message}`);
      }
    }),
    vscode.commands.registerCommand(COMMANDS.jsonToTypeScriptZod, async () => {
      if (!isLanguageEnabled('json') || !isLanguageEnabled('typescript')) {
        void vscode.window.showInformationMessage('JSON or TypeScript features are disabled in settings.');
        return;
      }

      const editor = getActiveEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a JSON editor first.');
        return;
      }

      try {
        const parsed = parseJsonFromEditorFlexible(editor);
        const converted = convertJsonValue(parsed, { label: 'Convert to TypeScript (Zod)', target: 'typescript-zod' });
        await openVirtualDocument(converted.content, converted.language);
      } catch (error) {
        void vscode.window.showErrorMessage(`Invalid JSON: ${(error as Error).message}`);
      }
    }),
    vscode.commands.registerCommand(COMMANDS.jsonToRust, async () => {
      if (!isLanguageEnabled('json') || !isLanguageEnabled('rust')) {
        void vscode.window.showInformationMessage('JSON or Rust features are disabled in settings.');
        return;
      }

      const editor = getActiveEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a JSON editor first.');
        return;
      }

      try {
        const parsed = parseJsonFromEditorFlexible(editor);
        const converted = convertJsonValue(parsed, { label: 'Convert to Rust (serde)', target: 'rust' });
        await openVirtualDocument(converted.content, converted.language);
      } catch (error) {
        void vscode.window.showErrorMessage(`Invalid JSON: ${(error as Error).message}`);
      }
    }),
    vscode.commands.registerCommand(COMMANDS.jsonToPythonPydantic, async () => {
      if (!isLanguageEnabled('json') || !isLanguageEnabled('python')) {
        void vscode.window.showInformationMessage('JSON or Python features are disabled in settings.');
        return;
      }

      const editor = getActiveEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a JSON editor first.');
        return;
      }

      try {
        const parsed = parseJsonFromEditorFlexible(editor);
        const converted = convertJsonValue(parsed, { label: 'Convert to Python (Pydantic)', target: 'python-pydantic' });
        await openVirtualDocument(converted.content, converted.language);
      } catch (error) {
        void vscode.window.showErrorMessage(`Invalid JSON: ${(error as Error).message}`);
      }
    }),
    vscode.commands.registerCommand(COMMANDS.jsonToPythonDataclass, async () => {
      if (!isLanguageEnabled('json') || !isLanguageEnabled('python')) {
        void vscode.window.showInformationMessage('JSON or Python features are disabled in settings.');
        return;
      }

      const editor = getActiveEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a JSON editor first.');
        return;
      }

      try {
        const parsed = parseJsonFromEditorFlexible(editor);
        const converted = convertJsonValue(parsed, { label: 'Convert to Python (dataclass)', target: 'python-dataclass' });
        await openVirtualDocument(converted.content, converted.language);
      } catch (error) {
        void vscode.window.showErrorMessage(`Invalid JSON: ${(error as Error).message}`);
      }
    }),
    vscode.commands.registerCommand(COMMANDS.jsonToPythonTypedDict, async () => {
      if (!isLanguageEnabled('json') || !isLanguageEnabled('python')) {
        void vscode.window.showInformationMessage('JSON or Python features are disabled in settings.');
        return;
      }

      const editor = getActiveEditor();
      if (!editor) {
        void vscode.window.showErrorMessage('Open a JSON editor first.');
        return;
      }

      try {
        const parsed = parseJsonFromEditorFlexible(editor);
        const converted = convertJsonValue(parsed, { label: 'Convert to Python (TypedDict)', target: 'python-typeddict' });
        await openVirtualDocument(converted.content, converted.language);
      } catch (error) {
        void vscode.window.showErrorMessage(`Invalid JSON: ${(error as Error).message}`);
      }
    })
  );
}
