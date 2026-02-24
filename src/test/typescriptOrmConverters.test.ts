import { describe, expect, it } from 'vitest';
import { jsonToDrizzle } from '../converters/jsonToDrizzle';
import { jsonToPrisma } from '../converters/jsonToPrisma';

describe('typescript orm converters', () => {
  const sample = {
    id: 1,
    name: 'Alice',
    createdAt: '2026-02-24T10:00:00Z',
    active: true,
    score: 12.4,
    metadata: { plan: 'pro' },
    tags: ['a', 'b']
  };

  it('builds prisma model from json object', () => {
    const output = jsonToPrisma(sample, 'UserProfile');

    expect(output).toContain('generator client');
    expect(output).toContain('datasource db');
    expect(output).toContain('model UserProfile');
    expect(output).toContain('id Int @id @default(autoincrement())');
    expect(output).toContain('name String');
    expect(output).toContain('createdAt DateTime');
    expect(output).toContain('active Boolean');
    expect(output).toContain('score Float');
    expect(output).toContain('metadata Json');
  });

  it('builds drizzle pgTable from json object', () => {
    const output = jsonToDrizzle(sample, 'user_profile');

    expect(output).toContain('from "drizzle-orm/pg-core"');
    expect(output).toContain('export const userProfileTable');
    expect(output).toContain('pgTable("user_profile"');
    expect(output).toContain('id: serial("id").primaryKey()');
    expect(output).toContain('name: text("name").notNull()');
    expect(output).toContain('createdAt: timestamp("createdAt", { withTimezone: true }).notNull()');
    expect(output).toContain('active: boolean("active").notNull()');
    expect(output).toContain('score: doublePrecision("score").notNull()');
    expect(output).toContain('metadata: jsonb("metadata").notNull()');
  });

  it('unwraps selected array field fragments for prisma and drizzle', () => {
    const fragment = {
      addresses: [
        { type: 'home', city: 'Istanbul', zip: '34000' },
        { type: 'office', city: 'Ankara', zip: '06000' }
      ]
    };

    const prisma = jsonToPrisma(fragment, 'Root');
    const drizzle = jsonToDrizzle(fragment, 'Root');

    expect(prisma).toContain('model Address');
    expect(prisma).toContain('type String');
    expect(prisma).toContain('city String');
    expect(prisma).toContain('zip String');
    expect(prisma).not.toContain('addresses Json');

    expect(drizzle).toContain('export const addressTable');
    expect(drizzle).toContain('pgTable("address"');
    expect(drizzle).toContain('type: text("type").notNull()');
    expect(drizzle).toContain('city: text("city").notNull()');
    expect(drizzle).toContain('zip: text("zip").notNull()');
    expect(drizzle).not.toContain('addresses: jsonb("addresses")');
  });
});
