'use client';

import {
  NOTE_DEFAULT_STATUS,
  NOTE_DEFAULT_TYPE,
  NOTE_STATUSES,
  NOTE_TITLE_MAX,
  NOTE_TYPES,
  versionConflictErrorSchema,
  type Note,
  type NoteStatus,
  type NoteType,
} from '@notebook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EditorView } from '@uiw/react-codemirror';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CloudOff,
  Code,
  Eye,
  History,
  LoaderCircle,
  Pin,
  SquareCode,
  SquarePen,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MarkdownEditor } from '@/components/editor/markdown-editor';
import { MarkdownPreview } from '@/components/editor/markdown-preview';
import { useOutbox } from '@/components/outbox/outbox-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { GuardedLink, useRegisterUnsavedForm } from '@/components/unsaved-guard';
import { errorMessage, isApiError } from '@/lib/api/client';
import { createNote, restoreNote, updateNote } from '@/lib/api/notes';
import { copyText } from '@/lib/clipboard';
import { toggleCodeBlockCommand, toggleCodeCommand } from '@/lib/code-block';
import { formatDateTime, formatSavedAt, formatShortDay } from '@/lib/date';
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/labels';
import {
  NEW_DRAFT_KEY,
  clearDraft,
  createDraftWriter,
  draftKey,
  getDraftStorage,
  isDraftEmpty,
  readDraft,
  writeDraft,
  type StoredDraft,
} from '@/lib/local-draft';
import { diffDraft, draftFromNote, hasChanges, sameDraft, type NoteDraft } from '@/lib/note-draft';
import { commitTagText } from '@/lib/tag-input';
import { cn } from '@/lib/utils';
import { ConflictDialog, TrashedOnSaveDialog } from './conflict-dialog';
import { STATUS_META, StatusChip, TYPE_META, TypeLabel } from './note-meta';
import { TagInput } from './tag-input';
import { TrashedNoteView } from './trashed-note-view';
import { afterNoteSaved, useDeleteNote, useRestoreNote } from './use-note-actions';

type Props =
  | {
      mode: 'create';
      id: string;
      initialEntryDate: string;
      /** Nội dung ban đầu (từ sheet ghi nhanh "Mở rộng"). */
      initialDraft?: NoteDraft;
      /** Gọi trước khi đổi URL sang /notes/<id> (lần lưu đầu). */
      onCreated?: (path: string) => void;
    }
  | { mode: 'edit'; note: Note };

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const emptyDraft = (entryDate: string): NoteDraft => ({
  title: '',
  content: '',
  type: NOTE_DEFAULT_TYPE,
  status: NOTE_DEFAULT_STATUS,
  entryDate,
  pinned: false,
  tags: [],
});

/** Nháp cục bộ còn sót lại từ lần trước (tab bị đóng/kill, nút Back...), nếu nó khác bản hiện có. */
function findRecoveredDraft(props: Props): StoredDraft | null {
  const storage = getDraftStorage();
  if (props.mode === 'edit') {
    const s = readDraft(storage, draftKey(props.note.id));
    return s && s.noteId === props.note.id && hasChanges(props.note, s.draft) ? s : null;
  }
  const s = readDraft(storage, NEW_DRAFT_KEY);
  return s && !isDraftEmpty(s.draft) ? s : null;
}

const DRAFT_DEBOUNCE_MS = 500;

type SaveOutcome = { kind: 'saved'; note: Note } | { kind: 'queued'; draft: NoteDraft };

const TYPE_OPTIONS: SegmentedOption<NoteType>[] = NOTE_TYPES.map((t) => {
  const { icon: Icon, text } = TYPE_META[t];
  return {
    value: t,
    label: TYPE_LABEL[t],
    icon: <Icon className={cn('size-3.5', text)} aria-hidden />,
  };
});

