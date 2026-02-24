import * as vscode from 'vscode';

export type SupportedLanguage = 'json' | 'go' | 'python' | 'typescript' | 'rust';

const CONFIG_SECTION = 'imTooLazy';
const LANGUAGE_KEYS: readonly SupportedLanguage[] = ['json', 'go', 'python', 'typescript', 'rust'];

// Read language toggle from extension settings.
export function isLanguageEnabled(language: SupportedLanguage): boolean {
  return vscode.workspace.getConfiguration(CONFIG_SECTION).get<boolean>(`languages.${language}`, true);
}

// Check if at least one supported language is enabled.
export function hasAnyEnabledLanguage(): boolean {
  return LANGUAGE_KEYS.some((item) => isLanguageEnabled(item));
}

// Map VS Code language ids to extension language groups.
export function toSupportedLanguage(languageId: string): SupportedLanguage | undefined {
  if (languageId === 'json' || languageId === 'jsonc') {
    return 'json';
  }

  if (languageId === 'go') {
    return 'go';
  }

  if (languageId === 'python') {
    return 'python';
  }

  if (languageId === 'typescript' || languageId === 'typescriptreact') {
    return 'typescript';
  }

  if (languageId === 'rust') {
    return 'rust';
  }

  return undefined;
}

// Determine if a document language is enabled by settings.
export function isDocumentLanguageEnabled(languageId: string): boolean {
  const mapped = toSupportedLanguage(languageId);
  if (!mapped) {
    return false;
  }

  return isLanguageEnabled(mapped);
}
