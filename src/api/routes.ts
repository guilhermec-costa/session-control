import { FastifyInstance } from "fastify";
import { z } from "zod";
import { dbClient } from "../infra/db-connection";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../main";
import { jwtExceptionHandler } from "./exception-handlers";
import { jwtAuthorizationMiddleware } from "./middlewares";
import { randomUUID } from "crypto";
import { redisClient } from "../infra/redis-connection";

export default function (fastify: FastifyInstance, opts: any, done: Function) {
  fastify.post("/register", async (req, res) => {
    const registerSchema = z.object({
      username: z.string(),
      password: z.string(),
    });

    const user = registerSchema.parse(req.body);
    const registerPayload = req.body;

    const passwordHash = await bcrypt.hash(user.password, 10);
    await dbClient.query(
      "insert into users (name, password) values ($1, $2);",
      [user.username, passwordHash]
    );
    res.status(201).send(registerPayload);
  });

  fastify.post("/login", async (req, res) => {
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
  
    const userId = storedUser.rows[0].id;
    const sessionId = await redisClient.get(userId);
  
    if(sessionId) {
      return res.status(500).send("User already has a active session");
    }

    req.session.set("loggedUser", storedUser.rows[0]);
    req.session.set("userId", userId);
    await redisClient.set(userId, req.session.sessionId);

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
  
  fastify.get(
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

  fastify.get("/logout", async (req,res) => {
    const userId = req.session.userId;
    await redisClient.del(userId);
    req.session.destroy((err) => {
      if (err) return res.status(500).send('Error logging out');
      res.send({ message: 'Logged out successfully' });
    });

  });

  fastify.get(
    "/getLoggedUser",
    {
      preHandler: [jwtAuthorizationMiddleware],
    },
    async (req, res) => {
      res.status(200).send(req.session.get("loggedUser"));
    }
  );

  fastify.get("/getMySessionStore", async (req, res) => {
    res.status(200).send(req.sessionStore);
  });

  done();
}