// Theo đúng vòng đời INBOX → ACTIVE → ARCHIVED: nhìn là biết note đang ở bước nào.
const STATUS_OPTIONS: SegmentedOption<NoteStatus>[] = NOTE_STATUSES.map((st) => {
  const { icon: Icon, text } = STATUS_META[st];
  return {
    value: st,
    label: STATUS_LABEL[st],
    icon: <Icon className={cn('size-3.5', text)} aria-hidden />,
  };
});

const VIEW_OPTIONS: SegmentedOption<'write' | 'preview'>[] = [
  { value: 'write', label: 'Viết', icon: <SquarePen className="size-3.5" aria-hidden /> },
  { value: 'preview', label: 'Xem', icon: <Eye className="size-3.5" aria-hidden /> },
];

const paneHeader =
  'hidden h-9 shrink-0 items-center border-b px-3 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase lg:flex';

/**
 * Form soạn note (tạo mới và sửa). Lưu bằng nút Lưu hoặc Ctrl/Cmd+S, chưa có autosave.
 * Chỉ khởi tạo state một lần (component cha đặt key={id}): query refetch không reset form.
 * PATCH chỉ gửi các trường khác `base`, kèm `base.version`.
 *
 * Chống mất dữ liệu chưa lưu, hai lớp:
 * (a) guard điều hướng trong app (GuardedLink, đăng xuất) hỏi Lưu / Bỏ / Ở lại;
 * (b) nháp localStorage (debounce 500 ms, ghi ngay khi tab bị ẩn), lần sau mở lại thì hỏi khôi phục.
 */
