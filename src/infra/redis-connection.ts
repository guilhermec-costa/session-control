import Redis from "ioredis";

export const redisClient = new Redis({
  port: 6380,
  host: "localhost",
});
