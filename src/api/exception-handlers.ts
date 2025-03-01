import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

export const jwtExceptionHandler = (
  err: Error,
  req: FastifyRequest,
  rep: FastifyReply
) => {
  if (err instanceof jwt.JsonWebTokenError) {
    rep.send("Authorization error: " + err.message);
  }
};
