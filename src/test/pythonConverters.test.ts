import { describe, expect, it } from 'vitest';
import { jsonToPythonPydantic, jsonToPythonDataclass, jsonToPythonTypedDict, jsonToPythonSchema } from '../converters/jsonToPython';

const sample = {
  note_id: 1,
  note_body: 'hello world',
  tags: ['a', 'b'],
  active: true,
  score: 12.5,
  metadata: { plan: 'pro' }
};

describe('python converters', () => {
  it('builds pydantic model from json object', () => {
    const output = jsonToPythonPydantic(sample, 'CustomerNoteResponse');

    expect(output).toContain('from pydantic import BaseModel');
    expect(output).toContain('class CustomerNoteResponse(BaseModel):');
    expect(output).toContain('note_id: int');
    expect(output).toContain('note_body: str');
    expect(output).toContain('tags: list[str]');
    expect(output).toContain('active: bool');
    expect(output).toContain('score: float');
    expect(output).toContain('class CustomerNoteResponseMetadata(BaseModel):');
    expect(output).toContain('plan: str');
  });

  it('builds dataclass model from json object', () => {
    const output = jsonToPythonDataclass(sample, 'CustomerNoteResponse');

    expect(output).toContain('from dataclasses import dataclass');
    expect(output).toContain('@dataclass');
    expect(output).toContain('class CustomerNoteResponse:');
    expect(output).toContain('note_id: int');
    expect(output).toContain('note_body: str');
  });

  it('builds typeddict model from json object', () => {
    const output = jsonToPythonTypedDict(sample, 'CustomerNoteResponse');

    expect(output).toContain('from typing import TypedDict');
    expect(output).toContain('class CustomerNoteResponse(TypedDict):');
    expect(output).toContain('note_id: int');
    expect(output).toContain('note_body: str');
  });

  it('builds pydantic-style Schema from json object with field comments', () => {
    const output = jsonToPythonSchema(
      sample,
      'CustomerNoteResponse',
      {
        note_id: 'Primary key',
        note_body: 'Internal note body'
      }
    );

    expect(output).toContain('from pydantic import Schema');
    expect(output).toContain('class CustomerNoteResponse(Schema):');
    expect(output).toContain('note_id: int  # Primary key');
    expect(output).toContain('note_body: str  # Internal note body');
    expect(output).toContain('tags: list[str]');
    expect(output).toContain('active: bool');
    expect(output).toContain('score: float');
    expect(output).toContain('class CustomerNoteResponseMetadata(Schema):');
    expect(output).toContain('plan: str');
    expect(output).toContain('metadata: CustomerNoteResponseMetadata');
  });

  it('handles optional fields in schema', () => {
    const output = jsonToPythonSchema({ name: 'x', nick: null }, 'Customer');

    expect(output).toContain('from pydantic import Schema');
    expect(output).toContain('class Customer(Schema):');
    expect(output).toContain('name: str');
    expect(output).toContain('nick: Any | None = None');
  });

  it('unwraps selected array field fragments for schema', () => {
    const fragment = {
      addresses: [
        { type: 'home', city: 'Istanbul', zip: '34000' },
        { type: 'office', city: 'Ankara', zip: '06000' }
      ]
    };

    const output = jsonToPythonSchema(fragment, 'Root');

    expect(output).toContain('class RootAddressesItem(Schema):');
    expect(output).toContain('type: str');
    expect(output).toContain('city: str');
    expect(output).toContain('zip: str');
    expect(output).toContain('addresses: list[RootAddressesItem]');
  });
});