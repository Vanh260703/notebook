/**
 * UUID v4 từ crypto.getRandomValues (có cả khi KHÔNG phải secure context,
 * ví dụ mở http://192.168.x.x:3000 từ điện thoại, nơi crypto.randomUUID không tồn tại).
 */
export function uuidV4FromRandomValues(
  getRandomValues: (a: Uint8Array) => Uint8Array = (a) => globalThis.crypto.getRandomValues(a),
): string {
  const b = getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** id của note tạo ở client (POST /notes idempotent theo id). */
export const newId = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : uuidV4FromRandomValues();
