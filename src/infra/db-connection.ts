import pg, { Client } from "pg";

export const dbClient = new Client({
  user: "postgres",
  password: "postgres",
  port: 5435,
  database: "session-control",
  host: "localhost",
});

export async function setupDb() {
  dbClient.query(`
    create table if not exists users(
      id UUID default gen_random_uuid(),
      name varchar(255) not null,
      password varchar(255) not null
    )  
  `);
}
