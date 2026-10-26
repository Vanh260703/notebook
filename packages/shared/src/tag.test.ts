import { describe, expect, it } from 'vitest';
import { tagNameSchema } from './tag';

describe('tagNameSchema', () => {
  it('trims and lowercases', () => {
    expect(tagNameSchema.parse('  Docker  ')).toBe('docker');
  });

  it('normalizes to NFC so composed and decomposed forms are equal', () => {
    const decomposed = 'Tiếng Việt'; // "Tiếng Việt" dạng tổ hợp
    const result = tagNameSchema.parse(decomposed);
    expect(result).toBe('tiếng việt'.normalize('NFC'));
    expect(result).toBe(result.normalize('NFC'));
    expect(result.length).toBe('tiếng việt'.normalize('NFC').length);
  });

  it('rejects empty or whitespace-only names', () => {
    expect(tagNameSchema.safeParse('').success).toBe(false);
    expect(tagNameSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects names longer than 64 characters after trimming', () => {
    expect(tagNameSchema.safeParse(`  ${'a'.repeat(64)}  `).success).toBe(true);
    expect(tagNameSchema.safeParse('a'.repeat(65)).success).toBe(false);
  });
});
