import { makeSqliteStore } from "./sqlite.js";
import { makePrismaStore } from "./prisma.js";

export async function makeStore({ provider, databaseUrl }) {
  if (!provider || provider === "sqlite") {
    return makeSqliteStore(databaseUrl);
  }
  if (provider === "mysql" || provider === "mariadb") {
    return await makePrismaStore(databaseUrl);
  }
  throw new Error(`Unsupported DB_PROVIDER: ${provider}`);
}
