import type { Note, NoteStatus, NoteType, UpdateNoteInput } from '@notebook/shared';

/** Trạng thái form soạn note (tags đã chuẩn hóa bằng tagNameSchema khi nhập). */
export interface NoteDraft {
  title: string;
  content: string;
  type: NoteType;
  status: NoteStatus;
  entryDate: string;
  pinned: boolean;
  tags: string[];
}

export const draftFromNote = (n: Note): NoteDraft => ({
  title: n.title,
  content: n.content,
  type: n.type,
  status: n.status,
  entryDate: n.entryDate,
  pinned: n.pinned,
  tags: n.tags.map((t) => t.name),
});

/** Chuẩn hóa giống zod của API (title trim + NFC, content NFC) để so sánh không bị "chưa lưu" giả. */
const norm = (d: NoteDraft): NoteDraft => ({
  ...d,
  title: d.title.trim().normalize('NFC'),
  content: d.content.normalize('NFC'),
  tags: [...new Set(d.tags)].sort(),
});

/** Các trường của draft khác với note gốc (để PATCH chỉ gửi trường đã đổi). */
export function diffDraft(base: Note, draft: NoteDraft): Omit<UpdateNoteInput, 'version'> {
  const a = norm(draftFromNote(base));
  const b = norm(draft);
  const out: Omit<UpdateNoteInput, 'version'> = {};
  if (a.title !== b.title) out.title = b.title;
  if (a.content !== b.content) out.content = b.content;
  if (a.type !== b.type) out.type = b.type;
  if (a.status !== b.status) out.status = b.status;
  if (a.entryDate !== b.entryDate) out.entryDate = b.entryDate;
  if (a.pinned !== b.pinned) out.pinned = b.pinned;
  if (a.tags.join('\u0000') !== b.tags.join('\u0000')) out.tags = draft.tags;
  return out;
}

export const hasChanges = (base: Note, draft: NoteDraft): boolean =>
  Object.keys(diffDraft(base, draft)).length > 0;

/** Hai draft giống nhau sau khi chuẩn hóa như API (dùng khi note mới đang chờ gửi trong outbox). */
export function sameDraft(a: NoteDraft, b: NoteDraft): boolean {
  const x = norm(a);
  const y = norm(b);
  return (
    x.title === y.title &&
    x.content === y.content &&
    x.type === y.type &&
    x.status === y.status &&
    x.entryDate === y.entryDate &&
    x.pinned === y.pinned &&
    x.tags.join('\u0000') === y.tags.join('\u0000')
  );
}
