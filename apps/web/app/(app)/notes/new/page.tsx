import type { Metadata } from 'next';
import { NewNote } from './new-note';

export const metadata: Metadata = { title: 'Note mới · Notebook' };

export default function NewNotePage() {
  return <NewNote />;
}
