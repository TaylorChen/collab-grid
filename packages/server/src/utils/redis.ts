import { createClient, RedisClientType } from "redis";

let client: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType | null> {
  if (client) return client;
  try {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    const c = createClient({ url });
    await c.connect();
    client = c;
    return client;
  } catch {
    return null;
  }
}


