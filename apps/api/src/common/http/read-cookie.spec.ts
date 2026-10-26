import { readCookie } from './read-cookie';

describe('readCookie', () => {
  it('finds a cookie among others', () => {
    expect(readCookie('a=1; nb_session=v1.2.abc; b=3', 'nb_session')).toBe('v1.2.abc');
    expect(readCookie('nb_session=x', 'nb_session')).toBe('x');
  });

  it('returns undefined when missing or header is absent', () => {
    expect(readCookie(undefined, 'nb_session')).toBeUndefined();
    expect(readCookie('', 'nb_session')).toBeUndefined();
    expect(readCookie('xnb_session=1; nb_sessionx=2', 'nb_session')).toBeUndefined();
  });

  it('decodes URI encoding and does not throw on malformed encoding', () => {
    expect(readCookie('k=a%20b', 'k')).toBe('a b');
    expect(readCookie('k=%E0%A4%A', 'k')).toBe('%E0%A4%A');
  });
});
