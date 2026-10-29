import type { Metadata } from 'next';
import { ReadingView } from './reading-view';

export const metadata: Metadata = { title: 'Đọc · Notebook' };

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReadingView key={id} id={id} />;
}
