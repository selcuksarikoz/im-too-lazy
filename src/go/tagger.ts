import { toLowerCamelCase } from '../converters/shared';

export interface StructBlock {
  name: string;
  start: number;
  end: number;
  startLine: number;
  endLine: number;
  bodyStart: number;
  bodyEnd: number;
}

interface ApplyResult {
  content: string;
  changed: boolean;
}

function offsetToLine(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') {
      line += 1;
    }
  }

  return line;
}

// Find `type X struct { ... }` blocks and capture their ranges.
export function findStructBlocks(text: string): StructBlock[] {
  const regex = /type\s+([A-Za-z_]\w*)\s+struct\s*\{/g;
  const blocks: StructBlock[] = [];
  let match: RegExpExecArray | null = regex.exec(text);

  while (match) {
    const name = match[1];
    const openIndex = regex.lastIndex - 1;
    let depth = 1;
    let index = openIndex + 1;

    while (index < text.length && depth > 0) {
      const char = text[index];
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
      }
      index += 1;
    }

    if (depth === 0) {
      const start = match.index;
      const end = index;
      const bodyStart = openIndex + 1;
      const bodyEnd = end - 1;
      blocks.push({
        name,
        start,
        end,
        startLine: offsetToLine(text, start),
        endLine: offsetToLine(text, end),
        bodyStart,
        bodyEnd
      });
    }

    match = regex.exec(text);
  }

  return blocks;
}

function parseTagLiteral(rawTag?: string): Map<string, string> {
  const tags = new Map<string, string>();
  if (!rawTag) {
    return tags;
  }

  const regex = /(\w+):"((?:\\.|[^"])*)"/g;
  let match: RegExpExecArray | null = regex.exec(rawTag);
  while (match) {
    tags.set(match[1], match[2]);
    match = regex.exec(rawTag);
  }

  return tags;
}

function buildTagLiteral(tags: Map<string, string>): string {
  return [...tags.entries()].map(([key, value]) => `${key}:"${value}"`).join(' ');
}

function shouldTagField(fieldName: string): boolean {
  return /^[A-Z]/.test(fieldName);
}

function toSnakeCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function isOptionalLike(fieldTypeRaw: string): boolean {
  const fieldType = fieldTypeRaw.trim();
  return fieldType.startsWith('*') || fieldType.startsWith('[]') || fieldType.startsWith('map[') || fieldType === 'interface{}' || fieldType === 'any';
}

function inferGormType(fieldTypeRaw: string): string {
  const fieldType = fieldTypeRaw.trim().replace(/\s+/g, ' ');

  if (fieldType.startsWith('[]') || fieldType.startsWith('map[')) {
    return 'jsonb';
  }

  const base = fieldType.replace(/^\*+/, '');
  switch (base) {
    case 'string':
      return 'varchar(255)';
    case 'int':
    case 'int8':
    case 'int16':
    case 'int32':
    case 'uint':
    case 'uint8':
    case 'uint16':
    case 'uint32':
      return 'integer';
    case 'int64':
    case 'uint64':
      return 'bigint';
    case 'bool':
      return 'boolean';
    case 'float32':
      return 'real';
    case 'float64':
      return 'double precision';
    case 'time.Time':
      return 'timestamp';
    case 'uuid.UUID':
      return 'uuid';
    case 'json.RawMessage':
    case 'datatypes.JSON':
      return 'jsonb';
    default:
      return 'text';
  }
}

function mergeCsvTag(existing: string | undefined, token: string): string {
  const parts = new Set((existing ?? '').split(',').map((item) => item.trim()).filter(Boolean));
  parts.add(token);
  return [...parts].join(',');
}

function inferValidateSmartValue(fieldName: string, fieldType: string, existing?: string): string {
  const optional = isOptionalLike(fieldType);
  const base = optional ? mergeCsvTag(existing, 'omitempty') : mergeCsvTag(existing, 'required');

  if (/email/i.test(fieldName)) {
    return mergeCsvTag(base, 'email');
  }

  return base;
}

