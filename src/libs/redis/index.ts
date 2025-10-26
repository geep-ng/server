import dotenv from 'dotenv';

import Redis from 'ioredis';
dotenv.config();

// Debug log to confirm the URI is loaded
// console.log('[REDIS ENV]', process.env.REDIS_DATABASE_URI);

// Initialize Redis client using the URI
const redis = new Redis(process.env.REDIS_DATABASE_URI!, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
});

// Optional: Add event listeners for better debugging
// redis.on('connect', () => {
//   console.log('✅ Redis connected successfully.');
// });

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

export default redis;
