import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../main";

export const jwtAuthorizationMiddleware = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  const bearerToken = req.headers.authorization as string;
  if (!bearerToken) res.status(403).send("Not Authorized");
  const raw = bearerToken.split("Bearer ")[1];
  jwt.verify(raw, jwtSecret);
};
