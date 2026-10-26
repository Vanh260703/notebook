import { describe, expect, it } from 'vitest';
import { stripMarkdown } from './markdown';

describe('stripMarkdown', () => {
  it('removes common Markdown syntax', () => {
    const md = '# Tiêu đề\n\n- [x] **đậm** và _nghiêng_\n> trích dẫn\n[link](https://x.y) `code`';
    expect(stripMarkdown(md)).toBe('Tiêu đề đậm và nghiêng trích dẫn link code');
  });

  it('keeps code content but drops fences', () => {
    expect(stripMarkdown('```bash\ndocker ps\n```')).toBe('docker ps');
  });
});
