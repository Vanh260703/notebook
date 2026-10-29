import { redirect } from 'next/navigation';

/** Mở app là vào trang Hôm nay (PROJECT.md mục 3: "Buổi sáng: mở app, vào trang Hôm nay"). */
export default function HomePage() {
  redirect('/today');
}
