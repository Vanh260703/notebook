'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NoteForm } from '@/components/notes/note-form';
import { isValidYmd } from '@/lib/calendar';
import { CAPTURE_HANDOFF_KEY, getSessionStorage, readHandoff } from '@/lib/capture-handoff';
import { clearDraft } from '@/lib/local-draft';
import type { NoteDraft } from '@/lib/note-draft';
import { localDate } from '@/lib/date';
import { newId } from '@/lib/uuid';

const NEW_PATH = '/notes/new';

type Session = {
  id: string;
  entryDate: string;
  createdPath: string | null;
  /** Nội dung chuyển từ sheet ghi nhanh ("Mở rộng"), cùng id note. */
  draft?: NoteDraft;
};

/**
 * `?date=YYYY-MM-DD` (từ trang Hôm nay): ngày của note; thiếu hoặc sai thì là hôm nay.
 * `?from=capture`: lấy nội dung và id từ sessionStorage (một lần, key bị xóa sau khi mount).
 */
const newSession = (date: string | null, fromCapture = false): Session => {
  const handoff = fromCapture ? readHandoff(getSessionStorage()) : null;
  if (handoff) {
    return {
      id: handoff.noteId,
      entryDate: handoff.draft.entryDate,
      createdPath: null,
      draft: handoff.draft,
    };
  }
  return { id: newId(), entryDate: isValidYmd(date) ? date : localDate(), createdPath: null };
};

/**
 * Lưu lần đầu đổi URL sang /notes/<id> bằng history.replaceState để form không mount lại
 * (giữ focus, con trỏ, bàn phím ảo). Route của Next khi đó vẫn là /notes/new, nên:
 * - Bấm "Note mới" là điều hướng tới cùng route, Next giữ nguyên component: tự mở phiên mới
 *   khi URL quay về /notes/new.
 * - Back/Forward tới một entry /notes/<id> như thế, Next khôi phục cây route của /notes/new:
 *   URL không phải note vừa tạo trong phiên này thì điều hướng thật tới URL đó.
 */
export default function NewNoteForm() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const dateParam = sp.get('date');
  // Tạo một lần mỗi phiên: bấm Lưu lại (sau lỗi mạng) vẫn cùng id, API idempotent theo id.
  const [session, setSession] = useState(() => newSession(dateParam, sp.get('from') === 'capture'));

  // Handoff chỉ dùng một lần (đọc trong initializer, xóa ở đây vì StrictMode gọi initializer 2 lần).
  useEffect(() => {
    if (session.draft) clearDraft(getSessionStorage(), CAPTURE_HANDOFF_KEY);
  }, [session.draft]);
  const [prevPath, setPrevPath] = useState(pathname);
  const [prevSearch, setPrevSearch] = useState(sp.toString());
  const fromCapture = sp.get('from') === 'capture';

  if (pathname !== prevPath || sp.toString() !== prevSearch) {
    const searchChanged = sp.toString() !== prevSearch;
    setPrevPath(pathname);
    setPrevSearch(sp.toString());
    if (pathname === NEW_PATH) {
      // "Mở rộng" từ sheet ghi nhanh khi đang ở chính /notes/new (cùng route, không mount lại).
      if (searchChanged && fromCapture) setSession(newSession(dateParam, true));
      else if (session.createdPath !== null) setSession(newSession(dateParam));
    }
  }

  const foreign = pathname !== NEW_PATH && pathname !== session.createdPath;
  useEffect(() => {
    if (foreign) router.replace(pathname);
  }, [foreign, pathname, router]);

  if (foreign) return null;
  return (
    <NoteForm
      key={session.id}
      mode="create"
      id={session.id}
      initialEntryDate={session.entryDate}
      initialDraft={session.draft}
      onCreated={(path) => setSession((s) => ({ ...s, createdPath: path }))}
    />
  );
}
