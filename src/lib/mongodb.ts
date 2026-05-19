import "server-only";

import { Db, MongoClient } from "mongodb";
import { serverEnv } from "@/lib/server-env";

const uri = serverEnv.MONGODB_URI;

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global.mongoClientPromise) {
    const client = new MongoClient(uri);
    global.mongoClientPromise = client.connect();
  }
  clientPromise = global.mongoClientPromise;
} else {
  const client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getMongoClient(): Promise<MongoClient> {
  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(serverEnv.MONGODB_DB_NAME);
}

export async function pingMongo(): Promise<boolean> {
  const db = await getMongoDb();
  const result = await db.command({ ping: 1 });
  return result?.ok === 1;
}
