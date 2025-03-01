import type * as Fastify from "fastify";

type CallbackSession = (err: any, result?: Fastify.Session | null) => void;

export const InMemorySessionControl = {
  sessions: {},

  get(sid: string, cb: CallbackSession) {
    console.log("gettting sessionid ", sid);

    //@ts-ignore
    cb(null, this.sessions[sid]);
  },
  set(sid: string, session: Fastify.Session, cb: CallbackSession) {
    console.log("setting session id ", sid);
    //@ts-ignore
    this.sessions[sid] = session;
    cb(null);
  },
  destroy(sid: string, cb: CallbackSession) {
    //@ts-ignore
    delete this.sessions[sid];
    cb(null);
  },
};
