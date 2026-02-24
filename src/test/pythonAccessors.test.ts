import { describe, expect, it } from 'vitest';
import { applyPythonAccessors, findPythonClassBlocks, findPythonPropertyCandidates } from '../python/accessors';

const sample = [
  'class User:',
  '    _name: str',
  '',
  '    def __init__(self, name: str, age: int):',
  '        self._name = name',
  '        self._age = age',
  '',
  '    def hydrate(self):',
  '        self._temp = "ignore"',
  '',
  'class Team:',
  '    _title: str',
  ''
].join('\n');

describe('python accessors', () => {
  it('adds accessors for only selected property in property scope', () => {
    const result = applyPythonAccessors(sample, 'both', { scope: 'property', line: 4 });

    expect(result.changed).toBe(true);
    expect(result.content).toContain('def name(self) -> str:');
    expect(result.content).not.toContain('def age(self) ->');
    expect(result.content).not.toContain('def temp(self) ->');
  });

  it('adds accessors for all properties in selected class only', () => {
    const result = applyPythonAccessors(sample, 'both', { scope: 'class', line: 4 });

    expect(result.changed).toBe(true);
    expect(result.content).toContain('def name(self) -> str:');
    expect(result.content).toContain('def age(self) -> object:');
    expect(result.content).not.toContain('def title(self) ->');
  });

  it('adds accessors for all classes in all scope', () => {
    const result = applyPythonAccessors(sample, 'getter', { scope: 'all' });

    expect(result.changed).toBe(true);
    expect(result.content).toContain('def name(self) -> str:');
    expect(result.content).toContain('def age(self) -> object:');
    expect(result.content).toContain('def title(self) -> str:');
  });

  it('finds indentation-aware class blocks', () => {
    const text = [
      'class Outer:',
      '    _a: int',
      '    class Inner:',
      '        _b: int',
      '',
      'class Next:',
      '    _c: int',
      ''
    ].join('\n');

    const blocks = findPythonClassBlocks(text);
    expect(blocks.map((item) => item.name)).toEqual(['Outer', 'Inner', 'Next']);
    expect(blocks[0].endLine).toBe(4);
    expect(blocks[1].endLine).toBe(4);
    expect(blocks[2].startLine).toBe(5);
  });

  it('lists one property candidate per field from class attrs or __init__', () => {
    const candidates = findPythonPropertyCandidates(sample);
    const lines = candidates.map((item) => item.line).sort((a, b) => a - b);

    expect(lines).toContain(1); // _name: str
    expect(lines).toContain(5); // self._age
    expect(lines).toContain(11); // Team _title
    expect(lines).not.toContain(4); // self._name is merged into same field candidate
    expect(lines).not.toContain(8); // self._temp in non-init method
  });
});
