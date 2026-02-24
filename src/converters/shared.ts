export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

// Split identifiers so we can convert names consistently across outputs.
export function splitWords(input: string): string[] {
  return input.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? [input];
}

export function toPascalCase(input: string): string {
  return splitWords(input)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

export function toLowerCamelCase(input: string): string {
  const parts = splitWords(input);
  if (parts.length === 0) {
    return input;
  }

  return [parts[0].toLowerCase(), ...parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())].join('');
}

export function safeTypeName(input: string, fallback: string): string {
  const candidate = toPascalCase(input).replace(/[^A-Za-z0-9]/g, '');
  if (!candidate) {
    return fallback;
  }

  if (/^\d/.test(candidate)) {
    return `${fallback}${candidate}`;
  }

  return candidate;
}

export function normalizeJsonInput(raw: string): JsonValue {
  return JSON.parse(raw) as JsonValue;
}
