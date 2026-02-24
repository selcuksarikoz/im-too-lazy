import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { COMMANDS } from '../constants';
import { editorConfigTemplate } from '../templates/editorConfig';
import { prettierConfigTemplate } from '../templates/prettierConfig';

const execAsync = promisify(exec);

async function resolveBaseDir(resource?: vscode.Uri): Promise<string | undefined> {
  if (resource && resource.scheme === 'file') {
    try {
      const stat = await fs.stat(resource.fsPath);
      return stat.isDirectory() ? resource.fsPath : path.dirname(resource.fsPath);
    } catch {
      return path.dirname(resource.fsPath);
    }
  }

  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function writeIfMissing(filePath: string, content: string): Promise<'created' | 'exists'> {
  try {
    await fs.access(filePath);
    return 'exists';
  } catch {
    await fs.writeFile(filePath, content, 'utf8');
    return 'created';
  }
}

async function createFiles(resource: vscode.Uri | undefined, includeEditorConfig: boolean, includePrettier: boolean): Promise<void> {
  const baseDir = await resolveBaseDir(resource);
  if (!baseDir) {
    void vscode.window.showErrorMessage('Open a workspace folder first.');
    return;
  }

  const results: string[] = [];

  if (includeEditorConfig) {
    const state = await writeIfMissing(path.join(baseDir, '.editorconfig'), editorConfigTemplate);
    results.push(`.editorconfig: ${state}`);
  }

  if (includePrettier) {
    const state = await writeIfMissing(path.join(baseDir, '.prettierrc'), prettierConfigTemplate);
    results.push(`.prettierrc: ${state}`);
  }

  void vscode.window.showInformationMessage(results.join(' | '));
}

async function runUvCommand(command: string, cwd: string): Promise<void> {
  await execAsync(command, { cwd });
}

async function configurePythonVenv(resource?: vscode.Uri): Promise<void> {
  const baseDir = await resolveBaseDir(resource);
  if (!baseDir) {
    void vscode.window.showErrorMessage('Open a workspace folder first.');
    return;
  }

  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(baseDir));
  const target = folder ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
  const config = vscode.workspace.getConfiguration('python', folder?.uri);
  const isWindows = os.platform() === 'win32';
  const interpreterPath = isWindows
    ? '${workspaceFolder}\\.venv\\Scripts\\python.exe'
    : '${workspaceFolder}/.venv/bin/python';

  await config.update('defaultInterpreterPath', interpreterPath, target);
  await config.update('terminal.activateEnvironment', true, target);
  await config.update('venvPath', '${workspaceFolder}', target);

  void vscode.window.showInformationMessage('Python VS Code venv settings updated.');
}

async function uvInitProject(resource?: vscode.Uri): Promise<boolean> {
  const baseDir = await resolveBaseDir(resource);
  if (!baseDir) {
    void vscode.window.showErrorMessage('Open a workspace folder first.');
    return false;
  }

  try {
    await runUvCommand('uv init', baseDir);
    await runUvCommand('uv venv', baseDir);
    void vscode.window.showInformationMessage('uv init + uv venv completed.');
    return true;
  } catch (error) {
    void vscode.window.showErrorMessage(`uv command failed: ${(error as Error).message}`);
    return false;
  }
}

async function setupPythonWithUv(resource?: vscode.Uri): Promise<void> {
  const ok = await uvInitProject(resource);
  if (!ok) {
    return;
  }
  await configurePythonVenv(resource);
}

// Register workspace formatting file creation commands.
export function registerConfigCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.createEditorConfig, async (resource?: vscode.Uri) => {
      await createFiles(resource, true, false);
    }),
    vscode.commands.registerCommand(COMMANDS.createPrettierConfig, async (resource?: vscode.Uri) => {
      await createFiles(resource, false, true);
    }),
    vscode.commands.registerCommand(COMMANDS.createFormattingFiles, async (resource?: vscode.Uri) => {
      await createFiles(resource, true, true);
    }),
    vscode.commands.registerCommand(COMMANDS.uvInitPythonProject, async (resource?: vscode.Uri) => {
      await uvInitProject(resource);
    }),
    vscode.commands.registerCommand(COMMANDS.configurePythonVenvSettings, async (resource?: vscode.Uri) => {
      await configurePythonVenv(resource);
    }),
    vscode.commands.registerCommand(COMMANDS.setupPythonWithUv, async (resource?: vscode.Uri) => {
      await setupPythonWithUv(resource);
    })
  );
}
