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
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { jwtExceptionHandler } from "./api/exception-handlers";
import { jwtAuthorizationMiddleware } from "./api/middlewares";
import { InMemorySessionControl } from "./infra/in-memory-session-managing";

declare module "fastify" {
  interface Session {
    loggedUser: any;
  }
}

declare module "@fastify/session" {
  interface SessionStore {
    sessions: Object;
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
  cookieName: "custom-session-id",
  store: InMemorySessionControl,
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

app.post("/register", async (req, res) => {
  const registerSchema = z.object({
    username: z.string(),
    password: z.string(),
  });

  const user = registerSchema.parse(req.body);
  const registerPayload = req.body;

  const passwordHash = await bcrypt.hash(user.password, 10);
  await dbClient.query("insert into users (name, password) values ($1, $2);", [
    user.username,
    passwordHash,
  ]);
  res.status(201).send(registerPayload);
});

app.post("/login", async (req, res) => {
  const loginSchema = z.object({
    username: z.string(),
    password: z.string(),
  });

  const user = loginSchema.parse(req.body);
  const storedUser = await dbClient.query(
    "select * from users u where u.name = $1",
    [user.username]
  );

  const pwdMatches = await bcrypt.compare(
    user.password,
    storedUser.rows[0].password
  );

  if (!storedUser.rowCount || !pwdMatches) {
    res.status(403).send("Failed to authenticate");
  }

  req.session.set("loggedUser", storedUser.rows[0]);
  const token = jwt.sign(
    {
      userId: storedUser.rows[0].id,
    },
    jwtSecret,
    {
      algorithm: "HS256",
      expiresIn: "15m",
      issuer: "session-control-backend",
      audience: "client",
    }
  );

  return res.status(200).send({
    accessToken: token,
  });
});

app.get(
  "/products",
  {
    errorHandler: jwtExceptionHandler,
    preHandler: [jwtAuthorizationMiddleware],
  },
  async (req, res) => {
    res.status(200).send({
      data: [
        {
          id: randomUUID(),
          name: "Smartphone",
          price: 1500,
        },
      ],
    });
  }
);

app.get(
  "/getLoggedUser",
  {
    preHandler: [jwtAuthorizationMiddleware],
  },
  async (req, res) => {
    res.status(200).send(req.session.get("loggedUser"));
  }
);

app.get("/getMySessionStore", async (req, res) => {
  res.status(200).send(req.sessionStore);
});

app
  .listen({
    port: 3000,
  })
  .then(() => {
    console.log("App running on port 3000");
  });
