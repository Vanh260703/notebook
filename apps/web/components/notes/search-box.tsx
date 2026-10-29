'use client';

import { SEARCH_QUERY_MAX } from '@notebook/shared';
import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { isImeComposing } from '@/lib/ime';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 250;

/**
 * Ô tìm trong note. State cục bộ, ghi lên URL (`onCommit`) sau 250 ms ngừng gõ. Không ghi trong lúc
 * đang gõ IME (chữ chưa chốt). Esc hoặc ✕ thì xóa. Enter: ghi ngay và hạ bàn phím ảo (cảm ứng).
 * `value`: giá trị q trên URL; đổi từ bên ngoài (bảng lệnh "Xem tất cả kết quả", Back) thì ô theo.
 */
export function SearchBox({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (q: string) => void;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [committed, setCommitted] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL đổi mà không phải do ô này ghi: hiện đúng giá trị mới.
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== committed) {
      setText(value);
      setCommitted(value);
    }
  }

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const commit = (next: string) => {
    cancel();
    const q = next.trim();
    if (q === committed) return;
    setCommitted(q);
    onCommit(q);
  };

  const schedule = (next: string) => {
    cancel();
    timer.current = setTimeout(() => commit(next), DEBOUNCE_MS);
  };

  useEffect(() => cancel, []);

  const clear = () => {
    setText('');
    commit('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isImeComposing(e.nativeEvent)) return;
    if (e.key === 'Escape' && text) {
      e.preventDefault();
      clear();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(text);
      if (window.matchMedia('(pointer: coarse)').matches) e.currentTarget.blur();
    }
  };

  return (
    <div role="search" className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        aria-label="Tìm trong note"
        placeholder="Tìm trong note…"
        value={text}
        maxLength={SEARCH_QUERY_MAX}
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          if (!composing.current) schedule(e.target.value);
        }}
        onCompositionStart={() => {
          composing.current = true;
          cancel();
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          schedule(e.currentTarget.value);
        }}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-lg border border-input bg-field pr-10 pl-9 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring md:text-sm [&::-webkit-search-cancel-button]:appearance-none"
      />
      {text ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={clear}
          aria-label="Xóa nội dung tìm"
          title="Xóa (Esc)"
          className="absolute top-1/2 right-1 -translate-y-1/2 pointer-coarse:size-9"
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
