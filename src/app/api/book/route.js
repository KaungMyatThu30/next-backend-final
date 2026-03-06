// TODO: Students must implement CRUD for Book here, similar to Item.
// Example: GET (list all books), POST (create book)

import { ROLE, badRequest, requireAuth, requireRole } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";

const DB_NAME = process.env.MONGODB_DB || "library_management";
const BOOK_COLLECTION = process.env.BOOK_COLLECTION || "books";

export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
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

    return NextResponse.json(books, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (_) {
    return NextResponse.json({
      message: "Internal server error"
    }, {
      status: 500,
      headers: corsHeaders,
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
    return badRequest("Missing mandatory data");
  }

  const parsedQty = Number(quantity);
  if (!Number.isInteger(parsedQty) || parsedQty < 0) {
    return badRequest("Quantity must be a non-negative integer");
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
      headers: corsHeaders,
    });
  } catch (_) {
    return NextResponse.json({
      message: "Internal server error"
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
