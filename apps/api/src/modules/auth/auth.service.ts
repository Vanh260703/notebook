import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AUTH_CONFIG, type AuthConfig } from '../../common/config/auth-env';

const sha256 = (s: string): Buffer => createHash('sha256').update(s, 'utf8').digest();

@Injectable()
export class AuthService {
  /** Băm một lần. So sánh hai digest 32 byte nên độ dài mật khẩu không lộ qua thời gian. */
  private readonly expected: Buffer;

  constructor(@Inject(AUTH_CONFIG) cfg: AuthConfig) {
    this.expected = sha256(cfg.appPassword.normalize('NFC'));
  }

  checkPassword(input: string): boolean {
    return timingSafeEqual(sha256(input.normalize('NFC')), this.expected);
  }
}
