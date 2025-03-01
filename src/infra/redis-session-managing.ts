import { SessionStore } from "@fastify/session";
import { redisClient } from "./redis-connection";
import type * as Fastify from "fastify";

export const RedisSessionControl: SessionStore = {
  sessions: {},
  
  get(sid: string, cb: any) {
    redisClient.get(sid, (err, r) => {
      if(err) return cb(err, r);
      cb(null, JSON.parse(r as string));
    });
  },
  set(sid: string, session: Fastify.Session, cb: any) {
    console.log(session.loggedUser);
    redisClient.set(sid, JSON.stringify(session), "EX", 60 * 60, cb);
  },
  destroy(sid: string, cb: any) {
    redisClient.del(sid, cb);
  },
};
