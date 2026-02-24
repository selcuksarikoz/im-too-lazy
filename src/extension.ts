import * as vscode from 'vscode';
import { registerCodeLensProviders } from './codelens/providers';
import { registerConfigCommands } from './commands/configCommands';
import { registerGoCommands } from './commands/goCommands';
import { registerJsonCommands } from './commands/jsonCommands';
import { registerPythonCommands } from './commands/pythonCommands';
import { registerQuickActionsCommands } from './commands/quickActionsCommands';

// Activate extension and register command/provider modules.
export function activate(context: vscode.ExtensionContext): void {
  registerJsonCommands(context);
  registerGoCommands(context);
  registerPythonCommands(context);
  registerQuickActionsCommands(context);
  registerCodeLensProviders(context);
  registerConfigCommands(context);
}

export function deactivate(): void {
  // No persistent resources to dispose.
}
