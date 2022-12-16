import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  secret: process.env.JWT_KEY,
  expires: process.env.JWT_EXPIRES,
}));
