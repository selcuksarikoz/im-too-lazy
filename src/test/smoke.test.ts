import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadPackageJson(): any {
  const raw = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
  return JSON.parse(raw);
}

describe('extension manifest', () => {
  it('registers core quick commands', () => {
    const pkg = loadPackageJson();
    const commands = pkg.contributes?.commands?.map((c: { command: string }) => c.command) ?? [];

    expect(commands).toContain('im-too-lazy.quickActionsMenu');
    expect(commands).toContain('im-too-lazy.pasteToMenu');
    expect(commands).toContain('im-too-lazy.jsonConvertMenu');
    expect(commands).toContain('im-too-lazy.jsonToRust');
    expect(commands).toContain('im-too-lazy.goTagMenuAll');
    expect(commands).toContain('im-too-lazy.pythonPropsMenuAll');
    expect(commands).toContain('im-too-lazy.pythonPropsMenuClass');
  });

  it('does not register editor title topbar action', () => {
    const pkg = loadPackageJson();
    const titleMenu = pkg.contributes?.menus?.['editor/title'] ?? [];

    expect(titleMenu.length).toBe(0);
  });

  it('exposes explorer submenu and palette commands', () => {
    const pkg = loadPackageJson();
    const explorer = pkg.contributes?.menus?.['explorer/context'] ?? [];
    const paletteItems = pkg.contributes?.menus?.commandPalette ?? [];
    const palette = paletteItems.map((c: { command: string }) => c.command);
    const pasteToWhen = paletteItems.find((c: { command: string; when?: string }) => c.command === 'im-too-lazy.pasteToMenu')?.when ?? '';

    expect(explorer.some((item: { submenu?: string }) => item.submenu === 'im-too-lazy.explorerMenu')).toBe(true);
    expect(palette).toContain('im-too-lazy.createEditorConfig');
    expect(palette).toContain('im-too-lazy.createPrettierConfig');
    expect(palette).toContain('im-too-lazy.setupPythonWithUv');
    expect(palette).toContain('im-too-lazy.pasteToMenu');
    expect(palette).toContain('im-too-lazy.pythonPropsMenuClass');
    expect(pasteToWhen).toContain('config.imTooLazy.languages.json');

    expect(palette).not.toContain('im-too-lazy.jsonToGo');
    expect(palette).not.toContain('im-too-lazy.jsonToTypeScript');
    expect(palette).not.toContain('im-too-lazy.jsonToRust');
    expect(palette).not.toContain('im-too-lazy.goTagAllAll');
  });

  it('uses svg icon for command icons and png for marketplace icon', () => {
    const pkg = loadPackageJson();
    const commands = pkg.contributes?.commands ?? [];

    expect(pkg.icon).toBe('icons/icon.png');
    expect(commands.every((c: { icon?: { light?: string; dark?: string } }) => c.icon?.light === 'icons/icon.svg' && c.icon?.dark === 'icons/icon.svg')).toBe(true);
  });

  it('defines language toggle settings', () => {
    const pkg = loadPackageJson();
    const properties = pkg.contributes?.configuration?.properties ?? {};

    expect(properties['imTooLazy.languages.json']?.default).toBe(true);
    expect(properties['imTooLazy.languages.go']?.default).toBe(true);
    expect(properties['imTooLazy.languages.python']?.default).toBe(true);
    expect(properties['imTooLazy.languages.typescript']?.default).toBe(true);
    expect(properties['imTooLazy.languages.rust']?.default).toBe(true);
  });

  it('keeps python context menu consistent', () => {
    const pkg = loadPackageJson();
    const editorContext = pkg.contributes?.menus?.['editor/context'] ?? [];
    const commands = editorContext.map((item: { command: string }) => item.command);

    expect(commands).toContain('im-too-lazy.pythonPropsMenuCurrent');
    expect(commands).toContain('im-too-lazy.pythonPropsMenuClass');
  });
});
