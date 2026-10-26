'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NoteForm } from '@/components/notes/note-form';
import { localDate } from '@/lib/date';
import { newId } from '@/lib/uuid';

const NEW_PATH = '/notes/new';

type Session = { id: string; entryDate: string; createdPath: string | null };
const newSession = (): Session => ({ id: newId(), entryDate: localDate(), createdPath: null });

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
  // Tạo một lần mỗi phiên: bấm Lưu lại (sau lỗi mạng) vẫn cùng id, API idempotent theo id.
  const [session, setSession] = useState(newSession);
  const [prevPath, setPrevPath] = useState(pathname);

  if (pathname !== prevPath) {
    setPrevPath(pathname);
    if (pathname === NEW_PATH && session.createdPath !== null) setSession(newSession());
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
      onCreated={(path) => setSession((s) => ({ ...s, createdPath: path }))}
    />
  );
}
