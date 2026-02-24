import { JsonValue, safeTypeName, splitWords } from './shared';

interface RustStruct {
  name: string;
  fields: string[];
}

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toSnakeCase(input: string): string {
  return splitWords(input).map((part) => part.toLowerCase()).join('_');
}

function safeRustFieldName(input: string): string {
  const raw = toSnakeCase(input).replace(/[^a-z0-9_]/g, '');
  if (!raw) {
    return 'field';
  }

  if (/^\d/.test(raw)) {
    return `field_${raw}`;
  }

  return raw;
}

// Build Rust structs with serde derives from JSON input.
export function jsonToRust(value: JsonValue, rootName = 'Root'): string {
  const structs: RustStruct[] = [];
  const visited = new Map<string, string>();

  function inferRustType(node: JsonValue, nameHint: string): string {
    if (node === null) {
      return 'Option<serde_json::Value>';
    }

    if (Array.isArray(node)) {
      if (node.length === 0) {
        return 'Vec<serde_json::Value>';
      }

      const itemTypes = [...new Set(node.map((item) => inferRustType(item, `${nameHint}Item`)))];
      return itemTypes.length === 1 ? `Vec<${itemTypes[0]}>` : 'Vec<serde_json::Value>';
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
        const childType = inferRustType(child, `${structName}${safeTypeName(key, 'Field')}`);
        const fieldName = safeRustFieldName(key);
        const needsRename = fieldName !== key;
        const renameAttr = needsRename ? `    #[serde(rename = "${key}")]\n` : '';
        return `${renameAttr}    pub ${fieldName}: ${childType},`;
      });

      structs.push({ name: structName, fields });
      return structName;
    }

    if (typeof node === 'string') {
      return 'String';
    }

    if (typeof node === 'number') {
      return Number.isInteger(node) ? 'i64' : 'f64';
    }

    return 'bool';
  }

  const rootStruct = inferRustType(value, rootName);
  structs.sort((a, b) => a.name.localeCompare(b.name));

  const output = structs.map((item) => {
    const fields = item.fields.length > 0 ? item.fields.join('\n') : '    // empty';
    return `#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]\npub struct ${item.name} {\n${fields}\n}`;
  });

  if (rootStruct !== safeTypeName(rootName, 'Root')) {
    output.push(`pub type ${safeTypeName(rootName, 'Root')} = ${rootStruct};`);
  }

  return `use serde::{Deserialize, Serialize};\n\n${output.join('\n\n')}`;
}

