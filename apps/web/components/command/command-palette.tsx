'use client';

import {
  hasHighlight,
  searchTerms,
  stripHighlight,
  type ListNotesQuery,
  type NoteListItem,
} from '@notebook/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  FileText,
  Inbox,
  NotebookText,
  Palette,
  Plus,
  Search,
  Tags,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Highlighted } from '@/components/notes/highlighted';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useGuardedRouter } from '@/components/unsaved-guard';
import { listNotes } from '@/lib/api/notes';
import { matchCommand, moveActive } from '@/lib/command';
import { isImeComposing } from '@/lib/ime';
import { stripMarkdown } from '@/lib/markdown';
import { qk } from '@/lib/query-keys';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';
import { useCommands } from './command-provider';

const RECENT_QUERY: ListNotesQuery = { limit: 5 };
const SEARCH_LIMIT = 8;
const DEBOUNCE_MS = 150;

type Run = (opts: { shift: boolean }) => void;

interface Item {
  id: string;
  icon: LucideIcon;
  label: ReactNode;
  /** Dòng phụ (đoạn trích của note). */
  detail?: ReactNode;
  /** Phím tắt hiện bên phải. */
  hint?: string;
  run: Run;
}

interface Group {
  id: string;
  label: string;
  items: Item[];
}

interface CommandDef {
  id: string;
  label: string;
  keywords: string[];
  icon: LucideIcon;
  hint?: string;
  run: Run;
}

