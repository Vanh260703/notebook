/**
 * Phần tử nên nhận focus sau khi gỡ `removedId` khỏi danh sách `ids`:
 * dòng kế tiếp, không có thì dòng trước, không còn dòng nào thì null (gọi bên ngoài focus h1).
 */
export function pickFocusAfterRemoval(ids: readonly string[], removedId: string): string | null {
  const i = ids.indexOf(removedId);
  if (i === -1) return null;
  return ids[i + 1] ?? ids[i - 1] ?? null;
}
