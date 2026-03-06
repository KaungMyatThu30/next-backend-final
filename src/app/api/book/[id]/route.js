// TODO: Students must implement CRUD for Book here, similar to Item.
// Example: GET (get book by id), PATCH (update), DELETE (remove)

import { ObjectId } from "mongodb";
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

export async function GET(req, { params }) {
  const auth = requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  const id = params?.id;
  if (!ObjectId.isValid(id)) {
    return badRequest("Invalid id");
  }

  try {
    const query = { _id: new ObjectId(id) };
    if (auth.user.role !== ROLE.ADMIN) {
      query.status = { $ne: "DELETED" };
    }

    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const book = await db.collection(BOOK_COLLECTION).findOne(query);
    if (!book) {
      return NextResponse.json({
        message: "Book not found"
      }, {
        status: 404,
        headers: corsHeaders,
      });
    }
    return NextResponse.json(book, {
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

export async function PATCH(req, { params }) {
  const auth = requireRole(req, ROLE.ADMIN);
  if (auth.error) {
    return auth.error;
  }

  const id = params?.id;
  if (!ObjectId.isValid(id)) {
    return badRequest("Invalid id");
  }

  const data = await req.json();
  const update = {};

  if (data.title !== undefined) {
    update.title = String(data.title).trim();
  }
  if (data.author !== undefined) {
    update.author = String(data.author).trim();
  }
  if (data.location !== undefined) {
    update.location = String(data.location).trim();
  }
  if (data.quantity !== undefined) {
    const parsedQty = Number(data.quantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 0) {
      return badRequest("Quantity must be a non-negative integer");
    }
    update.quantity = parsedQty;
  }

  if (Object.keys(update).length === 0) {
    return badRequest("No valid field to update");
  }

  update.updatedAt = new Date();
  update.updatedBy = auth.user.email;

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const result = await db.collection(BOOK_COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );

    if (!result.matchedCount) {
      return NextResponse.json({
        message: "Book not found"
      }, {
        status: 404,
        headers: corsHeaders,
      });
    }

    return NextResponse.json({ message: "Book updated" }, {
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

export async function DELETE(req, { params }) {
  const auth = requireRole(req, ROLE.ADMIN);
  if (auth.error) {
    return auth.error;
  }

  const id = params?.id;
  if (!ObjectId.isValid(id)) {
    return badRequest("Invalid id");
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const result = await db.collection(BOOK_COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "DELETED",
          updatedAt: new Date(),
          updatedBy: auth.user.email,
        },
      }
    );
    if (!result.matchedCount) {
      return NextResponse.json({
        message: "Book not found"
      }, {
        status: 404,
        headers: corsHeaders,
      });
    }
    return NextResponse.json({ message: "Book deleted" }, {
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
