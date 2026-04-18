import supertest, { type SuperTest, type Test } from "supertest";
import { buildApp } from "../../server/app-factory.js";

export async function createClient(): Promise<SuperTest<Test>> {
  const app = await buildApp();
  return supertest(app);
}

export async function login(agent: ReturnType<typeof supertest.agent>, email: string, password = "Password1234") {
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed ${res.status}: ${JSON.stringify(res.body)}`);
  return res;
}