export function NoteForm(props: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const metaId = useId();

  const [id, setId] = useState(props.mode === 'edit' ? props.note.id : props.id);
  const [base, setBase] = useState<Note | null>(props.mode === 'edit' ? props.note : null);
  const [draft, setDraft] = useState<NoteDraft>(() =>
    props.mode === 'edit'
      ? draftFromNote(props.note)
      : (props.initialDraft ?? emptyDraft(props.initialEntryDate)),
  );
  const [recovered, setRecovered] = useState<StoredDraft | null>(() => findRecoveredDraft(props));
  const [tagText, setTagText] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Note | null>(null);
  const [trashedOnSave, setTrashedOnSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [metaOpen, setMetaOpen] = useState(false);
  const focusTitleRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const runEditorCommand = (command: (view: EditorView) => boolean) => {
    const view = editorViewRef.current;
    if (!view) return;
    command(view);
    view.focus();
  };

  const [storage] = useState(getDraftStorage);
  const [writer] = useState(() => createDraftWriter(DRAFT_DEBOUNCE_MS));
  const discardedRef = useRef(false);
  const outbox = useOutbox();
  /**
   * Note mới đã nằm trong outbox (IndexedDB) nhưng chưa lên server: bản đã "lưu trên máy".
   * Không còn coi là chưa lưu (guard và beforeunload không chặn), outbox tự gửi khi có mạng.
   */
  const [queuedDraft, setQueuedDraft] = useState<NoteDraft | null>(null);

  const readOnly = Boolean(base?.deletedAt);
  const draftDirty = base
    ? hasChanges(base, draft)
    : queuedDraft
      ? !sameDraft(queuedDraft, draft)
      : !isDraftEmpty(draft);
  const dirty = draftDirty || tagText.trim() !== '';
  const storageKey = base ? draftKey(base.id) : NEW_DRAFT_KEY;

  const set = <K extends keyof NoteDraft>(key: K, value: NoteDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const onSaved = (note: Note, message?: string) => {
    writer.cancel();
    setBase(note);
    setQueuedDraft(null);
    setSaveError(null);
    afterNoteSaved(qc, note);
    if (message) toast.success(message);
    if (props.mode === 'create') {
      clearDraft(storage, NEW_DRAFT_KEY);
      // Đổi URL mà không đổi route: form giữ nguyên (focus, con trỏ, bàn phím ảo).
      // Next đồng bộ usePathname với history.replaceState. Các lần lưu sau là PATCH vì đã có `base`.
      const path = `/notes/${note.id}`;
      if (window.location.pathname !== path) {
        props.onCreated?.(path);
        window.history.replaceState(null, '', path);
      }
    }
  };

  const onSaveError = (e: unknown) => {
    if (isApiError(e, 'VERSION_CONFLICT')) {
      const parsed = versionConflictErrorSchema.safeParse(e.body);
      if (parsed.success) {
        setConflict(parsed.data.current);
        return;
      }
    }
    if (isApiError(e, 'NOTE_IN_TRASH')) {
      setTrashedOnSave(true);
      return;
    }
    // Lỗi nằm lại trên màn hình (không chỉ toast vài giây): server ở nhà có thể đang tắt.
    setSaveError(errorMessage(e));
  };

  /** PATCH các trường của `d` khác `against`, dùng version của nó. */
  const patchAgainst = async (against: Note, d: NoteDraft): Promise<Note> => {
    const changes = diffDraft(against, d);
    if (!Object.keys(changes).length) return against;
    return updateNote(against.id, { version: against.version, ...changes });
  };

  /**
   * Note mới (chưa có `base`) đi qua outbox: ghi IndexedDB trước, rồi chờ gửi tối đa 8 giây.
   * - Lên server: như GĐ1 (replaceState, các lần sau là PATCH).
   * - Lỗi tạm thời/timeout: "Chờ gửi", outbox tự gửi tiếp; khi xong phát `sent` (effect bên dưới).
   * - Lỗi vĩnh viễn: dòng lỗi như GĐ1, bỏ record khỏi hàng.
   * Không có outbox (IndexedDB bị chặn): POST thẳng như GĐ1.
   */
  const createViaOutbox = async (d: NoteDraft): Promise<SaveOutcome> => {
    const input = { id, ...d };
    if (!outbox.available) return { kind: 'saved', note: await createNote(input) };
    let inQueue: boolean;
    try {
      inQueue = await outbox.replace(id, input);
      if (!inQueue) await outbox.enqueue(input, 'editor');
    } catch {
      return { kind: 'saved', note: await createNote(input) };
    }
    const res = await outbox.sendNow(id, { timeoutMs: 8000 });
    if (res.status === 'sent') return { kind: 'saved', note: res.note };
    if (res.status === 'failed') {
      await outbox.remove(id);
      throw new Error(res.error?.message ?? 'Không lưu được');
    }
    return { kind: 'queued', draft: d };
  };

  const save = useMutation({
    mutationFn: async (d: NoteDraft): Promise<SaveOutcome> => {
      if (base) return { kind: 'saved', note: await patchAgainst(base, d) };
      return createViaOutbox(d);
    },
    onMutate: () => setSaveError(null),
    onSuccess: (r) => {
      if (r.kind === 'saved') return onSaved(r.note);
      writer.cancel();
      setQueuedDraft(r.draft);
      // Outbox giờ là nơi giữ dữ liệu: bỏ nháp localStorage để không có hai banner cho một note.
      clearDraft(storage, NEW_DRAFT_KEY);
    },
    onError: onSaveError,
  });

  // Note chờ gửi đã lên server (dù form vẫn đang mở): chuyển sang chế độ sửa, lần sau là PATCH.
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });
  const waitingForOutbox = queuedDraft !== null && !base;
  const onOutboxSent = outbox.onSent;
  useEffect(() => {
    if (!waitingForOutbox) return;
    return onOutboxSent((note) => {
      if (note.id === id) onSavedRef.current(note);
    });
  }, [waitingForOutbox, onOutboxSent, id]);

  const keepMine = useMutation({
    mutationFn: (current: Note) => patchAgainst(current, draft),
    onMutate: () => setSaveError(null),
    onSuccess: (note) => {
      setConflict(null);
      onSaved(note);
    },
    onError: (e) => {
      setConflict(null);
      onSaveError(e);
    },
  });

  const restoreAndSave = useMutation({
    mutationFn: async () => patchAgainst(await restoreNote(id), draft),
    onMutate: () => setSaveError(null),
    onSuccess: (note) => {
      setTrashedOnSave(false);
      onSaved(note, 'Đã khôi phục và lưu');
    },
    onError: (e) => {
      setTrashedOnSave(false);
      onSaveError(e);
    },
  });

  const restore = useRestoreNote();
  const del = useDeleteNote({ onDeleted: () => router.push('/notes') });

  const busy = save.isPending || keepMine.isPending || restoreAndSave.isPending;
  const canSave = dirty && !busy && !readOnly;

  /** Đưa tag đang gõ dở vào draft. null nếu tên tag không hợp lệ (không lưu). */
  const commitPendingTag = (): NoteDraft | null => {
    if (!tagText.trim()) return draft;
    const r = commitTagText(draft.tags, tagText);
    setTagError(r.error);
    if (r.error) {
      setMetaOpen(true);
      return null;
    }
    const next = { ...draft, tags: r.tags };
    setDraft(next);
    setTagText('');
    return next;
  };

  const startSave = () => {
    if (!canSave) return;
    const d = commitPendingTag();
    if (d) save.mutate(d);
  };

  /** Cho guard điều hướng ("Lưu rồi đi"): true khi lưu xong. */
  const saveForGuard = async (): Promise<boolean> => {
    if (readOnly || busy) return false;
    const d = commitPendingTag();
    if (!d) return false;
    try {
      await save.mutateAsync(d);
      return true;
    } catch {
      return false;
    }
  };

  /** "Bỏ thay đổi": quay về bản đã lưu và xóa nháp cục bộ. */
  const discard = () => {
    discardedRef.current = true;
    writer.cancel();
    clearDraft(storage, storageKey);
    if (props.mode === 'create') clearDraft(storage, NEW_DRAFT_KEY);
    setDraft(base ? draftFromNote(base) : (queuedDraft ?? emptyDraft(draft.entryDate)));
    setTagText('');
    setTagError(null);
    setRecovered(null);
    setSaveError(null);
  };

  useRegisterUnsavedForm({
    isDirty: () => dirty && !readOnly,
    save: saveForGuard,
    discard,
  });

  // Ref tới hàm lưu mới nhất cho phím tắt (listener chỉ đăng ký một lần).
  // Không lưu khi dialog xung đột đang mở: PATCH lại bằng version cũ sẽ lại nhận 409.
  const saveRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    saveRef.current = () => {
      if (!conflict && !trashedOnSave) startSave();
    };
  });

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Cảnh báo khi đóng tab/tải lại trang còn thay đổi chưa lưu (desktop; iOS Safari không phát
  // beforeunload, ở đó nhờ nháp localStorage).
  useEffect(() => {
    if (!dirty || readOnly) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, readOnly]);

  // Nháp cục bộ: còn thay đổi thì ghi (debounce), hết thay đổi thì xóa. Khi banner "có bản nháp"
  // đang chờ người dùng chọn thì không xóa bản nháp cũ.
  useEffect(() => {
    if (readOnly) return;
    if (draftDirty) {
      discardedRef.current = false;
      const value: StoredDraft = {
        noteId: id,
        draft,
        baseVersion: base?.version ?? null,
        savedAt: new Date().toISOString(),
      };
      writer.schedule(() => writeDraft(storage, storageKey, value));
    } else {
      writer.cancel();
      if (!recovered) clearDraft(storage, storageKey);
    }
  }, [draft, draftDirty, storageKey, recovered, readOnly, id, base, storage, writer]);

  // Ghi ngay lần đang chờ khi tab bị ẩn (iOS có thể kill tab ở nền) và khi rời form.
  useEffect(() => {
    const flush = () => writer.flush();
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      if (discardedRef.current) writer.cancel();
      else writer.flush();
    };
  }, [writer]);

  // Vừa khôi phục từ thùng rác: form hiện lại, đưa focus vào tiêu đề để biết đã sửa được.
  useEffect(() => {
    if (focusTitleRef.current && !readOnly) {
      focusTitleRef.current = false;
      titleRef.current?.focus();
    }
  }, [readOnly]);

  const restoreRecovered = () => {
    if (!recovered) return;
    setDraft(recovered.draft);
    if (props.mode === 'create' && !base) setId(recovered.noteId); // POST lại đúng id cũ (idempotent)
    // Nháp viết trên phiên bản cũ hơn bản đang có trên server: cho chọn như khi gặp 409.
    if (base && recovered.baseVersion !== null && recovered.baseVersion !== base.version) {
      setConflict(base);
    }
    setRecovered(null);
  };

  const dropRecovered = () => {
    writer.cancel();
    clearDraft(storage, storageKey);
    setRecovered(null);
  };

  const copyMine = async () => {
    const text = draft.title ? `# ${draft.title}\n\n${draft.content}` : draft.content;
    if (await copyText(text)) toast.success('Đã sao chép');
    else toast.error('Không sao chép được');
  };

  const onDelete = () => {
    if (dirty && !window.confirm('Note còn thay đổi chưa lưu. Vẫn xóa?')) return;
    del.mutate(id);
  };

  const backLink = (
    <GuardedLink
      href="/notes"
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:py-2"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Ghi chú
    </GuardedLink>
  );

  if (readOnly && base) {
    return (
      <div className="flex w-full max-w-4xl flex-col gap-4">
        <div className="flex items-center">{backLink}</div>
        <TrashedNoteView
          note={base}
          restoring={restore.isPending}
          onRestore={() =>
            restore.mutate(base.id, {
              onSuccess: (note) => {
                setBase(note);
                setDraft(draftFromNote(note));
                focusTitleRef.current = true;
              },
            })
          }
        />
      </div>
    );
  }

  const status = busy ? (
    <>
      <LoaderCircle
        className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
        aria-hidden
      />
      <span className="truncate">Đang lưu…</span>
    </>
  ) : saveError ? (
    <>
      <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-hidden />
      <span className="truncate font-medium text-destructive">Lưu lỗi</span>
    </>
  ) : dirty ? (
    <>
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
      <span className="truncate font-medium text-warning">Chưa lưu</span>
    </>
  ) : queuedDraft && !base ? (
    <>
      <CloudOff className="size-3.5 shrink-0 text-warning" aria-hidden />
      <span
        className="truncate font-medium text-warning"
        title="Đã lưu trên máy này, sẽ tự gửi khi kết nối lại"
      >
        Chờ gửi
      </span>
    </>
  ) : base ? (
    <>
      <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden />
      <span className="truncate" title={`Lưu lúc ${formatDateTime(base.updatedAt)}`}>
        Đã lưu {formatSavedAt(base.updatedAt)}
      </span>
    </>
  ) : (
    <span className="truncate">Note mới</span>
  );

  return (
    // lg: cả form cao đúng một màn hình (3rem = md:py-6 của main), khung editor co giãn theo
    // phần còn lại (banner nháp, metadata hai hàng...).
    <div className="flex w-full max-w-7xl flex-col gap-3 lg:h-[calc(100dvh-3rem)]">
      {/* Dính trên cùng: trên điện thoại (không có Ctrl+S) nút Lưu luôn trong tầm tay.
          Margin âm khớp padding của main (app-main.tsx). */}
      <div className="sticky top-0 z-30 -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-1 border-b bg-background/90 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur md:-mx-8 md:-mt-6 md:px-8 md:py-2.5">
        <div className="flex items-center gap-2">
          {backLink}
          <span
            className="ml-auto flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {status}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => set('pinned', !draft.pinned)}
            aria-pressed={draft.pinned}
            aria-label={draft.pinned ? 'Bỏ ghim' : 'Ghim'}
            title={draft.pinned ? 'Bỏ ghim' : 'Ghim'}
          >
            <Pin className={cn(draft.pinned && 'fill-current text-primary-ink')} />
          </Button>
          {base ? (
            <GuardedLink
              href={`/notes/${base.id}/read`}
              aria-label="Chế độ đọc"
              title="Chế độ đọc"
              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            >
              <BookOpen />
            </GuardedLink>
          ) : null}
          {base ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={del.isPending}
              aria-label="Xóa (chuyển vào thùng rác)"
              title="Xóa (chuyển vào thùng rác)"
            >
              <Trash2 />
            </Button>
          ) : null}
          <Button onClick={startSave} disabled={!canSave}>
            {busy ? 'Đang lưu…' : 'Lưu'}
            <kbd
              className="hidden font-mono text-[0.7rem] opacity-70 sm:inline"
              suppressHydrationWarning
            >
              {isMac() ? '⌘S' : 'Ctrl+S'}
            </kbd>
          </Button>
        </div>
        {saveError ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-destructive/5 px-2 py-1.5 text-sm text-destructive"
          >
            <span className="min-w-0 flex-1">Lưu lỗi: {saveError}</span>
            <Button size="sm" variant="outline" onClick={startSave} disabled={!canSave}>
              Thử lại
            </Button>
          </div>
        ) : null}
      </div>

      {recovered ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent px-3 py-2 text-sm"
        >
          <History className="size-4 shrink-0 text-primary-ink" aria-hidden />
          <span className="mr-auto min-w-0">
            Có bản nháp chưa lưu lúc {formatDateTime(recovered.savedAt)}
            {base && recovered.baseVersion !== null && recovered.baseVersion !== base.version
              ? ' (note đã được sửa ở nơi khác sau đó)'
              : ''}
            .
          </span>
          <Button size="sm" onClick={restoreRecovered}>
            Khôi phục
          </Button>
          <Button size="sm" variant="ghost" onClick={dropRecovered}>
            Bỏ
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="note-title"
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Tiêu đề
        </label>
        {/* Ô có viền và nền như mọi ô nhập khác: không viền thì trông như heading tĩnh, người dùng không nhận ra là gõ được. */}
        <input
          id="note-title"
          ref={titleRef}
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={NOTE_TITLE_MAX}
          placeholder="Nhập tiêu đề note…"
          autoFocus={props.mode === 'create'}
          className="w-full rounded-lg border border-input bg-field px-3 py-2 text-xl leading-tight font-bold tracking-[-0.02em] transition-colors outline-none placeholder:font-semibold placeholder:text-muted-foreground hover:border-ring/70 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring md:text-2xl"
        />
      </div>

      {/* Mobile: metadata gom thành một dòng tóm tắt, bấm để mở. Từ md: luôn mở. */}
      <button
        type="button"
        className="flex flex-wrap items-center gap-x-1.5 gap-y-1 self-start rounded-md py-1 text-xs text-muted-foreground hover:text-foreground pointer-coarse:py-2 md:hidden"
        aria-expanded={metaOpen}
        aria-controls={metaId}
        onClick={() => setMetaOpen((o) => !o)}
      >
        <span className="sr-only">Thông tin note: </span>
        <TypeLabel type={draft.type} />
        <span aria-hidden>·</span>
        <StatusChip status={draft.status} />
        <span aria-hidden>·</span>
        <span className="tabular-nums">{formatShortDay(draft.entryDate)}</span>
        {draft.tags.length ? (
          <>
            <span aria-hidden>·</span>
            <span>{draft.tags.length} tag</span>
          </>
        ) : null}
        <ChevronDown
          className={cn('size-4 transition-transform', metaOpen && 'rotate-180')}
          aria-hidden
        />
      </button>
      <div
        id={metaId}
        className={cn('flex flex-wrap items-start gap-2', !metaOpen && 'hidden md:flex')}
      >
        <Segmented
          label="Loại"
          value={draft.type}
          onChange={(v) => set('type', v)}
          options={TYPE_OPTIONS}
        />
        <Segmented
          label="Trạng thái"
          value={draft.status}
          onChange={(v) => set('status', v)}
          options={STATUS_OPTIONS}
        />
        <div className="relative flex items-center">
          <CalendarDays
            className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground"
            aria-hidden
          />
          <input
            type="date"
            aria-label="Ngày của note"
            value={draft.entryDate}
            required
            onChange={(e) => e.target.value && set('entryDate', e.target.value)}
            className="h-8 rounded-lg border border-input bg-field pr-2 pl-8 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring pointer-coarse:h-10 md:text-sm"
          />
        </div>
        <TagInput
          value={draft.tags}
          onChange={(tags) => set('tags', tags)}
          text={tagText}
          onTextChange={setTagText}
          error={tagError}
          onErrorChange={setTagError}
        />
      </div>

      {/* Dưới lg: chuyển Viết / Xem. Từ lg: chia đôi (từ md đến lg mỗi bên quá hẹp vì có sidebar). */}
      <Segmented
        label="Chế độ xem"
        value={tab}
        onChange={setTab}
        options={VIEW_OPTIONS}
        className="self-start lg:hidden"
      />

      <div className="grid min-h-[60dvh] overflow-hidden rounded-xl border bg-card shadow-elev-1 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
        <div
          className={cn(
            'flex min-h-[60dvh] min-w-0 flex-col focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset lg:min-h-0 lg:border-r',
            tab !== 'write' && 'hidden lg:flex',
          )}
        >
          {/* Khác pane Xem trước: hiện cả dưới lg vì chứa nút (trên điện thoại không có phím tắt). */}
          <div className="flex min-h-9 shrink-0 items-center justify-between gap-2 border-b px-3 py-1">
            <span
              aria-hidden
              className="hidden text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase lg:inline"
            >
              Markdown
            </span>
            <div className="-mr-1.5 ml-auto flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                // Giữ focus và vùng chọn trong editor khi bấm chuột.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runEditorCommand(toggleCodeCommand)}
                aria-keyshortcuts={isMac() ? 'Meta+Shift+C' : 'Control+Shift+C'}
              >
                <Code aria-hidden />
                Code
                <kbd
                  className="hidden font-mono text-[0.7rem] opacity-70 sm:inline"
                  suppressHydrationWarning
                >
                  {isMac() ? '⇧⌘C' : 'Ctrl+Shift+C'}
                </kbd>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runEditorCommand(toggleCodeBlockCommand)}
                aria-keyshortcuts={isMac() ? 'Meta+Alt+Shift+C' : 'Control+Alt+Shift+C'}
                title={isMac() ? '⌥⇧⌘C' : 'Ctrl+Alt+Shift+C'}
              >
                <SquareCode aria-hidden />
                Code block
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3">
            <MarkdownEditor
              value={draft.content}
              onChange={(v) => set('content', v)}
              placeholder="Viết Markdown…"
              onView={(view) => {
                editorViewRef.current = view;
              }}
            />
          </div>
        </div>
        <div
          role="region"
          aria-label="Xem trước"
          className={cn(
            'flex min-h-[60dvh] min-w-0 flex-col bg-muted/40 lg:min-h-0',
            tab !== 'preview' && 'hidden lg:flex',
          )}
        >
          <div aria-hidden className={paneHeader}>
            Xem trước
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
            <MarkdownPreview content={draft.content} />
          </div>
        </div>
      </div>

      <ConflictDialog
        current={conflict}
        mine={draft}
        busy={busy}
        onKeepMine={() => conflict && keepMine.mutate(conflict)}
        onUseServer={() => {
          if (!conflict) return;
          setBase(conflict);
          setDraft(draftFromNote(conflict));
          afterNoteSaved(qc, conflict);
          setConflict(null);
        }}
        onCopyMine={() => void copyMine()}
        onClose={() => setConflict(null)}
      />
      <TrashedOnSaveDialog
        open={trashedOnSave}
        busy={busy}
        onRestoreAndSave={() => restoreAndSave.mutate()}
        onCopy={() => void copyMine()}
        onClose={() => setTrashedOnSave(false)}
      />
    </div>
  );
}
