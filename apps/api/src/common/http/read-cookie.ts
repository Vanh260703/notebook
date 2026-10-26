/**
 * Đọc một cookie từ header Cookie. Express 5 không tự parse cookie, không cần cookie-parser.
 * Không bao giờ throw (giá trị encode sai thì trả về nguyên chuỗi).
 */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      const raw = part.slice(i + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}
