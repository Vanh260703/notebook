import type { LoginInput, Session } from '@notebook/shared';
import { apiFetch } from './client';

export const getSession = () => apiFetch<Session>('/auth/me');
export const login = (input: LoginInput) =>
  apiFetch<Session>('/auth/login', { method: 'POST', body: input });
export const logout = () => apiFetch<void>('/auth/logout', { method: 'POST' });
