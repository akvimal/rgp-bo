import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  host: process.env.DATABASE_HOST,
  ssl: process.env.DATABASE_SSL_ENABLED,
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  password: process.env.DATABASE_PASSWORD,
  name: process.env.DATABASE_NAME,
  username: process.env.DATABASE_USERNAME,
  dialect: process.env.DATABASE_TYPE,
  dialectOptions: {
    ssl: {
      require: process.env.DATABASE_SSL_ENABLED, // This will help you. But you will see nwe error
      rejectUnauthorized: process.env.DATABASE_REJECT_UNAUTHORIZED // This line will fix new error
    }
  },
  synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS, 10) || 100
}));