/**
 * Bảng lệnh Ctrl/Cmd+K: lệnh + tìm note. Pattern ARIA combobox (input role="combobox" +
 * listbox, mục đang chọn qua aria-activedescendant; focus luôn ở ô nhập). Không dùng cmdk.
 * Điều hướng qua useGuardedRouter: vẫn hỏi khi editor còn thay đổi chưa lưu.
 */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useCommands();
  return (
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogContent
        showCloseButton={false}
        data-command-palette
        className={cn(
          'top-[12dvh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl',
          // Mobile (bàn phím ngoài, iPad): nằm trên cùng, không thành bottom sheet.
          'max-sm:top-[max(0.5rem,env(safe-area-inset-top))] max-sm:bottom-auto max-sm:left-2 max-sm:w-[calc(100%-1rem)] max-sm:rounded-2xl',
        )}
      >
        {/* Chỉ render khi mở: mỗi lần mở là ô trống, chọn mục đầu. */}
        <PaletteBody onClose={() => setPaletteOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const router = useGuardedRouter();
  const { openCapture } = useCommands();
  const { resolvedTheme, setTheme } = useTheme();
  const listId = useId();
  const optionPrefix = useId();
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [prevText, setPrevText] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = text.trim();
  const debounced = useDebounced(query, DEBOUNCE_MS);
  const terms = searchTerms(debounced);

  // Gõ khác đi thì chọn lại mục đầu tiên.
  if (text !== prevText) {
    setPrevText(text);
    setActive(0);
  }

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const commands: CommandDef[] = [
    {
      id: 'capture',
      label: 'Ghi nhanh',
      keywords: ['capture', 'quick', 'nhanh', 'inbox'],
      icon: Zap,
      hint: 'C',
      run: () => openCapture(),
    },
    {
      id: 'new',
      label: 'Note mới',
      keywords: ['tạo', 'viết', 'new'],
      icon: Plus,
      run: () => go('/notes/new'),
    },
    {
      id: 'today',
      label: 'Hôm nay',
      keywords: ['ngày', 'lịch', 'today'],
      icon: CalendarDays,
      run: () => go('/today'),
    },
    { id: 'inbox', label: 'Inbox', keywords: ['hộp thư'], icon: Inbox, run: () => go('/inbox') },
    {
      id: 'notes',
      label: 'Ghi chú',
      keywords: ['danh sách', 'notes', 'tất cả'],
      icon: NotebookText,
      run: () => go('/notes'),
    },
    { id: 'tags', label: 'Tag', keywords: ['nhãn'], icon: Tags, run: () => go('/tags') },
    {
      id: 'trash',
      label: 'Thùng rác',
      keywords: ['xóa', 'trash'],
      icon: Trash2,
      run: () => go('/trash'),
    },
    {
      id: 'theme',
      label: resolvedTheme === 'dark' ? 'Đổi sang giao diện sáng' : 'Đổi sang giao diện tối',
      keywords: ['giao diện', 'theme', 'sáng', 'tối', 'dark', 'light'],
      icon: Palette,
      run: () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
        onClose();
      },
    },
  ];

  const recent = useQuery({
    queryKey: qk.noteList(RECENT_QUERY),
    queryFn: ({ signal }) => listNotes(RECENT_QUERY, signal),
    enabled: query === '',
    staleTime: 30_000,
  });
  const searchQuery: ListNotesQuery = { q: debounced, limit: SEARCH_LIMIT };
  const found = useQuery({
    queryKey: qk.noteList(searchQuery),
    queryFn: ({ signal }) => listNotes(searchQuery, signal),
    enabled: terms.length > 0,
    placeholderData: keepPreviousData,
  });

  const noteItem = (n: NoteListItem): Item => {
    const hl = n.highlight;
    const snippet =
      hl && hasHighlight(hl.snippet) ? stripMarkdown(hl.snippet) : stripMarkdown(n.excerpt);
    return {
      id: `note-${n.id}`,
      icon: FileText,
      label: n.title ? (
        hl ? (
          <Highlighted text={hl.title} />
        ) : (
          n.title
        )
      ) : (
        <span className="text-muted-foreground">Không có tiêu đề</span>
      ),
      detail: snippet ? (
        hasHighlight(snippet) ? (
          <Highlighted text={snippet} />
        ) : (
          stripHighlight(snippet)
        )
      ) : undefined,
      // Shift+Enter (hoặc Shift+bấm): mở chế độ đọc.
      run: ({ shift }) => go(shift ? `/notes/${n.id}/read` : `/notes/${n.id}`),
    };
  };

  const commandItems: Item[] = commands
    .filter((c) => matchCommand([c.label, ...c.keywords], query))
    .map((c) => ({ id: `cmd-${c.id}`, icon: c.icon, label: c.label, hint: c.hint, run: c.run }));

  const groups: Group[] = [];
  if (commandItems.length) groups.push({ id: 'cmd', label: 'Lệnh', items: commandItems });
  if (query === '') {
    const items = (recent.data?.items ?? []).map(noteItem);
    if (items.length) groups.push({ id: 'recent', label: 'Gần đây', items });
  } else {
    const items = terms.length ? (found.data?.items ?? []).map(noteItem) : [];
    groups.push({
      id: 'notes',
      label: 'Note',
      items: [
        ...items,
        {
          id: 'all-results',
          icon: Search,
          label: <>Xem tất cả kết quả cho &ldquo;{query}&rdquo;</>,
          run: () => go(`/notes?q=${encodeURIComponent(query)}`),
        },
      ],
    });
  }

  const flat = groups.flatMap((g) => g.items);
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : -1;
  const activeItem = activeIndex >= 0 ? flat[activeIndex] : undefined;
  const optionId = (item: Item) => `${optionPrefix}-${item.id}`;

  useEffect(() => {
    if (!activeItem) return;
    document.getElementById(`${optionPrefix}-${activeItem.id}`)?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeItem, optionPrefix]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isImeComposing(e.nativeEvent)) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(moveActive(activeIndex, e.key === 'ArrowDown' ? 1 : -1, flat.length));
    } else if (e.key === 'Home' && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activeItem?.run({ shift: e.shiftKey });
    }
  };

  const searching = terms.length > 0 && found.isFetching;

  return (
    <>
      <DialogTitle className="sr-only">Bảng lệnh</DialogTitle>
      {/* Ô luôn giữ focus khi bảng mở: chỉ báo focus là viền dưới đổi sang màu ring. */}
      <div className="flex items-center gap-2 border-b-2 border-border px-4 focus-within:border-ring">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeItem ? optionId(activeItem) : undefined}
          aria-label="Tìm note hoặc lệnh"
          placeholder="Tìm note hoặc lệnh…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        {searching ? (
          <span className="text-xs text-muted-foreground" aria-hidden>
            Đang tìm…
          </span>
        ) : null}
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label="Kết quả"
        className="max-h-[min(60dvh,26rem)] overflow-y-auto p-2"
      >
        {groups.map((g) => (
          <div key={g.id} role="group" aria-labelledby={`${optionPrefix}-g-${g.id}`}>
            <div
              id={`${optionPrefix}-g-${g.id}`}
              role="presentation"
              className="px-2 pt-2 pb-1 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase"
            >
              {g.label}
            </div>
            {g.items.map((item) => {
              const index = flat.indexOf(item);
              const selected = index === activeIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  id={optionId(item)}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => !selected && setActive(index)}
                  onClick={(e) => item.run({ shift: e.shiftKey })}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-sm pointer-coarse:py-3',
                    selected && 'bg-accent text-accent-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0 text-muted-foreground',
                      selected && 'text-primary-ink',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{item.label}</span>
                    {item.detail ? (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    ) : null}
                  </span>
                  {item.hint ? (
                    <kbd className="rounded border bg-muted px-1.5 font-mono text-[0.7rem] text-muted-foreground">
                      {item.hint}
                    </kbd>
                  ) : selected ? (
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
        {terms.length > 0 && found.isSuccess && !found.data.items.length && !found.isFetching ? (
          <p className="px-2 py-2 text-sm text-muted-foreground" role="status">
            Không có note nào khớp.
          </p>
        ) : null}
        {found.isError ? (
          <p className="px-2 py-2 text-sm text-destructive" role="alert">
            Không tìm được: server có thể đang tắt.
          </p>
        ) : null}
      </div>
      <div className="flex gap-3 border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground pointer-coarse:hidden">
        <span>
          <kbd className="font-mono">↑↓</kbd> chọn
        </span>
        <span>
          <kbd className="font-mono">Enter</kbd> mở
        </span>
        <span>
          <kbd className="font-mono">Shift+Enter</kbd> đọc
        </span>
        <span>
          <kbd className="font-mono">Esc</kbd> đóng
        </span>
      </div>
    </>
  );
}
