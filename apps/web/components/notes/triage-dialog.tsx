'use client';

import {
  NOTE_STATUSES,
  NOTE_TYPES,
  type NoteListItem,
  type NoteStatus,
  type NoteType,
} from '@notebook/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/labels';
import { commitTagText } from '@/lib/tag-input';
import { cn } from '@/lib/utils';
import { STATUS_META, TYPE_META } from './note-meta';
import { TagInput } from './tag-input';
import type { NoteFields } from './use-note-actions';

const TYPE_OPTIONS: SegmentedOption<NoteType>[] = NOTE_TYPES.map((t) => {
  const { icon: Icon, text } = TYPE_META[t];
  return {
    value: t,
    label: TYPE_LABEL[t],
    icon: <Icon className={cn('size-3.5', text)} aria-hidden />,
  };
});

const STATUS_OPTIONS: SegmentedOption<NoteStatus>[] = NOTE_STATUSES.map((st) => {
  const { icon: Icon, text } = STATUS_META[st];
  return {
    value: st,
    label: STATUS_LABEL[st],
    icon: <Icon className={cn('size-3.5', text)} aria-hidden />,
  };
});

const sameTags = (a: string[], b: string[]) =>
  [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

/**
 * "Sắp xếp" một note trong Inbox: loại, trạng thái (chọn sẵn Đang dùng), tag. Chỉ gửi các trường
 * đã đổi; `tags` thay toàn bộ như GĐ1. Bottom sheet trên mobile.
 */
export function TriageDialog({
  note,
  onClose,
  onSave,
}: {
  note: NoteListItem | null;
  onClose: () => void;
  onSave: (note: NoteListItem, fields: NoteFields) => void;
}) {
  return (
    <Dialog open={note !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {note ? <TriageForm key={note.id} note={note} onClose={onClose} onSave={onSave} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TriageForm({
  note,
  onClose,
  onSave,
}: {
  note: NoteListItem;
  onClose: () => void;
  onSave: (note: NoteListItem, fields: NoteFields) => void;
}) {
  const original = note.tags.map((t) => t.name);
  const [type, setType] = useState<NoteType>(note.type);
  const [status, setStatus] = useState<NoteStatus>(
    note.status === 'INBOX' ? 'ACTIVE' : note.status,
  );
  const [tags, setTags] = useState<string[]>(original);
  const [tagText, setTagText] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);

  const submit = () => {
    let finalTags = tags;
    if (tagText.trim()) {
      const r = commitTagText(tags, tagText);
      setTagError(r.error);
      if (r.error) return;
      finalTags = r.tags;
    }
    const fields: NoteFields = {};
    if (type !== note.type) fields.type = type;
    if (status !== note.status) fields.status = status;
    if (!sameTags(finalTags, original)) fields.tags = finalTags;
    if (Object.keys(fields).length) onSave(note, fields);
    onClose();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="break-words">
          Sắp xếp &ldquo;{note.title || 'Không có tiêu đề'}&rdquo;
        </DialogTitle>
        <DialogDescription>Chọn loại, trạng thái và gắn tag cho note.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <span
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          aria-hidden
        >
          Loại
        </span>
        <Segmented
          label="Loại"
          value={type}
          onChange={setType}
          options={TYPE_OPTIONS}
          className="self-start"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          aria-hidden
        >
          Trạng thái
        </span>
        <Segmented
          label="Trạng thái"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          className="grid grid-cols-3 sm:inline-flex sm:self-start"
          itemClassName="px-1.5 sm:px-2.5"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          aria-hidden
        >
          Tag
        </span>
        <TagInput
          value={tags}
          onChange={setTags}
          text={tagText}
          onTextChange={setTagText}
          error={tagError}
          onErrorChange={setTagError}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit">Lưu</Button>
      </DialogFooter>
    </form>
  );
}
