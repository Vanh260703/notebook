'use client';

import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useId, type ChangeEvent, type KeyboardEvent } from 'react';
import { listTags } from '@/lib/api/tags';
import { qk } from '@/lib/query-keys';
import { commitTagText, shouldCommitOnInput } from '@/lib/tag-input';

/**
 * Nhập tag: Enter, dấu phẩy, hoặc chọn gợi ý để thêm; Backspace ở ô trống để bỏ tag cuối.
 * Tên được chuẩn hóa ngay (trim, NFC, chữ thường) giống API, nên form không bị "chưa lưu" giả.
 *
 * Chữ đang gõ dở (`text`) do form cha giữ: form coi nó là thay đổi chưa lưu và thêm vào
 * trước khi lưu (Ctrl+S khi đang gõ tag không làm mất tag đó).
 */
export function TagInput({
  value,
  onChange,
  text,
  onTextChange,
  error,
  onErrorChange,
  id,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  text: string;
  onTextChange: (text: string) => void;
  error: string | null;
  onErrorChange: (error: string | null) => void;
  id?: string;
}) {
  const listId = useId();
  const errorId = useId();
  const { data } = useQuery({ queryKey: qk.tags, queryFn: listTags, staleTime: 60_000 });
  const suggestions = (data?.items ?? []).map((t) => t.name).filter((n) => !value.includes(n));

  const add = (raw: string) => {
    const r = commitTagText(value, raw);
    onErrorChange(r.error);
    // Lỗi tên không hợp lệ: giữ chữ trong ô để người dùng sửa.
    if (!r.error) onTextChange('');
    if (r.tags.length !== value.length) onChange(r.tags);
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const inputType = (e.nativeEvent as Partial<InputEvent>).inputType;
    if (shouldCommitOnInput(v, inputType, suggestions)) add(v);
    else {
      onTextChange(v);
      if (error) onErrorChange(null);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-field px-1.5 py-1 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring pointer-coarse:min-h-10">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-md bg-accent py-0.5 pr-0.5 pl-1.5 text-xs font-medium text-accent-foreground"
          >
            <span aria-hidden className="opacity-70">
              #
            </span>
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="-my-1 rounded p-1.5 hover:bg-primary/15"
              aria-label={`Bỏ tag ${tag}`}
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          list={listId}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onBlur={() => text.trim() && add(text)}
          placeholder={value.length ? '' : 'Thêm tag (Enter)'}
          aria-label="Thêm tag"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          enterKeyHint="done"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-6 min-w-24 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        <datalist id={listId}>
          {suggestions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
