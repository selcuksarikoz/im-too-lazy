# I'm Too Lazy

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/selcuksarikoz.im-too-lazy?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=selcuksarikoz.im-too-lazy)
[![Open VSX](https://img.shields.io/open-vsx/v/selcuksarikoz/im-too-lazy?label=Open%20VSX)](https://open-vsx.org/extension/selcuksarikoz/im-too-lazy)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-support-ffdd00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/funnyturkishdude)

`I'm Too Lazy` is a VS Code productivity extension that turns JSON samples into ready-to-use code and automates repetitive model/tag/property tasks in Go, TypeScript, Rust, and Python.

It is designed for day-to-day backend/frontend workflows where you frequently copy JSON from APIs and need quick model generation, schema conversion, struct tags, or class properties without manual boilerplate.

You can enable or disable supported languages from Settings (`imTooLazy.languages.*`); disabled languages are hidden from menus and CodeLens actions.

## Features

- CodeLens actions inside editor:
  - `Convert to` for all files (`file` + `untitled`)
  - JSON/JSONC selection-aware `Convert to` for selected fragments
  - Go `Convert struct` on each struct
  - Python `Add property` on matching class fields
- JSON `Convert...` supports:
  - Go tags/presets (`json,omitempty + validate:"required"` default, `bson`, `db`, `gorm`, `form`, `xorm`, `yaml`, `toml`, `xml`, `mapstructure`, `query`, `json+bson`, `all`)
  - TypeScript interface/type
  - TypeScript Zod schema
  - TypeScript Prisma model schema
  - TypeScript Drizzle ORM `pgTable` schema
  - Rust structs with `serde` derives
  - Python (Pydantic, dataclass, TypedDict)
  - Smart fragment handling for selected JSON parts (for example selected `"addresses": [...]` converts to `Address` model/table)
- Go `Convert to Tags`:
  - Current struct or all structs
  - `json+bson` or `all` presets
- Python property generation:
  - Current property, current class, or all classes
  - getter+setter, getter only, setter only
- Explorer right-click submenu: `I'm Too Lazy`
  - `.editorconfig`, `.prettierrc`
  - `uv init`, `uv venv`
  - VS Code Python venv setup
- Settings toggles:
  - `imTooLazy.languages.json`
  - `imTooLazy.languages.go`
  - `imTooLazy.languages.python`
  - `imTooLazy.languages.typescript`
  - `imTooLazy.languages.rust`
  - Disabled languages are hidden in menus and do not run commands/CodeLens actions.

## Commands

Primary commands are available from Command Palette (`Cmd/Ctrl+P` + `>`).

- `I'm Too Lazy: Quick Actions`
- `I'm Too Lazy: Convert...`
  - Includes TypeScript + Zod + Prisma + Drizzle outputs
- `I'm Too Lazy: Paste To...`
- `I'm Too Lazy: Convert to Tags (Current Struct)...`
- `I'm Too Lazy: Convert to Tags (All Structs)...`
- `I'm Too Lazy: Add Property (Current Property)...`
- `I'm Too Lazy: Add Properties (Current Class)...`
- `I'm Too Lazy: Add Properties (All Classes)...`
- `I'm Too Lazy: Create .editorconfig`
- `I'm Too Lazy: Create .prettierrc`
- `I'm Too Lazy: Create .editorconfig + .prettierrc`
- `I'm Too Lazy: UV Init Python Project`
- `I'm Too Lazy: Configure VS Code Python Venv`
- `I'm Too Lazy: UV Init + Configure Python Venv`

## Packaging

```bash
npm run release
```

This builds and produces a `.vsix` package.

## Support

If this project helps you, you can support it here:

- https://buymeacoffee.com/funnyturkishdude
