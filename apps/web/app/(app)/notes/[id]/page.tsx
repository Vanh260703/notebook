import type { Metadata } from 'next';
import { NoteDetail } from './note-detail';

export const metadata: Metadata = { title: 'Note · Notebook' };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteDetail key={id} id={id} />;
}
