export interface PythonClassBlock {
  name: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  indent: string;
}

interface ApplyResult {
  content: string;
  changed: boolean;
}

export type AccessorMode = 'both' | 'getter' | 'setter';

interface ClassField {
  privateName: string;
  publicName: string;
  typeHint: string;
  lines: number[];
  preferredLine: number;
}

export interface PythonPropertyCandidate {
  line: number;
  classStartLine: number;
}

function indentWidth(line: string): number {
  let width = 0;
  for (const ch of line) {
    if (ch === ' ') {
      width += 1;
      continue;
    }
    if (ch === '\t') {
      width += 4;
      continue;
    }
    break;
  }
  return width;
}

function lineOffsets(text: string): number[] {
  const lines = text.split('\n');
  const offsets: number[] = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    offsets.push(offset);
    offset += lines[i].length + 1;
  }
  return offsets;
}

// Find Python class blocks using indentation-aware boundaries.
export function findPythonClassBlocks(text: string): PythonClassBlock[] {
  const lines = text.split('\n');
  const offsets = lineOffsets(text);
  const blocks: PythonClassBlock[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const classMatch = line.match(/^(\s*)class\s+([A-Za-z_]\w*)\b.*:\s*(?:#.*)?$/);
    if (!classMatch) {
      continue;
    }

    const classIndent = classMatch[1];
    const classIndentWidth = indentWidth(classIndent);
    let endLine = lines.length - 1;

    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = lines[j];
      if (!candidate.trim()) {
        continue;
      }

      if (indentWidth(candidate) <= classIndentWidth) {
        endLine = j - 1;
        break;
      }
    }

    const startOffset = offsets[i];
    const endOffset = endLine + 1 < offsets.length ? offsets[endLine + 1] : text.length;
    blocks.push({
      name: classMatch[2],
      startLine: i,
      endLine,
      startOffset,
      endOffset,
      indent: classIndent
    });
  }

  return blocks;
}

function collectPrivateFields(classText: string, classIndent: string): ClassField[] {
  const found = new Map<string, ClassField>();
  const lines = classText.split('\n');
  const classIndentSize = indentWidth(classIndent);
  let methodIndent: number | undefined;
  let initIndent: number | undefined;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const currentIndent = indentWidth(line);
    if (typeof methodIndent === 'number' && currentIndent <= methodIndent) {
      methodIndent = undefined;
    }
    if (typeof initIndent === 'number' && currentIndent <= initIndent) {
      initIndent = undefined;
    }

    const methodMatch = line.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(/);
    if (methodMatch && currentIndent > classIndentSize) {
      methodIndent = currentIndent;
      if (methodMatch[1] === '__init__') {
        initIndent = currentIndent;
      }
    }

    const classAttrMatch = line.match(/^\s*(\_[A-Za-z]\w*)\s*:\s*([^=\n#]+)(?:=.*)?$/);
    if (classAttrMatch && currentIndent > classIndentSize && typeof methodIndent !== 'number') {
      const privateName = classAttrMatch[1];
      const publicName = privateName.slice(1);
      const existing = found.get(publicName);
      const linesForField = existing ? [...new Set([...existing.lines, index])] : [index];
      found.set(publicName, {
        privateName,
        publicName,
        typeHint: classAttrMatch[2].trim() || 'object',
        lines: linesForField,
        preferredLine: index
      });
    }

    const selfAssignMatch = line.match(/self\.(\_[A-Za-z]\w*)\s*=/);
    if (selfAssignMatch && typeof initIndent === 'number' && currentIndent > initIndent) {
      const privateName = selfAssignMatch[1];
      const publicName = privateName.slice(1);
      const existing = found.get(publicName);
      const linesForField = existing ? [...new Set([...existing.lines, index])] : [index];
      found.set(publicName, {
        privateName,
        publicName,
        typeHint: existing?.typeHint ?? 'object',
        lines: linesForField,
        preferredLine: existing?.preferredLine ?? index
      });
    }
  });

  return [...found.values()].sort((a, b) => a.publicName.localeCompare(b.publicName));
}

// Find property candidate lines for Python CodeLens.
export function findPythonPropertyCandidates(text: string): PythonPropertyCandidate[] {
  const blocks = findPythonClassBlocks(text);
  const out: PythonPropertyCandidate[] = [];
  const dedupe = new Set<string>();

  blocks.forEach((block) => {
    const classText = text.slice(block.startOffset, block.endOffset);
    const fields = collectPrivateFields(classText, block.indent);
    fields.forEach((field) => {
      const line = block.startLine + field.preferredLine;
      const key = `${block.startLine}:${field.publicName}`;
      if (dedupe.has(key)) {
        return;
      }
      dedupe.add(key);
      out.push({ line, classStartLine: block.startLine });
    });
  });

  return out;
}

function hasGetter(classText: string, publicName: string): boolean {
  return new RegExp(`(^|\\n)\\s*def\\s+${publicName}\\s*\\(`).test(classText);
}

function hasSetter(classText: string, publicName: string): boolean {
  return new RegExp(`(^|\\n)\\s*@${publicName}\\.setter`).test(classText);
}

function shouldSkipField(classText: string, publicName: string, mode: AccessorMode): boolean {
  if (mode === 'getter') {
    return hasGetter(classText, publicName);
  }
  if (mode === 'setter') {
    return hasSetter(classText, publicName);
  }
  return hasGetter(classText, publicName) && hasSetter(classText, publicName);
}

function buildAccessor(indent: string, field: ClassField, mode: AccessorMode): string {
  const typeHint = field.typeHint || 'object';
  const getter = [
    `${indent}@property`,
    `${indent}def ${field.publicName}(self) -> ${typeHint}:`,
    `${indent}    return self.${field.privateName}`
  ].join('\n');
  const setter = [
    `${indent}@${field.publicName}.setter`,
    `${indent}def ${field.publicName}(self, value: ${typeHint}) -> None:`,
    `${indent}    self.${field.privateName} = value`
  ].join('\n');

  if (mode === 'getter') {
    return getter;
  }
  if (mode === 'setter') {
    return setter;
  }
  return `${getter}\n\n${setter}`;
}

function applyForClass(
  classText: string,
  classIndent: string,
  mode: AccessorMode,
  scope: 'property' | 'class',
  targetLineInClass?: number
): ApplyResult {
  const fields = collectPrivateFields(classText, classIndent).filter((field) => {
    if (scope === 'property' && typeof targetLineInClass === 'number' && !field.lines.includes(targetLineInClass)) {
      return false;
    }

    return !shouldSkipField(classText, field.publicName, mode);
  });
  if (fields.length === 0) {
    return { content: classText, changed: false };
  }

  const methodIndent = `${classIndent}    `;
  const additions = fields.map((field) => buildAccessor(methodIndent, field, mode)).join('\n\n');
  const trimmed = classText.trimEnd();
  return { content: `${trimmed}\n\n${additions}\n`, changed: true };
}

// Add property getter/setter blocks with property/class/file scopes.
export function applyPythonAccessors(
  text: string,
  mode: AccessorMode = 'both',
  target?: { scope: 'property' | 'class'; line: number } | { scope: 'all' }
): ApplyResult {
  const blocks = findPythonClassBlocks(text);
  const targets = !target || target.scope === 'all'
    ? blocks
    : blocks.filter((b) => b.startLine <= target.line && b.endLine >= target.line);

  if (targets.length === 0) {
    return { content: text, changed: false };
  }

  let content = text;
  let changed = false;

  [...targets].sort((a, b) => b.startOffset - a.startOffset).forEach((block) => {
    const current = content.slice(block.startOffset, block.endOffset);
    const scope = target?.scope === 'property' ? 'property' : 'class';
    const targetLineInClass = target && target.scope !== 'all' ? target.line - block.startLine : undefined;
    const updated = applyForClass(current, block.indent, mode, scope, targetLineInClass);
    if (updated.changed) {
      changed = true;
      content = content.slice(0, block.startOffset) + updated.content + content.slice(block.endOffset);
    }
  });

  return { content, changed };
}
