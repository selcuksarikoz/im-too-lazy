import { JsonValue, safeTypeName, toPascalCase, toLowerCamelCase } from './shared';

interface GoStruct {
  name: string;
  fields: string[];
}

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Build Go struct definitions from JSON input.
export function jsonToGo(value: JsonValue, rootName = 'Root', includeJsonTags = true): string {
  const structs: GoStruct[] = [];
  const visited = new Map<string, string>();

  function inferGoType(node: JsonValue, nameHint: string): string {
    if (node === null) {
      return 'interface{}';
    }

    if (Array.isArray(node)) {
      if (node.length === 0) {
        return '[]interface{}';
      }

      const itemTypes = [...new Set(node.map((item) => inferGoType(item, `${nameHint}Item`)))];
      return itemTypes.length === 1 ? `[]${itemTypes[0]}` : '[]interface{}';
    }

    if (isObject(node)) {
      const signature = JSON.stringify(Object.keys(node).sort());
      const cached = visited.get(signature);
      if (cached) {
        return cached;
      }

      const structName = safeTypeName(nameHint, 'Type');
      visited.set(signature, structName);

      const fields = Object.entries(node).map(([key, child]) => {
        const fieldName = safeTypeName(toPascalCase(key), 'Field');
        const fieldType = inferGoType(child, `${structName}${safeTypeName(key, 'Field')}`);
        const jsonKey = toLowerCamelCase(key);
        const tag = includeJsonTags ? ` ` + '`json:"' + `${jsonKey}` + '"`' : '';
        return `\t${fieldName} ${fieldType}${tag}`;
      });

      structs.push({ name: structName, fields });
      return structName;
    }

    if (typeof node === 'string') {
      return 'string';
    }

    if (typeof node === 'number') {
      return Number.isInteger(node) ? 'int' : 'float64';
    }

    return 'bool';
  }

  const rootStruct = inferGoType(value, rootName);
  structs.sort((a, b) => a.name.localeCompare(b.name));

  const output = structs.map((item) => `type ${item.name} struct {\n${item.fields.join('\n')}\n}`);
  if (rootStruct !== safeTypeName(rootName, 'Root')) {
    output.push(`type ${safeTypeName(rootName, 'Root')} = ${rootStruct}`);
  }

  return `package model\n\n${output.join('\n\n')}`;
}
