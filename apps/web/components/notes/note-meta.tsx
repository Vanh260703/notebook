import type { NoteStatus, NoteType } from '@notebook/shared';
import { Archive, CircleDot, Feather, GraduationCap, Inbox, type LucideIcon } from 'lucide-react';
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';

/**
 * Màu và icon của loại / trạng thái. Màu luôn đi kèm chữ hoặc icon, không phải tín hiệu duy nhất.
 * Class viết đầy đủ (không ghép chuỗi) để Tailwind quét thấy.
 */
export const TYPE_META: Record<NoteType, { icon: LucideIcon; text: string; bar: string }> = {
  LEARNING: { icon: GraduationCap, text: 'text-type-learning', bar: 'bg-type-learning' },
  PERSONAL: { icon: Feather, text: 'text-type-personal', bar: 'bg-type-personal' },
};

export const STATUS_META: Record<NoteStatus, { icon: LucideIcon; text: string; chip: string }> = {
  INBOX: { icon: Inbox, text: 'text-status-inbox', chip: 'bg-status-inbox-bg text-status-inbox' },
  ACTIVE: {
    icon: CircleDot,
    text: 'text-status-active',
    chip: 'bg-status-active-bg text-status-active',
  },
  ARCHIVED: {
    icon: Archive,
    text: 'text-status-archived',
    chip: 'bg-status-archived-bg text-status-archived',
  },
};

/** Loại: icon + chữ màu, không có nền (nhẹ hơn chip trạng thái). */
export function TypeLabel({ type, className }: { type: NoteType; className?: string }) {
  const { icon: Icon, text } = TYPE_META[type];
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', text, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {TYPE_LABEL[type]}
    </span>
  );
}

/** Trạng thái: chip có nền. */
export function StatusChip({ status, className }: { status: NoteStatus; className?: string }) {
  const { icon: Icon, chip } = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full px-2 font-medium whitespace-nowrap',
        chip,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

const tagChipClass =
  'inline-flex h-6 max-w-48 items-center rounded-md bg-muted px-1.5 text-muted-foreground';

/**
 * Tag màu trung tính (không gán màu riêng cho từng tag). Có `onClick` thì là nút lọc,
 * `relative z-10` để nằm trên link phủ toàn card. Không có thì là chữ tĩnh (view thùng rác).
 */
export function TagChip({ name, onClick }: { name: string; onClick?: (name: string) => void }) {
  // Chỉ ký tự "#" trang trí là mờ đi; tên tag giữ đủ contrast.
  const content = (
    <>
      <span aria-hidden className="opacity-70">
        #
      </span>
      <span className="truncate">{name}</span>
    </>
  );
  if (!onClick) return <span className={tagChipClass}>{content}</span>;
  return (
    <button
      type="button"
      onClick={() => onClick(name)}
      title={`Lọc theo #${name}`}
      aria-label={`Lọc theo tag ${name}`}
      className={cn(
        tagChipClass,
        'relative z-10 transition-colors hover:bg-accent hover:text-accent-foreground pointer-coarse:h-8 pointer-coarse:px-2',
      )}
    >
      {content}
    </button>
  );
}
