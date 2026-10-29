import { NOTE_TAGS_MAX, NOTE_TITLE_MAX } from '@notebook/shared';
import { describe, expect, it } from 'vitest';
import { parseCapture } from './capture';

describe('parseCapture', () => {
  it('first line becomes the title, the rest the content', () => {
    expect(parseCapture('  Lỗi volume trống  \n\nSau khi restart thì mất\nhết\n')).toEqual({
      title: 'Lỗi volume trống',
      content: 'Sau khi restart thì mất\nhết',
      tags: [],
    });
    expect(parseCapture('Một dòng')).toEqual({ title: 'Một dòng', content: '', tags: [] });
    expect(parseCapture('a\r\nb')).toEqual({ title: 'a', content: 'b', tags: [] });
  });

  it('a first line longer than the title limit keeps everything as content', () => {
    const long = 'x'.repeat(NOTE_TITLE_MAX + 1);
    expect(parseCapture(`${long}\ny`)).toEqual({ title: '', content: `${long}\ny`, tags: [] });
    expect(parseCapture('x'.repeat(NOTE_TITLE_MAX)).title).toHaveLength(NOTE_TITLE_MAX);
  });

  it('#tags become tags (normalized, unique) and stay in the text', () => {
    const r = parseCapture('Lỗi volume #Docker #docker\nxem #nhật-ký và #snake_case');
    expect(r.tags).toEqual(['docker', 'nhật-ký', 'snake_case']);
    expect(r.title).toBe('Lỗi volume #Docker #docker');
  });

  it('#1 (issue number), "# Heading" and mid-word # are not tags', () => {
    expect(parseCapture('fix #12 và # Heading và a#b').tags).toEqual([]);
    expect(parseCapture('#đường').tags).toEqual(['đường']);
  });

  it('drops invalid tags and keeps at most the tag limit', () => {
    expect(parseCapture(`#${'a'.repeat(65)} #ok`).tags).toEqual(['ok']);
    const many = Array.from({ length: NOTE_TAGS_MAX + 5 }, (_, i) => `#t${i}`).join(' ');
    expect(parseCapture(many).tags).toHaveLength(NOTE_TAGS_MAX);
  });

  it('NFD text is normalized', () => {
    expect(parseCapture('Tiếng Việt #việt'.normalize('NFD'))).toEqual({
      title: 'Tiếng Việt #việt',
      content: '',
      tags: ['việt'],
    });
  });
});
