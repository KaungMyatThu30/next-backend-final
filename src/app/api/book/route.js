// TODO: Students must implement CRUD for Book here, similar to Item.
// Example: GET (list all books), POST (create book)

import { ROLE, badRequest, requireAuth, requireRole } from "@/lib/auth";
import { getCorsHeaders } from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";

const DB_NAME = process.env.MONGODB_DB || "library_management";
const BOOK_COLLECTION = process.env.BOOK_COLLECTION || "books";

export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(req),
  });
}

export async function GET(req) {
  const auth = requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title");
    const author = searchParams.get("author");
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const query = {};
    if (title) {
      query.title = { $regex: title, $options: "i" };
    }
    if (author) {
      query.author = { $regex: author, $options: "i" };
    }

    if (auth.user.role !== ROLE.ADMIN || !includeDeleted) {
      query.status = { $ne: "DELETED" };
    }

    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const books = await db.collection(BOOK_COLLECTION).find(query).sort({ createdAt: -1 }).toArray();
    const normalizedBooks = books.map((book) => ({
      ...book,
      _id: String(book._id),
    }));

    return NextResponse.json(normalizedBooks, {
      status: 200,
      headers: getCorsHeaders(req),
    });
  } catch (_) {
    return NextResponse.json({
      message: "Internal server error"
    }, {
      status: 500,
      headers: getCorsHeaders(req),
    });
  }
}

export async function POST(req) {
  const auth = requireRole(req, ROLE.ADMIN);
  if (auth.error) {
    return auth.error;
  }

  const data = await req.json();
  const { title, author, quantity, location } = data;

  if (!title || !author || quantity === undefined || !location) {
    return badRequest(req, "Missing mandatory data");
  }

  const parsedQty = Number(quantity);
  if (!Number.isInteger(parsedQty) || parsedQty < 0) {
    return badRequest(req, "Quantity must be a non-negative integer");
  }

  try {
    const now = new Date();
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const result = await db.collection(BOOK_COLLECTION).insertOne({
      title,
      author,
      quantity: parsedQty,
      location,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      createdBy: auth.user.email,
    });

    return NextResponse.json({
      id: result.insertedId,
      message: "Book created"
    }, {
      status: 201,
      headers: getCorsHeaders(req),
    });
  } catch (_) {
    return NextResponse.json({
      message: "Internal server error"
    }, {
      status: 500,
      headers: getCorsHeaders(req),
    });
  }
}
