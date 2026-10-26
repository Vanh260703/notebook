import { describe, expect, it, vi } from 'vitest';
import { createNavigationGuard, type GuardedForm } from './navigation-guard';

function form(overrides: Partial<GuardedForm> & { dirty?: boolean } = {}) {
  let dirty = overrides.dirty ?? true;
  const f = {
    isDirty: vi.fn(() => dirty),
    save: overrides.save ?? vi.fn(async () => true),
    discard: vi.fn(() => {
      dirty = false;
    }),
  };
  return f;
}

describe('navigation guard', () => {
  it('runs the action immediately when no form is registered or the form is clean', () => {
    const g = createNavigationGuard();
    const go = vi.fn();
    expect(g.attempt(go)).toBe(true);
    g.register(form({ dirty: false }));
    expect(g.attempt(go)).toBe(true);
    expect(go).toHaveBeenCalledTimes(2);
    expect(g.isPending()).toBe(false);
  });

  it('holds the action while dirty; "stay" drops it', async () => {
    const g = createNavigationGuard();
    g.register(form());
    const go = vi.fn();
    const listener = vi.fn();
    g.subscribe(listener);
    expect(g.attempt(go)).toBe(false);
    expect(g.isPending()).toBe(true);
    expect(listener).toHaveBeenCalled();
    expect(await g.resolve('stay')).toBe(false);
    expect(go).not.toHaveBeenCalled();
    expect(g.isPending()).toBe(false);
  });

  it('"discard" clears the draft then navigates', async () => {
    const g = createNavigationGuard();
    const f = form();
    g.register(f);
    const go = vi.fn();
    g.attempt(go);
    expect(await g.resolve('discard')).toBe(true);
    expect(f.discard).toHaveBeenCalledOnce();
    expect(go).toHaveBeenCalledOnce();
  });

  it('"save" navigates only after a successful save', async () => {
    const g = createNavigationGuard();
    let finish!: (ok: boolean) => void;
    const f = form({ save: () => new Promise<boolean>((r) => (finish = r)) });
    g.register(f);
    const go = vi.fn();
    g.attempt(go);
    const result = g.resolve('save');
    expect(g.isSaving()).toBe(true);
    // Bấm lại trong lúc đang lưu thì bỏ qua.
    expect(await g.resolve('discard')).toBe(false);
    finish(true);
    expect(await result).toBe(true);
    expect(go).toHaveBeenCalledOnce();
    expect(g.isSaving()).toBe(false);
    expect(g.isPending()).toBe(false);
  });

  it('stays on the page when saving fails or throws (conflict dialog / error shows in the form)', async () => {
    for (const save of [async () => false, async () => Promise.reject(new Error('net'))]) {
      const g = createNavigationGuard();
      g.register(form({ save }));
      const go = vi.fn();
      g.attempt(go);
      expect(await g.resolve('save')).toBe(false);
      expect(go).not.toHaveBeenCalled();
      expect(g.isPending()).toBe(false);
      expect(g.isSaving()).toBe(false);
    }
  });

  it('unregistering stops guarding; a stale unregister does not remove a newer form', () => {
    const g = createNavigationGuard();
    const unregisterA = g.register(form());
    g.register(form()); // form B thay thế A (chuyển note)
    unregisterA();
    expect(g.attempt(vi.fn())).toBe(false);
    const g2 = createNavigationGuard();
    const unregister = g2.register(form());
    unregister();
    expect(g2.attempt(vi.fn())).toBe(true);
  });

  it('resolve without a pending action is a no-op', async () => {
    const g = createNavigationGuard();
    const f = form();
    g.register(f);
    expect(await g.resolve('save')).toBe(false);
    expect(f.save).not.toHaveBeenCalled();
  });
});
