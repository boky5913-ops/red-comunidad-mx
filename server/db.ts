import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { CommunityPost, InsertCommunityPost, InsertUser, communityPosts, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { canManageCommunityPost } from "../shared/community";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listCommunityPosts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(communityPosts).orderBy(desc(communityPosts.createdAt));
}

export async function createCommunityPost(data: InsertCommunityPost): Promise<CommunityPost> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(communityPosts).values(data);
  const created = await db.select().from(communityPosts).where(eq(communityPosts.id, Number(result[0].insertId))).limit(1);
  if (!created[0]) throw new Error("Community post could not be created");
  return created[0];
}

export async function listUserCommunityPosts(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(communityPosts).where(eq(communityPosts.ownerId, ownerId)).orderBy(desc(communityPosts.createdAt));
}

export async function updateUserCommunityPost(ownerId: number, id: number, data: Partial<InsertCommunityPost>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(communityPosts).set(data).where(and(eq(communityPosts.id, id), eq(communityPosts.ownerId, ownerId)));
  const result = await db.select().from(communityPosts).where(and(eq(communityPosts.id, id), eq(communityPosts.ownerId, ownerId))).limit(1);
  if (!result[0] || !canManageCommunityPost(ownerId, result[0].ownerId)) throw new Error("Post not found or not owned by user");
  return result[0];
}

export async function deleteUserCommunityPost(ownerId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(communityPosts).where(and(eq(communityPosts.id, id), eq(communityPosts.ownerId, ownerId))).limit(1);
  if (!result[0] || !canManageCommunityPost(ownerId, result[0].ownerId)) throw new Error("Post not found or not owned by user");
  await db.delete(communityPosts).where(and(eq(communityPosts.id, id), eq(communityPosts.ownerId, ownerId)));
  return { success: true as const };
}
