import fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import crypto from "crypto";
import { dbClient, setupDb } from "./infra/db-connection";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

/*
  Cookies:
    Armazenar tokens de autenticação (ex.: JWT).
    Guardar preferências do usuário (ex.: tema claro/escuro).
    Rastrear sessões com um sessionId.
*/

declare module "fastify" {
  interface Session {
    loggedUser: any;
  }
}

const app = fastify({});
app.register(fastifyCookie, {});
app.register(fastifySession, {
  secret: crypto.randomBytes(20).toString("hex"),
  cookie: {
    maxAge: 60 * 2 * 1000,
    httpOnly: true,
    secure: false,
  },
  cookieName: "custom-session-id",
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
    res.status(403).send("Failed to login");
  }

  const token = jwt.sign(
    {
      userId: storedUser.rows[0].id,
    },
    "token-secret",
    {
      algorithm: "HS256",
      expiresIn: "15m",
      issuer: "session-control-backend",
      audience: "client",
    }
  );

  req.session.set("loggedUser", storedUser.rows[0]);
  return res.status(200).send({
    accessToken: token,
  });
});

app.get("/userinfo", async (req, res) => {
  console.log(req.session.get("loggedUser"));
  console.log(req.cookies);
  res.status(200).send();
});

app
  .listen({
    port: 3000,
  })
  .then(() => {
    console.log("App running on port 3000");
  });
