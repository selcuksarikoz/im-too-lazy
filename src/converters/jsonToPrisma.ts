import { JsonValue, splitWords } from './shared';

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toModelName(name: string): string {
  const pascal = splitWords(name).map((part) => part[0].toUpperCase() + part.slice(1)).join('');
  return pascal || 'Root';
}

function toFieldName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
  if (!cleaned) {
    return 'field';
  }
  if (/^\d/.test(cleaned)) {
    return `f_${cleaned}`;
  }
  return cleaned;
}

function isDateLike(value: string, key: string): boolean {
  const looksLikeDateKey = /(date|time|at)$/i.test(key);
  const looksLikeIso = /^\d{4}-\d{2}-\d{2}([Tt ][\d:.+-Zz]+)?$/.test(value);
  return looksLikeDateKey || looksLikeIso;
}

function singularize(name: string): string {
  if (/ies$/i.test(name)) {
    return name.replace(/ies$/i, 'y');
  }
  if (/sses$/i.test(name)) {
    return name.replace(/es$/i, '');
  }
  if (/s$/i.test(name) && name.length > 1) {
    return name.replace(/s$/i, '');
  }
  return name;
}

function resolveRootObject(
  value: JsonValue
): { root: { [key: string]: JsonValue } | undefined; note?: string; nameHint?: string } {
  if (isObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 1) {
      const [key, child] = entries[0];
      if (isObject(child)) {
        return { root: child, note: `Generated from selected object field "${key}".`, nameHint: key };
      }
      if (Array.isArray(child)) {
        const first = child.find((item) => isObject(item));
        if (first) {
          return {
            root: first as { [key: string]: JsonValue },
            note: `Generated from first object item in selected array field "${key}".`,
            nameHint: singularize(key)
          };
        }
      }
    }
    return { root: value };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { root: undefined, note: 'Input array is empty; generated fallback model.' };
    }

    const first = value.find((item) => isObject(item));
    if (first) {
      return { root: first as { [key: string]: JsonValue }, note: 'Generated from first object item in input array.' };
    }

    return { root: undefined, note: 'Input array has no object items; generated fallback model.' };
  }

  return { root: undefined, note: 'Input is primitive; generated fallback model.' };
}

// Convert JSON to a basic Prisma model schema.
export function jsonToPrisma(value: JsonValue, rootName = 'Root'): string {
  const { root, note, nameHint } = resolveRootObject(value);
  const modelName = toModelName(nameHint ?? rootName);
  const lines: string[] = [];

  if (!root) {
    lines.push('  id Int @id @default(autoincrement())');
    lines.push('  payload Json?');
  } else {
    const entries = Object.entries(root);
    const hasId = entries.some(([key]) => toFieldName(key) === 'id');

    entries.forEach(([key, raw]) => {
      const field = toFieldName(key);

      if (field === 'id') {
        if (typeof raw === 'string') {
          lines.push('  id String @id @default(cuid())');
          return;
        }
        lines.push('  id Int @id @default(autoincrement())');
        return;
      }

      if (raw === null) {
        lines.push(`  ${field} Json?`);
        return;
      }

      if (typeof raw === 'string') {
        if (isDateLike(raw, key)) {
          lines.push(`  ${field} DateTime`);
          return;
        }
        lines.push(`  ${field} String`);
        return;
      }

      if (typeof raw === 'number') {
        lines.push(`  ${field} ${Number.isInteger(raw) ? 'Int' : 'Float'}`);
        return;
      }

      if (typeof raw === 'boolean') {
        lines.push(`  ${field} Boolean`);
        return;
      }

      lines.push(`  ${field} Json`);
    });

    if (!hasId) {
      lines.unshift('  id Int @id @default(autoincrement())');
    }
  }

  const noteLine = note ? `// ${note}\n` : '';
  return `${noteLine}generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model ${modelName} {
${lines.join('\n')}
}`;
}
