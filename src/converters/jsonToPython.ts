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

function typingImports(needsOptional: boolean, needsAny: boolean, needsUnion: boolean): string {
  const imports: string[] = [];
  if (needsAny) {
    imports.push('Any');
  }
  if (needsOptional) {
    imports.push('Optional');
  }
  if (needsUnion) {
    imports.push('Union');
  }

  return imports.length > 0 ? `from typing import ${imports.join(', ')}\n\n` : '';
}

// Convert JSON to Pydantic BaseModel classes.
export function jsonToPythonPydantic(value: JsonValue, rootName = 'Root'): string {
  const state = newState();
  inferType(value, rootName, state);

  state.classes.sort((a, b) => a.name.localeCompare(b.name));
  const imports = `${typingImports(state.needsOptional, state.needsAny, state.needsUnion)}from pydantic import BaseModel\n\n`;
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
  const imports = `${typingImports(state.needsOptional, state.needsAny, state.needsUnion)}from dataclasses import dataclass\n\n`;
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
  const imports = `${typingImports(state.needsOptional, state.needsAny, state.needsUnion)}from typing import TypedDict\n\n`;
  const classes = state.classes.map((item) => {
    const fields = item.fields.length > 0 ? item.fields.map((f) => `    ${f}`).join('\n') : '    pass';
    return `class ${item.name}(TypedDict):\n${fields}`;
  });

  return imports + classes.join('\n\n');
}

interface SchemaField {
  name: string;
  type: string;
  comment?: string;
}

interface SchemaBuildState {
  classes: { name: string; fields: SchemaField[] }[];
  visited: Map<string, string>;
  needsOptional: boolean;
  needsAny: boolean;
  needsUnion: boolean;
}

function newSchemaState(): SchemaBuildState {
  return {
    classes: [],
    visited: new Map<string, string>(),
    needsOptional: false,
    needsAny: false,
    needsUnion: false
  };
}

function inferSchemaType(node: JsonValue, nameHint: string, state: SchemaBuildState): string {
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

    const itemTypes = [...new Set(node.map((item) => inferSchemaType(item, `${nameHint}Item`, state)))];
    if (itemTypes.length === 1) {
      return `list[${itemTypes[0]}]`;
    }

    state.needsUnion = true;
    return `list[Union[${itemTypes.join(', ')}]]`;
  }

  if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
    const signature = JSON.stringify(Object.keys(node).sort());
    const cached = state.visited.get(signature);
    if (cached) {
      return cached;
    }

    const className = safeTypeName(nameHint, 'Type');
    state.visited.set(signature, className);

    const fields = Object.entries(node).map(([key, child]) => {
      const childType = inferSchemaType(child, `${className}${safeTypeName(key, 'Field')}`, state);
      return { name: key, type: childType };
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

function toPydanticField(type: string): string {
  // Handle Optional types by converting to `X | None = None`
  const optionalMatch = type.match(/^Optional\[(.+)\]$/);
  if (optionalMatch) {
    return `${toPydanticField(optionalMatch[1])} | None = None`;
  }

  // Handle Union types
  const unionMatch = type.match(/^Union\[(.+)\]$/);
  if (unionMatch) {
    return unionMatch[1].split(', ').map(toPydanticField).join(' | ');
  }

  // Handle list types
  const listMatch = type.match(/^list\[(.+)\]$/);
  if (listMatch) {
    return `list[${toPydanticField(listMatch[1])}]`;
  }

  // Handle basic types
  if (type === 'str') return 'str';
  if (type === 'int') return 'int';
  if (type === 'float') return 'float';
  if (type === 'bool') return 'bool';
  if (type === 'Any') return 'Any';

  // Custom class name (PascalCase)
  return type;
}

// Convert JSON to Pydantic-style Schema classes with optional field comments.
export function jsonToPythonSchema(
  value: JsonValue,
  rootName = 'Root',
  fieldComments?: Record<string, string>
): string {
  const state = newSchemaState();
  inferSchemaType(value, rootName, state);

  state.classes.sort((a, b) => a.name.localeCompare(b.name));
  const imports = `from pydantic import Schema\n\n`;

  const classes = state.classes.map((item) => {
    const fieldLines = item.fields.length > 0
      ? item.fields.map((f) => {
          const pydanticField = toPydanticField(f.type);
          const comment = fieldComments?.[f.name];
          const line = `    ${f.name}: ${pydanticField}`;
          return comment ? `${line}  # ${comment}` : line;
        }).join('\n')
      : '    pass';
    return `class ${item.name}(Schema):\n${fieldLines}`;
  });

  return imports + classes.join('\n\n');
}
