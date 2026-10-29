'use client';

import { NOTE_TYPES, type NoteType } from '@notebook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CloudOff, Maximize2 } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
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
import { readCaptureDraft, writeCaptureDraft } from '@/lib/capture-draft';
import { getSessionStorage, writeHandoff } from '@/lib/capture-handoff';
import { formatShortDay, localDate } from '@/lib/date';
import { isImeComposing, lineBreakAction } from '@/lib/ime';
import { getDraftStorage } from '@/lib/local-draft';
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
 *
 * `draftKey`: chữ đang gõ được giữ trong localStorage (lib/capture-draft), đóng sheet hay rời trang
 * không mất; mở lại thì điền lại, con trỏ ở cuối. Chỉ xóa khi note đã vào outbox (hoặc đã POST
 * xong) hay khi bấm "Mở rộng".
 * Màn cảm ứng: chặn mọi ngắt dòng (kể cả Enter lọt qua keydown khi Gboard đang gạch chân một từ)
 * và lưu luôn; muốn nhiều dòng thì "Mở rộng".
 */
export function CaptureComposer({
  date,
  autoFocus,
  onDone,
  placeholder = 'Ghi nhanh một ý… (#tag để gắn tag)',
  className,
  draftKey,
}: {
  /** Ngày của note; không có thì là hôm nay lúc bấm lưu. */
  date?: string;
  autoFocus?: boolean;
  /** Gọi sau khi lưu hoặc "Mở rộng" (sheet đóng lại). */
  onDone?: () => void;
  placeholder?: string;
  className?: string;
  /** Key nháp trong localStorage (xem lib/capture-draft). Không có thì không giữ nháp. */
  draftKey?: string;
}) {
  const qc = useQueryClient();
  const outbox = useOutbox();
  const router = useGuardedRouter();
  const hintId = useId();
  const [text, setText] = useState(() =>
    draftKey ? readCaptureDraft(getDraftStorage(), draftKey) : '',
  );
  const [type, setType] = useState<NoteType>(readType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  /** Đang ghi vào outbox / đang POST: Enter lần hai không tạo note thứ hai. */
  const busyRef = useRef(false);
  /** Phím vừa bấm là Shift+Enter (bàn phím ngoài trên iPad): beforeinput để xuống dòng. */
  const shiftEnterRef = useRef(false);

  const updateText = (value: string) => {
    setText(value);
    if (draftKey) writeCaptureDraft(getDraftStorage(), draftKey, value);
  };

  // Mở lại với nháp: con trỏ ở cuối chữ, cuộn xuống dòng cuối.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el?.value) return;
    el.setSelectionRange(el.value.length, el.value.length);
    el.scrollTop = el.scrollHeight;
  }, []);

  // Tự giãn theo nội dung (1 → khoảng 8 dòng, max-h ở class).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const empty = text.trim() === '';
  const today = localDate();

  const buildInput = (value: string) => {
    const { title, content, tags } = parseCapture(value);
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
    // Đọc DOM, không đọc state: chữ IME vừa chốt (Android) có thể chưa kịp vào state.
    const value = ref.current?.value ?? text;
    if (value.trim() === '' || busyRef.current) return;
    const input = buildInput(value);
    setError(null);
    if (outbox.available) {
      busyRef.current = true;
      try {
        await outbox.enqueue(input, 'capture');
      } catch {
        // IndexedDB lỗi giữa chừng (bị chặn, đầy): gửi thẳng như khi không có outbox.
        busyRef.current = false;
        return saveDirect(input);
      }
      busyRef.current = false;
      // Note đã nằm trong outbox: giờ mới bỏ nháp.
      updateText('');
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
    busyRef.current = true;
    setSaving(true);
    try {
      const note = await createNote(input);
      afterNoteSaved(qc, note);
      updateText('');
      onDone?.();
      toast.success('Đã lưu vào Inbox');
    } catch (e) {
      setError(`${errorMessage(e)}. Trình duyệt không cho lưu tạm: cần có mạng để lưu.`);
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const expand = () => {
    const input = buildInput(ref.current?.value ?? text);
    const handedOff = writeHandoff(getSessionStorage(), input.id, {
      title: input.title,
      content: input.content,
      type: input.type,
      status: input.status,
      entryDate: input.entryDate,
      pinned: false,
      tags: input.tags,
    });
    // Chữ đã sang trình soạn đầy đủ (không ghi được handoff thì giữ nháp lại).
    if (handedOff) updateText('');
    onDone?.();
    router.push(`/notes/new?from=capture${date ? `&date=${date}` : ''}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    shiftEnterRef.current = e.key === 'Enter' && e.shiftKey;
    if (e.key !== 'Enter' || e.shiftKey || isImeComposing(e.nativeEvent)) return;
    e.preventDefault();
    void save();
  };

  // Listener gắn một lần (effect bên dưới) luôn gọi bản `save` mới nhất.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  // Màn cảm ứng: Enter khi IME đang gạch chân một từ (Gboard, keyCode 229) lọt qua onKeyDown nhưng
  // trình duyệt vẫn chèn ngắt dòng. Chặn ở beforeinput (sự kiện gốc) rồi lưu. Desktop không gắn:
  // Shift+Enter xuống dòng và Enter để chốt chữ IME giữ nguyên như cũ.
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(pointer: coarse)').matches) return;
    let saveAfterComposition = false;
    const onBeforeInput = (e: InputEvent) => {
      const action = lineBreakAction(e, shiftEnterRef.current);
      if (action === 'ignore') return;
      shiftEnterRef.current = false;
      if (action === 'allow') return;
      e.preventDefault();
      if (action === 'save') void saveRef.current();
      else saveAfterComposition = true;
    };
    const onCompositionEnd = () => {
      if (!saveAfterComposition) return;
      saveAfterComposition = false;
      // Lùi một tick: chữ vừa chốt đã nằm trong value.
      setTimeout(() => void saveRef.current(), 0);
    };
    el.addEventListener('beforeinput', onBeforeInput);
    el.addEventListener('compositionend', onCompositionEnd);
    return () => {
      el.removeEventListener('beforeinput', onBeforeInput);
      el.removeEventListener('compositionend', onCompositionEnd);
    };
  }, []);

  return (
    // Dưới sm (sheet trên điện thoại): ô nhập ở cuối, hàng nút ở trên, như ô nhắn tin. Safari iOS
    // không co trang khi bàn phím mở, hàng nút nằm dưới ô nhập sẽ bị bàn phím che.
    <div className={cn('flex flex-col gap-2', className)}>
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => {
          updateText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label="Nội dung ghi nhanh"
        aria-describedby={hintId}
        aria-invalid={error ? true : undefined}
        enterKeyHint="send"
        className="max-h-[12.5rem] min-h-10 w-full resize-none max-sm:order-last overflow-y-auto rounded-lg border border-input bg-field px-3 py-2 text-base leading-normal outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
      />
      <p id={hintId} className="text-xs text-muted-foreground pointer-coarse:sr-only">
        Enter để lưu · Shift+Enter xuống dòng · #tag để gắn tag
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 max-sm:order-first">
        <Segmented
          label="Loại"
          value={type}
          onChange={(t) => {
            setType(t);
            writeType(t);
          }}
          options={TYPE_OPTIONS}
          itemClassName="pointer-coarse:h-11"
        />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          <span className="sr-only">Ngày của note: </span>
          {formatShortDay(date ?? today, today)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={expand}
            title="Mở trong trình soạn đầy đủ"
            className="pointer-coarse:h-11"
          >
            <Maximize2 aria-hidden />
            Mở rộng
          </Button>
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={empty || saving}
            className="pointer-coarse:h-11"
          >
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </div>
      </div>
    </div>
  );
}
