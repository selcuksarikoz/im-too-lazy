import { JsonValue, splitWords } from './shared';

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toConstName(name: string): string {
  const parts = splitWords(name);
  if (parts.length === 0) {
    return 'rootTable';
  }
  const [first, ...rest] = parts.map((part) => part.toLowerCase());
  return `${first}${rest.map((part) => part[0].toUpperCase() + part.slice(1)).join('')}Table`;
}

function toTableName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_').toLowerCase();
  return cleaned || 'root';
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
      return { root: undefined, note: 'Input array is empty; generated fallback table.' };
    }

    const first = value.find((item) => isObject(item));
    if (first) {
      return { root: first as { [key: string]: JsonValue }, note: 'Generated from first object item in input array.' };
    }

    return { root: undefined, note: 'Input array has no object items; generated fallback table.' };
  }

  return { root: undefined, note: 'Input is primitive; generated fallback table.' };
}

// Convert JSON to a basic Drizzle pgTable schema.
export function jsonToDrizzle(value: JsonValue, rootName = 'Root'): string {
  const { root, note, nameHint } = resolveRootObject(value);
  const resolvedName = nameHint ?? rootName;
  const constName = toConstName(resolvedName);
  const tableName = toTableName(resolvedName);
  const lines: string[] = [];

  if (!root) {
    lines.push(`  id: serial("id").primaryKey(),`);
    lines.push(`  payload: jsonb("payload"),`);
  } else {
    const entries = Object.entries(root);
    const hasId = entries.some(([key]) => toFieldName(key) === 'id');

    entries.forEach(([key, raw]) => {
      const field = toFieldName(key);

      if (field === 'id') {
        if (typeof raw === 'string') {
          lines.push(`  id: varchar("id", { length: 191 }).primaryKey(),`);
          return;
        }
        lines.push(`  id: serial("id").primaryKey(),`);
        return;
      }

      if (raw === null) {
        lines.push(`  ${field}: jsonb("${field}"),`);
        return;
      }

      if (typeof raw === 'string') {
        if (isDateLike(raw, key)) {
          lines.push(`  ${field}: timestamp("${field}", { withTimezone: true }).notNull(),`);
          return;
        }
        lines.push(`  ${field}: text("${field}").notNull(),`);
        return;
      }

      if (typeof raw === 'number') {
        lines.push(`  ${field}: ${Number.isInteger(raw) ? 'integer' : 'doublePrecision'}("${field}").notNull(),`);
        return;
      }

      if (typeof raw === 'boolean') {
        lines.push(`  ${field}: boolean("${field}").notNull(),`);
        return;
      }

      lines.push(`  ${field}: jsonb("${field}").notNull(),`);
    });

    if (!hasId) {
      lines.unshift(`  id: serial("id").primaryKey(),`);
    }
  }

  const noteLine = note ? `// ${note}\n` : '';
  return `${noteLine}import { boolean, doublePrecision, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const ${constName} = pgTable("${tableName}", {
${lines.join('\n')}
});
`;
}
