
// REFERENCE: This file is provided as an example for creating indexes.
// Students must add a similar index for the Book collection as required in the exam.
import { getClientPromise } from "@/lib/mongodb";
import bcrypt from "bcrypt";

const DB_NAME = process.env.MONGODB_DB || "library_management";
const USER_COLLECTION = process.env.USER_COLLECTION || "users";
const BOOK_COLLECTION = process.env.BOOK_COLLECTION || "books";
const BORROW_COLLECTION = process.env.BORROW_COLLECTION || "borrows";

export async function ensureIndexes() {
  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  const userCollection = db.collection(USER_COLLECTION);
  const bookCollection = db.collection(BOOK_COLLECTION);
  const borrowCollection = db.collection(BORROW_COLLECTION);

  await userCollection.createIndex({ email: 1 }, { unique: true });
  await userCollection.createIndex({ username: 1 }, { unique: true, sparse: true });

  await bookCollection.createIndex({ status: 1 });
  await bookCollection.createIndex({ title: 1 });
  await bookCollection.createIndex({ author: 1 });

  await borrowCollection.createIndex({ userId: 1, createdAt: -1 });
  await borrowCollection.createIndex({ bookId: 1 });

  const adminEmail = "admin@test.com";
  const userEmail = "user@test.com";
  const now = new Date();

  await userCollection.updateOne(
    { email: adminEmail },
    {
      $set: {
        username: "admin",
        firstname: "Admin",
        lastname: "User",
        role: "ADMIN",
        status: "ACTIVE",
        updatedAt: now,
      },
      $setOnInsert: {
        email: adminEmail,
        password: await bcrypt.hash("admin123", 10),
        createdAt: now,
      },
    },
    { upsert: true }
  );

  await userCollection.updateOne(
    { email: userEmail },
    {
      $set: {
        username: "user",
        firstname: "Normal",
        lastname: "User",
        role: "USER",
        status: "ACTIVE",
        updatedAt: now,
      },
      $setOnInsert: {
        email: userEmail,
        password: await bcrypt.hash("user123", 10),
        createdAt: now,
      },
    },
    { upsert: true }
  );
}
