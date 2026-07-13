import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** مسیرهایی که نیاز به احراز هویت ندارند. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
