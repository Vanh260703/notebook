import type { Metadata } from 'next';
import { TagsView } from './tags-view';

export const metadata: Metadata = { title: 'Tag · Notebook' };

export default function TagsPage() {
  return <TagsView />;
}
