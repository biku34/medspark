/**
 * Data layer.
 *
 * Two interchangeable drivers behind one tiny interface:
 *
 *   • "mongo"  — MongoDB Atlas, used when MONGODB_URI is set.
 *   • "memory" — in-process store seeded with demo data, used otherwise.
 *
 * Route handlers only ever talk to `Store`, so swapping the driver (or later
 * replacing it with a real service layer) touches nothing else.
 */

import type { Collection, Db, Document, MongoClient as MongoClientType } from "mongodb";
import { buildSeed } from "./seed";

export type CollectionName =
  | "users"
  | "medicines"
  | "pharmacies"
  | "inventory"
  | "orders"
  | "prescriptions"
  | "notifications"
  | "searchLogs"
  | "stockAlerts";

export const COLLECTIONS: CollectionName[] = [
  "users",
  "medicines",
  "pharmacies",
  "inventory",
  "orders",
  "prescriptions",
  "notifications",
  "searchLogs",
  "stockAlerts",
];

export type Filter = Record<string, unknown>;

export interface Store {
  kind: "mongo" | "memory";
  list<T>(collection: CollectionName, filter?: Filter): Promise<T[]>;
  one<T>(collection: CollectionName, filter: Filter): Promise<T | null>;
  insert<T extends { id: string }>(collection: CollectionName, doc: T): Promise<T>;
  update<T extends { id: string }>(
    collection: CollectionName,
    id: string,
    patch: Partial<T>,
  ): Promise<T | null>;
  remove(collection: CollectionName, id: string): Promise<boolean>;
  resetAll(data: Partial<Record<CollectionName, unknown[]>>): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* matching helpers (shared by the memory driver)                             */
/* -------------------------------------------------------------------------- */

function matches(doc: Record<string, unknown>, filter: Filter): boolean {
  for (const [key, expected] of Object.entries(filter)) {
    const actual = doc[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const op = expected as Record<string, unknown>;
      if ("$in" in op) {
        const list = op.$in as unknown[];
        if (!list.includes(actual)) return false;
        continue;
      }
      if ("$ne" in op) {
        if (actual === op.$ne) return false;
        continue;
      }
    }
    if (actual !== expected) return false;
  }
  return true;
}

const clone = <T,>(v: T): T => (typeof structuredClone === "function"
  ? structuredClone(v)
  : (JSON.parse(JSON.stringify(v)) as T));

/* -------------------------------------------------------------------------- */
/* memory driver                                                              */
/* -------------------------------------------------------------------------- */

type MemoryData = Record<CollectionName, Record<string, unknown>[]>;

declare global {
  // eslint-disable-next-line no-var
  var __medsparkMemory: MemoryData | undefined;
  // eslint-disable-next-line no-var
  var __medsparkMongo: Promise<MongoClientType> | undefined;
}

function emptyData(): MemoryData {
  return COLLECTIONS.reduce((acc, name) => {
    acc[name] = [];
    return acc;
  }, {} as MemoryData);
}

function memoryData(): MemoryData {
  if (!globalThis.__medsparkMemory) {
    globalThis.__medsparkMemory = emptyData();
  }
  return globalThis.__medsparkMemory;
}

const memoryStore: Store = {
  kind: "memory",
  async list<T>(collection: CollectionName, filter: Filter = {}) {
    return memoryData()[collection].filter((d) => matches(d, filter)).map(clone) as T[];
  },
  async one<T>(collection: CollectionName, filter: Filter) {
    const found = memoryData()[collection].find((d) => matches(d, filter));
    return found ? (clone(found) as T) : null;
  },
  async insert<T extends { id: string }>(collection: CollectionName, doc: T) {
    memoryData()[collection].push(clone(doc) as Record<string, unknown>);
    return doc;
  },
  async update<T extends { id: string }>(
    collection: CollectionName,
    id: string,
    patch: Partial<T>,
  ) {
    const rows = memoryData()[collection];
    const idx = rows.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...clone(patch) } as Record<string, unknown>;
    return clone(rows[idx]) as T;
  },
  async remove(collection: CollectionName, id: string) {
    const rows = memoryData()[collection];
    const idx = rows.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    return true;
  },
  async resetAll(data) {
    const fresh = emptyData();
    for (const name of COLLECTIONS) {
      fresh[name] = clone((data[name] ?? []) as Record<string, unknown>[]);
    }
    globalThis.__medsparkMemory = fresh;
  },
};

