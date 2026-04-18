import supertest, { type SuperTest, type Test } from "supertest";
import type express from "express";
import { buildApp } from "../../server/app-factory.js";

let cachedApp: express.Express | null = null;

export async function getApp(): Promise<express.Express> {
  if (!cachedApp) {
    cachedApp = await buildApp();
  }
  return cachedApp;
}

export async function createClient(): Promise<SuperTest<Test>> {
  return supertest(await getApp());
}

export async function login(agent: ReturnType<typeof supertest.agent>, email: string, password = "Password1234") {
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed ${res.status}: ${JSON.stringify(res.body)}`);
  return res;
}
