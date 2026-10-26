/**
 * Logic chặn rời trang khi form còn thay đổi chưa lưu (không phụ thuộc React, để test được).
 * Provider React (`components/unsaved-guard.tsx`) bọc nó và hiện dialog
 * "Lưu rồi đi / Bỏ thay đổi / Ở lại".
 *
 * Chỉ chặn được điều hướng do app khởi xướng (GuardedLink, guardedPush, đăng xuất).
 * Nút Back, đóng tab, iOS kill tab: do lớp nháp localStorage (`lib/local-draft.ts`) lo.
 */
export interface GuardedForm {
  /** Form hiện có thay đổi chưa lưu không (đọc lúc người dùng điều hướng). */
  isDirty: () => boolean;
  /** Lưu. Trả true nếu lưu xong (false: lỗi, xung đột 409, đang bận...). */
  save: () => Promise<boolean>;
  /** Người dùng chọn "Bỏ thay đổi": xóa nháp cục bộ để lần sau không hỏi khôi phục. */
  discard: () => void;
}

export type LeaveChoice = 'save' | 'discard' | 'stay';

export interface NavigationGuard {
  /** Đăng ký form đang mở. Trả hàm hủy đăng ký (gọi khi unmount). */
  register(form: GuardedForm): () => void;
  /** Chạy `action` ngay nếu không có gì chưa lưu; nếu có thì giữ lại chờ người dùng chọn. */
  attempt(action: () => void): boolean;
  /** Có lần điều hướng nào đang chờ người dùng quyết định không. */
  isPending(): boolean;
  /** Đang lưu (sau khi chọn "Lưu rồi đi"). */
  isSaving(): boolean;
  /** Người dùng chọn trong dialog. Trả true nếu đã điều hướng. */
  resolve(choice: LeaveChoice): Promise<boolean>;
  subscribe(listener: () => void): () => void;
}

export function createNavigationGuard(): NavigationGuard {
  let form: GuardedForm | null = null;
  let pending: (() => void) | null = null;
  let saving = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const setPending = (p: (() => void) | null) => {
    pending = p;
    emit();
  };

  return {
    register(f) {
      form = f;
      return () => {
        if (form === f) form = null;
      };
    },
    attempt(action) {
      if (!form?.isDirty()) {
        action();
        return true;
      }
      setPending(action);
      return false;
    },
    isPending: () => pending !== null,
    isSaving: () => saving,
    async resolve(choice) {
      const action = pending;
      if (!action || saving) return false;
      if (choice === 'stay') {
        setPending(null);
        return false;
      }
      if (choice === 'discard') {
        form?.discard();
        setPending(null);
        action();
        return true;
      }
      saving = true;
      emit();
      let ok = false;
      try {
        ok = form ? await form.save() : true;
      } catch {
        ok = false;
      } finally {
        saving = false;
      }
      // Lưu lỗi/xung đột: ở lại trang để form hiện lỗi hoặc dialog xung đột.
      setPending(null);
      if (ok) action();
      return ok;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