function buildJsonTag(existing: string | undefined, fieldName: string, withOmitEmpty: boolean): string {
  const defaultName = toLowerCamelCase(fieldName);
  const parts = (existing ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const name = parts[0] && parts[0] !== '-' ? parts[0] : defaultName;
  const opts = new Set(parts.slice(1));
  if (withOmitEmpty) {
    opts.add('omitempty');
  }

  const optPart = [...opts].join(',');
  return optPart ? `${name},${optPart}` : name;
}

function buildGormTag(existing: string | undefined, fieldName: string, fieldType: string): string {
  const parts = new Map<string, string>();
  if (existing) {
    existing.split(';').forEach((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) {
        return;
      }

      const [key, ...rest] = trimmed.split(':');
      if (rest.length === 0) {
        parts.set(key, '');
        return;
      }

      parts.set(key, rest.join(':'));
    });
  }

  if (!parts.has('column')) {
    parts.set('column', toSnakeCase(fieldName));
  }
  if (!parts.has('type')) {
    parts.set('type', inferGormType(fieldType));
  }

  return [...parts.entries()].map(([key, value]) => (value ? `${key}:${value}` : key)).join(';');
}

function resolveTagEntry(tagKey: string, fieldName: string, fieldType: string, existing?: string): { key: string; value: string } {
  if (tagKey === 'json_omitempty_required') {
    return { key: 'json', value: buildJsonTag(existing, fieldName, true) };
  }

  if (tagKey === 'gorm') {
    return { key: 'gorm', value: buildGormTag(existing, fieldName, fieldType) };
  }

  if (tagKey === 'xorm') {
    return { key: 'xorm', value: toSnakeCase(fieldName) };
  }

  if (tagKey === 'db') {
    return { key: 'db', value: toSnakeCase(fieldName) };
  }

  if (tagKey === 'validate_required') {
    return { key: 'validate', value: mergeCsvTag(existing, 'required') };
  }

  if (tagKey === 'validate_smart') {
    return { key: 'validate', value: inferValidateSmartValue(fieldName, fieldType, existing) };
  }

  if (tagKey === 'binding_required') {
    return { key: 'binding', value: mergeCsvTag(existing, 'required') };
  }

  if (tagKey === 'json') {
    return { key: 'json', value: buildJsonTag(existing, fieldName, false) };
  }

  return { key: tagKey, value: toLowerCamelCase(fieldName) };
}

function applyTagsToLine(line: string, tagKeys: readonly string[]): { next: string; changed: boolean } {
  const match = line.match(/^(\s*)([A-Za-z_]\w*)(\s+[^`\n\/]+?)(?:\s+`([^`]*)`)?(\s*\/\/.*)?$/);
  if (!match) {
    return { next: line, changed: false };
  }

  const [, indent, fieldName, fieldType, existingTag, comment = ''] = match;
  if (!shouldTagField(fieldName)) {
    return { next: line, changed: false };
  }

  const tags = parseTagLiteral(existingTag);
  tagKeys.forEach((tagKey) => {
    const existingKey = tagKey === 'validate_required' || tagKey === 'validate_smart'
      ? 'validate'
      : tagKey === 'binding_required'
        ? 'binding'
        : tagKey === 'json_omitempty_required'
          ? 'json'
          : tagKey;
    const resolved = resolveTagEntry(tagKey, fieldName, fieldType, tags.get(existingKey));
    tags.set(resolved.key, resolved.value);
    if (tagKey === 'json_omitempty_required') {
      tags.set('validate', mergeCsvTag(tags.get('validate'), 'required'));
    }
  });

  const next = `${indent}${fieldName}${fieldType} \`${buildTagLiteral(tags)}\`${comment}`;
  return { next, changed: next !== line };
}

// Apply selected struct tags for one struct block.
function applyTagsToStruct(bodyText: string, tagKeys: readonly string[]): ApplyResult {
  const lines = bodyText.split('\n');
  let changed = false;
  const nextLines = lines.map((line) => {
    const next = applyTagsToLine(line, tagKeys);
    changed = changed || next.changed;
    return next.next;
  });

  return { content: nextLines.join('\n'), changed };
}

// Apply struct tags to the whole document or the struct under cursor.
export function applyStructTags(text: string, tagKeys: readonly string[], cursorLine?: number): ApplyResult {
  const blocks = findStructBlocks(text);
  const targets = cursorLine === undefined
    ? blocks
    : blocks.filter((block) => block.startLine <= cursorLine && block.endLine >= cursorLine);

  if (targets.length === 0) {
    return { content: text, changed: false };
  }

  let changed = false;
  let content = text;

  [...targets].sort((a, b) => b.start - a.start).forEach((block) => {
    const body = content.slice(block.bodyStart, block.bodyEnd);
    const updated = applyTagsToStruct(body, tagKeys);
    if (updated.changed) {
      changed = true;
      content = content.slice(0, block.bodyStart) + updated.content + content.slice(block.bodyEnd);
    }
  });

  return { content, changed };
}
