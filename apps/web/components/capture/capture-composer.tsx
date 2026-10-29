'use client';

import { NOTE_TYPES, type NoteType } from '@notebook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CloudOff, Maximize2 } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { TYPE_META } from '@/components/notes/note-meta';
import { afterNoteSaved } from '@/components/notes/use-note-actions';
import { useOutbox } from '@/components/outbox/outbox-provider';
import { Button } from '@/components/ui/button';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { useGuardedRouter } from '@/components/unsaved-guard';
import { errorMessage } from '@/lib/api/client';
import { createNote } from '@/lib/api/notes';
import { parseCapture } from '@/lib/capture';
import { getSessionStorage, writeHandoff } from '@/lib/capture-handoff';
import { formatShortDay, localDate } from '@/lib/date';
import { isImeComposing } from '@/lib/ime';
import { TYPE_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { newId } from '@/lib/uuid';

const TYPE_KEY = 'nb:capture-type';

const TYPE_OPTIONS: SegmentedOption<NoteType>[] = NOTE_TYPES.map((t) => {
  const { icon: Icon, text } = TYPE_META[t];
  return {
    value: t,
    label: TYPE_LABEL[t],
    icon: <Icon className={cn('size-3.5', text)} aria-hidden />,
  };
});

function readType(): NoteType {
  try {
    const v = window.localStorage.getItem(TYPE_KEY);
    return (NOTE_TYPES as readonly string[]).includes(v ?? '') ? (v as NoteType) : 'LEARNING';
  } catch {
    return 'LEARNING';
  }
}

function writeType(t: NoteType) {
  try {
    window.localStorage.setItem(TYPE_KEY, t);
  } catch {
    // không nhớ được lựa chọn thì thôi
  }
}

/**
 * Ô ghi nhanh: Enter lưu (trừ khi đang gõ IME), Shift+Enter xuống dòng, `#tag` thành tag, dòng đầu
 * thành tiêu đề. Note mới luôn vào Inbox, đi qua outbox (lưu trên máy trước, gửi sau).
 * Dùng trong sheet "Ghi nhanh" và ngay trong trang Hôm nay (desktop).
 * Chỉ render ở client (trong Dialog, hoặc sau khi biết "hôm nay"): đọc localStorage khi khởi tạo.
 */
export function CaptureComposer({
  date,
  autoFocus,
  onDone,
  placeholder = 'Ghi nhanh một ý… (#tag để gắn tag)',
  className,
}: {
  /** Ngày của note; không có thì là hôm nay lúc bấm lưu. */
  date?: string;
  autoFocus?: boolean;
  /** Gọi sau khi lưu hoặc "Mở rộng" (sheet đóng lại). */
  onDone?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const outbox = useOutbox();
  const router = useGuardedRouter();
  const hintId = useId();
  const [text, setText] = useState('');
  const [type, setType] = useState<NoteType>(readType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Tự giãn theo nội dung (1 → khoảng 8 dòng, max-h ở class).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const empty = text.trim() === '';
  const today = localDate();

  const buildInput = () => {
    const { title, content, tags } = parseCapture(text);
    return {
      id: newId(),
      entryDate: date ?? localDate(),
      title,
      content,
      type,
      status: 'INBOX' as const,
      tags,
    };
  };

  const save = async () => {
    if (empty || saving) return;
    const input = buildInput();
    setError(null);
    if (outbox.available) {
      try {
        await outbox.enqueue(input, 'capture');
      } catch {
        // IndexedDB lỗi giữa chừng (bị chặn, đầy): gửi thẳng như khi không có outbox.
        return saveDirect(input);
      }
      setText('');
      onDone?.();
      const t = toast.loading('Đang lưu…');
      const res = await outbox.sendNow(input.id, { timeoutMs: 4000 });
      if (res.status === 'sent') toast.success('Đã lưu vào Inbox', { id: t });
      else if (res.status === 'failed')
        toast.error(`Lưu lỗi: ${res.error?.message ?? 'không rõ'}. Xem ở Inbox.`, { id: t });
      else
        toast('Đã lưu trên máy, sẽ tự gửi khi có mạng', {
          id: t,
          icon: <CloudOff className="size-4 text-warning" aria-hidden />,
        });
      return;
    }
    return saveDirect(input);
  };

  /** Không có outbox: POST thẳng, lỗi thì giữ chữ trong ô. */
  const saveDirect = async (input: ReturnType<typeof buildInput>) => {
    setSaving(true);
    try {
      const note = await createNote(input);
      afterNoteSaved(qc, note);
      setText('');
      onDone?.();
      toast.success('Đã lưu vào Inbox');
    } catch (e) {
      setError(`${errorMessage(e)}. Trình duyệt không cho lưu tạm: cần có mạng để lưu.`);
    } finally {
      setSaving(false);
    }
  };

  const expand = () => {
    const input = buildInput();
    writeHandoff(getSessionStorage(), input.id, {
      title: input.title,
      content: input.content,
      type: input.type,
      status: input.status,
      entryDate: input.entryDate,
      pinned: false,
      tags: input.tags,
    });
    onDone?.();
    router.push(`/notes/new?from=capture${date ? `&date=${date}` : ''}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || isImeComposing(e.nativeEvent)) return;
    e.preventDefault();
    void save();
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label="Nội dung ghi nhanh"
        aria-describedby={hintId}
        aria-invalid={error ? true : undefined}
        enterKeyHint="send"
        className="max-h-[12.5rem] min-h-10 w-full resize-none overflow-y-auto rounded-lg border border-input bg-field px-3 py-2 text-base leading-normal outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
      />
      <p id={hintId} className="text-xs text-muted-foreground pointer-coarse:sr-only">
        Enter để lưu · Shift+Enter xuống dòng · #tag để gắn tag
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Loại"
          value={type}
          onChange={(t) => {
            setType(t);
            writeType(t);
          }}
          options={TYPE_OPTIONS}
        />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          <span className="sr-only">Ngày của note: </span>
          {formatShortDay(date ?? today, today)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={expand} title="Mở trong trình soạn đầy đủ">
            <Maximize2 aria-hidden />
            Mở rộng
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={empty || saving}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </div>
      </div>
    </div>
  );
}
