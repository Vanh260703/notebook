import { describe, expect, it } from 'vitest';
import {
  foldVi,
  isMacPlatform,
  isTypingTarget,
  matchCommand,
  moveActive,
  shortcutLabel,
} from './command';

describe('foldVi', () => {
  it('removes diacritics, đ → d, lowercases', () => {
    expect(foldVi('Hôm nay')).toBe('hom nay');
    expect(foldVi('Đổi giao diện')).toBe('doi giao dien');
    expect(foldVi('Thùng rác'.normalize('NFD'))).toBe('thung rac');
  });
});

describe('matchCommand', () => {
  it('matches word prefixes without diacritics, all words required', () => {
    expect(matchCommand(['Hôm nay'], 'hom')).toBe(true);
    expect(matchCommand(['Hôm nay'], 'hôm n')).toBe(true);
    expect(matchCommand(['Thùng rác'], 'rac')).toBe(true);
    expect(matchCommand(['Thùng rác'], 'ac')).toBe(false);
    expect(matchCommand(['Note mới', 'tạo', 'new'], 'new')).toBe(true);
    expect(matchCommand(['Inbox'], 'inbox x')).toBe(false);
    expect(matchCommand(['Inbox'], '   ')).toBe(true);
  });
});

describe('moveActive', () => {
  it('wraps around and starts from the first/last item', () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
    expect(moveActive(1, 1, 3)).toBe(2);
    expect(moveActive(0, 1, 0)).toBe(-1);
  });
});

describe('shortcut helpers', () => {
  it('labels and platform', () => {
    expect(shortcutLabel('K', true)).toBe('⌘K');
    expect(shortcutLabel('K', false)).toBe('Ctrl K');
    expect(isMacPlatform('MacIntel')).toBe(true);
    expect(isMacPlatform('iPhone')).toBe(true);
    expect(isMacPlatform('Linux x86_64')).toBe(false);
  });

  it('isTypingTarget', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTypingTarget({ tagName: 'input', type: 'search' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
