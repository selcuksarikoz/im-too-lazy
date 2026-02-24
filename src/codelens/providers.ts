import * as vscode from 'vscode';
import { COMMANDS } from '../constants';
import { findStructBlocks } from '../go/tagger';
import { findPythonClassBlocks, findPythonPropertyCandidates } from '../python/accessors';
import { hasAnyEnabledLanguage, isDocumentLanguageEnabled, isLanguageEnabled } from '../settings/languages';

class UniversalConvertCodeLensProvider implements vscode.CodeLensProvider {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changeEmitter.event;

  refresh(): void {
    this.changeEmitter.fire();
  }

  constructor() {
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor.document.languageId === 'json' || event.textEditor.document.languageId === 'jsonc') {
        this.changeEmitter.fire();
      }
    });
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (document.lineCount === 0) {
      return [];
    }

    const isUntitled = document.uri.scheme === 'untitled';
    const showForDocument = isUntitled ? hasAnyEnabledLanguage() : isDocumentLanguageEnabled(document.languageId);
    if (!showForDocument) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: 'Convert to',
        command: COMMANDS.quickActionsMenu
      })
    ];

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.toString() === document.uri.toString()) {
      const isJson = document.languageId === 'json' || document.languageId === 'jsonc';
      if (isJson && isLanguageEnabled('json') && !activeEditor.selection.isEmpty) {
        const line = activeEditor.selection.start.line;
        lenses.push(
          new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
            title: 'Convert to',
            command: COMMANDS.jsonConvertMenu
          })
        );
      }
    }

    return lenses;
  }
}

class PythonPropertyCodeLensProvider implements vscode.CodeLensProvider {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changeEmitter.event;

  refresh(): void {
    this.changeEmitter.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (document.languageId !== 'python' || !isLanguageEnabled('python')) {
      return [];
    }

    const text = document.getText();
    const lenses: vscode.CodeLens[] = [];
    const classes = findPythonClassBlocks(text);
    const propertyCandidates = findPythonPropertyCandidates(text);

    classes.forEach((item) => {
      lenses.push(
        new vscode.CodeLens(new vscode.Range(item.startLine, 0, item.startLine, 0), {
          title: 'Add properties',
          command: COMMANDS.pythonPropsMenuClass,
          arguments: [item.startLine]
        })
      );
    });

    propertyCandidates.forEach((item) => {
      lenses.push(
        new vscode.CodeLens(new vscode.Range(item.line, 0, item.line, 0), {
          title: 'Add property',
          command: COMMANDS.pythonPropsMenuCurrent,
          arguments: [item.line]
        })
      );
    });

    return lenses;
  }
}

class GoStructCodeLensProvider implements vscode.CodeLensProvider {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changeEmitter.event;

  refresh(): void {
    this.changeEmitter.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (document.languageId !== 'go' || !isLanguageEnabled('go')) {
      return [];
    }

    const structs = findStructBlocks(document.getText());
    return structs.map((item) => new vscode.CodeLens(new vscode.Range(item.startLine, 0, item.startLine, 0), {
      title: 'Convert struct',
      command: COMMANDS.goTagMenuCurrent,
      arguments: [item.startLine]
    }));
  }
}

// Register a universal CodeLens for all text documents.
export function registerCodeLensProviders(context: vscode.ExtensionContext): void {
  const universalProvider = new UniversalConvertCodeLensProvider();
  const pythonProvider = new PythonPropertyCodeLensProvider();
  const goProvider = new GoStructCodeLensProvider();

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider([{ scheme: 'file' }, { scheme: 'untitled' }], universalProvider),
    vscode.languages.registerCodeLensProvider({ language: 'python' }, pythonProvider),
    vscode.languages.registerCodeLensProvider({ language: 'go' }, goProvider),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('imTooLazy.languages')) {
        return;
      }

      universalProvider.refresh();
      pythonProvider.refresh();
      goProvider.refresh();
    })
  );
}
