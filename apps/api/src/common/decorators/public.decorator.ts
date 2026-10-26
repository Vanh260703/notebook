import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route không cần đăng nhập (bỏ qua SessionGuard toàn cục). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
