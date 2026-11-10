import { createClient } from 'redis';

function makeRedisClient() {
  return createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 4000,
      reconnectStrategy: (retries) => (retries > 2 ? false : Math.min(retries * 150, 500)),
    },
  });
}

type RedisClient = ReturnType<typeof makeRedisClient>;

const globalForRedis = globalThis as unknown as {
  redisClient?: RedisClient;
  redisConnectPromise?: Promise<RedisClient>;
};

export async function getRedis(): Promise<RedisClient> {
  if (globalForRedis.redisClient?.isOpen) {
    return globalForRedis.redisClient;
  }

  if (!globalForRedis.redisConnectPromise) {
    const client = makeRedisClient();

    client.on('error', (err) => {
      console.error('[Redis Client Error]:', err);
    });

    const connectPromise = client
      .connect()
      .then(() => {
        globalForRedis.redisClient = client;
        return client;
      })
      .finally(() => {
        globalForRedis.redisConnectPromise = undefined;
      });

    globalForRedis.redisConnectPromise = connectPromise;
    return connectPromise;
  }

  return globalForRedis.redisConnectPromise;
}

export function isAuthorizedCron(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
