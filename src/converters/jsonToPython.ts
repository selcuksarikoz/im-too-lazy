import { JsonValue, safeTypeName } from './shared';

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface PyClass {
  name: string;
  fields: string[];
}

interface BuildState {
  classes: PyClass[];
  visited: Map<string, string>;
  needsOptional: boolean;
  needsAny: boolean;
  needsUnion: boolean;
}

function newState(): BuildState {
  return {
    classes: [],
    visited: new Map<string, string>(),
    needsOptional: false,
    needsAny: false,
    needsUnion: false
  };
}

function inferType(node: JsonValue, nameHint: string, state: BuildState): string {
  if (node === null) {
    state.needsOptional = true;
    state.needsAny = true;
    return 'Optional[Any]';
  }

  if (Array.isArray(node)) {
    if (node.length === 0) {
      state.needsAny = true;
      return 'list[Any]';
    }

    const itemTypes = [...new Set(node.map((item) => inferType(item, `${nameHint}Item`, state)))];
    if (itemTypes.length === 1) {
      return `list[${itemTypes[0]}]`;
    }

    state.needsUnion = true;
    return `list[Union[${itemTypes.join(', ')}]]`;
  }

  if (isObject(node)) {
    const signature = JSON.stringify(Object.keys(node).sort());
    const cached = state.visited.get(signature);
    if (cached) {
      return cached;
    }

    const className = safeTypeName(nameHint, 'Type');
    state.visited.set(signature, className);

    const fields = Object.entries(node).map(([key, child]) => {
      const childType = inferType(child, `${className}${safeTypeName(key, 'Field')}`, state);
      return `${key}: ${childType}`;
    });

    state.classes.push({ name: className, fields });
    return className;
  }

  if (typeof node === 'string') {
    return 'str';
  }

  if (typeof node === 'number') {
    return Number.isInteger(node) ? 'int' : 'float';
  }

  return 'bool';
}

function typingImports(state: BuildState): string {
  const imports: string[] = [];
  if (state.needsAny) {
    imports.push('Any');
  }
  if (state.needsOptional) {
    imports.push('Optional');
  }
  if (state.needsUnion) {
    imports.push('Union');
  }

  return imports.length > 0 ? `from typing import ${imports.join(', ')}\n\n` : '';
}

// Convert JSON to Pydantic BaseModel classes.
export function jsonToPythonPydantic(value: JsonValue, rootName = 'Root'): string {
  const state = newState();
  inferType(value, rootName, state);

  state.classes.sort((a, b) => a.name.localeCompare(b.name));
  const imports = `${typingImports(state)}from pydantic import BaseModel\n\n`;
  const classes = state.classes.map((item) => {
    const fields = item.fields.length > 0 ? item.fields.map((f) => `    ${f}`).join('\n') : '    pass';
    return `class ${item.name}(BaseModel):\n${fields}`;
  });

  return imports + classes.join('\n\n');
}

// Convert JSON to dataclass models.
export function jsonToPythonDataclass(value: JsonValue, rootName = 'Root'): string {
  const state = newState();
  inferType(value, rootName, state);

  state.classes.sort((a, b) => a.name.localeCompare(b.name));
  const imports = `${typingImports(state)}from dataclasses import dataclass\n\n`;
  const classes = state.classes.map((item) => {
    const fields = item.fields.length > 0 ? item.fields.map((f) => `    ${f}`).join('\n') : '    pass';
    return `@dataclass\nclass ${item.name}:\n${fields}`;
  });

  return imports + classes.join('\n\n');
}

// Convert JSON to TypedDict types.
export function jsonToPythonTypedDict(value: JsonValue, rootName = 'Root'): string {
  const state = newState();
  inferType(value, rootName, state);

  state.classes.sort((a, b) => a.name.localeCompare(b.name));
  const imports = `${typingImports(state)}from typing import TypedDict\n\n`;
  const classes = state.classes.map((item) => {
    const fields = item.fields.length > 0 ? item.fields.map((f) => `    ${f}`).join('\n') : '    pass';
    return `class ${item.name}(TypedDict):\n${fields}`;
  });

  return imports + classes.join('\n\n');
}