/* -------------------------------------------------------------------------- */
/* mongo driver                                                               */
/* -------------------------------------------------------------------------- */

async function mongoDb(): Promise<Db> {
  const { MongoClient } = await import("mongodb");
  const uri = process.env.MONGODB_URI!;
  if (!globalThis.__medsparkMongo) {
    globalThis.__medsparkMongo = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    }).connect();
  }
  const client = await globalThis.__medsparkMongo;
  return client.db(process.env.MONGODB_DB || "medspark");
}

async function col(name: CollectionName): Promise<Collection<Document>> {
  return (await mongoDb()).collection(name);
}

/** Mongo adds `_id`; the app only knows about `id`. */
function strip<T>(doc: Document | null): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  void _id;
  return rest as T;
}

const mongoStore: Store = {
  kind: "mongo",
  async list<T>(collection: CollectionName, filter: Filter = {}) {
    const docs = await (await col(collection)).find(filter).toArray();
    return docs.map((d) => strip<T>(d)!) as T[];
  },
  async one<T>(collection: CollectionName, filter: Filter) {
    return strip<T>(await (await col(collection)).findOne(filter));
  },
  async insert<T extends { id: string }>(collection: CollectionName, doc: T) {
    await (await col(collection)).insertOne({ ...doc } as Document);
    return doc;
  },
  async update<T extends { id: string }>(
    collection: CollectionName,
    id: string,
    patch: Partial<T>,
  ) {
    const c = await col(collection);
    await c.updateOne({ id }, { $set: patch as Document });
    return strip<T>(await c.findOne({ id }));
  },
  async remove(collection: CollectionName, id: string) {
    const res = await (await col(collection)).deleteOne({ id });
    return res.deletedCount > 0;
  },
  async resetAll(data) {
    const db = await mongoDb();
    for (const name of COLLECTIONS) {
      const c = db.collection(name);
      await c.deleteMany({});
      const rows = (data[name] ?? []) as Document[];
      if (rows.length) await c.insertMany(rows.map((r) => ({ ...r })));
    }
    // Indexes that matter for the hyperlocal lookups.
    await db.collection("inventory").createIndex({ pharmacyId: 1, medicineId: 1 });
    await db.collection("orders").createIndex({ customerId: 1, createdAt: -1 });
    await db.collection("orders").createIndex({ pharmacyId: 1, status: 1 });
    await db.collection("prescriptions").createIndex({ status: 1, createdAt: -1 });
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
  },
};

/* -------------------------------------------------------------------------- */
/* entry point                                                                */
/* -------------------------------------------------------------------------- */

let seedPromise: Promise<void> | null = null;

export function driverName(): "mongo" | "memory" {
  return process.env.MONGODB_URI ? "mongo" : "memory";
}

/** Returns the active store, seeding demo data on first use. */
export async function getStore(): Promise<Store> {
  const store = driverName() === "mongo" ? mongoStore : memoryStore;
  if (!seedPromise) {
    seedPromise = (async () => {
      const users = await store.list("users");
      if (users.length === 0) await store.resetAll(buildSeed());
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;
  return store;
}

/** Wipes and re-seeds. Used by /api/seed and the "Reset demo data" button. */
export async function reseed(): Promise<void> {
  const store = driverName() === "mongo" ? mongoStore : memoryStore;
  await store.resetAll(buildSeed());
  seedPromise = Promise.resolve();
}
