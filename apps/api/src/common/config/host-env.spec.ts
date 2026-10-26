import { hostDatabaseUrl } from './host-env';

describe('hostDatabaseUrl', () => {
  it('ghép URL từ POSTGRES_PASSWORD, mặc định port 5432', () => {
    expect(hostDatabaseUrl({ POSTGRES_PASSWORD: 'abc123' }, 'notebook')).toBe(
      'postgresql://notebook:abc123@127.0.0.1:5432/notebook',
    );
  });

  it('dùng POSTGRES_HOST_PORT và encode mật khẩu', () => {
    expect(
      hostDatabaseUrl({ POSTGRES_PASSWORD: 'p@ss/w', POSTGRES_HOST_PORT: '5434' }, 'notebook_test'),
    ).toBe('postgresql://notebook:p%40ss%2Fw@127.0.0.1:5434/notebook_test');
  });

  it('không có POSTGRES_PASSWORD thì trả undefined', () => {
    expect(hostDatabaseUrl({}, 'notebook')).toBeUndefined();
  });
});
