/*
  Cookies:
    Porções de dado enviadas ao navegador.
    Útil para guardar tokens e preferências
    Útil para armazenar ids de sessão

  Sessões:
    Contextos que guardam dados em memória no lado do servidor para cada usuário que interage com a aplicação
    Útil para guardar dados temporários e confidenciais
    Possuem um id que vai ao browser por cookies



  req.sessionStore: {
    session1: {
      cookie: 131231,
      datay: 23423423
    },
    session2: {
      cookie: 655364
      datab: 680678
    }
  }

  session1.set("key1", value1);
  session2.set("key2", value2);
  session1.get("key1");
  session2.get("key2")

  o req.session contém o objeto de sessão em relação à sessão do cookie enviado do browser
  é como se fosse:

    req.session = req.sessionStore.get({sessionId do cookie enviado pelo browser}, (err, r) => {
      if(r) return r;
    })

  session1 e session2 são os ids de sessão que são enviados ao browser
  o browser envia de volta, e o servido realiza um: req.sessionStore.get(session1|session2)
  assim é possível acessar os dados da sessão do cookie enviado

  A sessionStore, por padrão, é literalmente um hashmap/cache em memória,
  sendo possível extender para caches escaláveis, como redis
*/

import fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import crypto, { randomUUID } from "crypto";
import { dbClient, setupDb } from "./infra/db-connection";
import { InMemorySessionControl } from "./infra/in-memory-session-managing";
import { redisClient } from "./infra/redis-connection";
import { RedisSessionControl } from "./infra/redis-session-managing";

declare module "fastify" {
  interface Session {
    loggedUser: any;
    userId: string;
  }
}

declare module "@fastify/session" {
  interface SessionStore {
    sessions?: Object;
  }
}

export const jwtSecret = "jwtSecret";
const app = fastify({
  logger: {
    enabled: true,
    level: "info",
    timestamp: true,
  },
});

app.register(fastifyCookie, {});
app.register(fastifySession, {
  secret: crypto.randomBytes(20).toString("hex"),
  cookie: {
    maxAge: 1000 * 60 * 15,
    httpOnly: true,
    secure: false,
  },
  cookieName: "sessionId",
  /* store: InMemorySessionControl, */
  store: RedisSessionControl,
});

dbClient
  .connect()
  .then(() => {
    console.log("connected to db");
  })
  .catch((err) => {
    console.error("failed to connect to db");
    process.exit(0);
  });

setupDb().then(() => {
  console.log("database set up");
});

app.register(require("./api/routes"));

app
  .listen({
    port: 3000,
  })
  .then(() => {
    console.log("App running on port 3000");
  });
