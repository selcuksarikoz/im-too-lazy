import { JsonValue, safeTypeName } from './shared';

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface TsInterface {
  name: string;
  body: string[];
}

// Build TypeScript type/interface definitions from JSON input.
export function jsonToTypeScript(value: JsonValue, rootName = 'Root'): string {
  const interfaces: TsInterface[] = [];
  const visited = new Map<string, string>();

  function inferType(node: JsonValue, nameHint: string): string {
    if (node === null) {
      return 'null';
    }

    if (Array.isArray(node)) {
      if (node.length === 0) {
        return 'unknown[]';
      }

      const itemTypes = [...new Set(node.map((item) => inferType(item, `${nameHint}Item`)))];
      return itemTypes.length === 1 ? `${itemTypes[0]}[]` : `(${itemTypes.join(' | ')})[]`;
    }

    if (isObject(node)) {
      const signature = JSON.stringify(Object.keys(node).sort());
      const cached = visited.get(signature);
      if (cached) {
        return cached;
      }

      const interfaceName = safeTypeName(nameHint, 'Type');
      visited.set(signature, interfaceName);

      const body = Object.entries(node).map(([key, child]) => {
        const childType = inferType(child, `${interfaceName}${safeTypeName(key, 'Field')}`);
        const optional = child === null ? '?' : '';
        return `  ${JSON.stringify(key)}${optional}: ${childType};`;
      });

      interfaces.push({ name: interfaceName, body });
      return interfaceName;
    }

    if (typeof node === 'string') {
      return 'string';
    }

    if (typeof node === 'number') {
      return Number.isInteger(node) ? 'number' : 'number';
    }

    return 'boolean';
  }

  const rootType = inferType(value, rootName);
  interfaces.sort((a, b) => a.name.localeCompare(b.name));

  const declarations = interfaces.map((item) => `export interface ${item.name} {\n${item.body.join('\n')}\n}`);
  declarations.push(`export type ${safeTypeName(rootName, 'Root')}Type = ${rootType};`);

  return declarations.join('\n\n');
}
