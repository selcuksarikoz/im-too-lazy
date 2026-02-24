import { JsonValue, safeTypeName } from './shared';

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface ZodSchema {
  name: string;
  body: string[];
}

// Convert JSON to zod schema definitions.
export function jsonToTypeScriptZod(value: JsonValue, rootName = 'Root'): string {
  const schemas: ZodSchema[] = [];
  const visited = new Map<string, string>();

  function infer(node: JsonValue, nameHint: string): string {
    if (node === null) {
      return 'z.null()';
    }

    if (Array.isArray(node)) {
      if (node.length === 0) {
        return 'z.array(z.unknown())';
      }

      const itemTypes = [...new Set(node.map((item) => infer(item, `${nameHint}Item`)))];
      if (itemTypes.length === 1) {
        return `z.array(${itemTypes[0]})`;
      }

      return `z.array(z.union([${itemTypes.join(', ')}]))`;
    }

    if (isObject(node)) {
      const signature = JSON.stringify(Object.keys(node).sort());
      const cached = visited.get(signature);
      if (cached) {
        return `${cached}Schema`;
      }

      const schemaName = safeTypeName(nameHint, 'Type');
      visited.set(signature, schemaName);

      const fields = Object.entries(node).map(([key, child]) => {
        const childExpr = infer(child, `${schemaName}${safeTypeName(key, 'Field')}`);
        const optionalExpr = child === null ? `${childExpr}.optional()` : childExpr;
        return `  ${JSON.stringify(key)}: ${optionalExpr},`;
      });

      schemas.push({ name: schemaName, body: fields });
      return `${schemaName}Schema`;
    }

    if (typeof node === 'string') {
      return 'z.string()';
    }

    if (typeof node === 'number') {
      return 'z.number()';
    }

    return 'z.boolean()';
  }

  const rootExpr = infer(value, rootName);
  const rootSchemaName = `${safeTypeName(rootName, 'Root')}Schema`;

  const declarations = schemas.map((item) => `export const ${item.name}Schema = z.object({\n${item.body.join('\n')}\n});`);
  if (rootExpr !== rootSchemaName) {
    declarations.push(`export const ${rootSchemaName} = ${rootExpr};`);
  }
  declarations.push(`export type ${safeTypeName(rootName, 'Root')} = z.infer<typeof ${rootSchemaName}>;`);

  return `import { z } from 'zod';\n\n${declarations.join('\n\n')}`;
}
