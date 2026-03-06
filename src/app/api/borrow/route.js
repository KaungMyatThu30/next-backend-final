import { ObjectId } from "mongodb";
import { ROLE, badRequest, readJsonBody, requireAuth, requireRole } from "@/lib/auth";
import { getCorsHeaders } from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";

const DB_NAME = process.env.MONGODB_DB || "library_management";
const BOOK_COLLECTION = process.env.BOOK_COLLECTION || "books";
const BORROW_COLLECTION = process.env.BORROW_COLLECTION || "borrows";

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
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const query = auth.user.role === ROLE.ADMIN ? {} : { userId: String(auth.user.id) };
    const result = await db.collection(BORROW_COLLECTION).find(query).sort({ createdAt: -1 }).toArray();
    const normalized = result.map((item) => ({
      ...item,
      _id: String(item._id),
      requestStatus: item.requestStatus || item.status || "INIT",
      // Keep legacy compatibility for frontend that still reads `status`.
      status: item.requestStatus || item.status || "INIT",
    }));

    return NextResponse.json(normalized, {
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
  const auth = requireRole(req, ROLE.USER);
  if (auth.error) {
    return auth.error;
  }

  const parsedBody = await readJsonBody(req);
  if (parsedBody.error) {
    return parsedBody.error;
  }

  const payload = parsedBody.data;
  const { bookId, targetDate } = payload;

  if (!bookId || !targetDate) {
    return badRequest(req, "Missing bookId or targetDate");
  }
  if (!ObjectId.isValid(bookId)) {
    return badRequest(req, "Invalid bookId");
  }

  const pickupDate = new Date(targetDate);
  if (Number.isNaN(pickupDate.getTime())) {
    return badRequest(req, "Invalid targetDate");
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const book = await db.collection(BOOK_COLLECTION).findOne({ _id: new ObjectId(bookId), status: { $ne: "DELETED" } });

    if (!book) {
      return NextResponse.json({
        message: "Book not found"
      }, {
        status: 404,
        headers: getCorsHeaders(req),
      });
    }

    const now = new Date();
    let requestStatus = "INIT";

    if ((book.quantity || 0) <= 0) {
      requestStatus = "CLOSE-NO-AVAILABLE-BOOK";
    } else {
      requestStatus = "ACCEPTED";
      await db.collection(BOOK_COLLECTION).updateOne(
        { _id: new ObjectId(bookId), quantity: { $gt: 0 } },
        {
          $inc: { quantity: -1 },
          $set: { updatedAt: now, updatedBy: auth.user.email },
        }
      );
    }

    const insertResult = await db.collection(BORROW_COLLECTION).insertOne({
      userId: String(auth.user.id),
      userEmail: auth.user.email,
      bookId: String(book._id),
      bookTitle: book.title,
      createdAt: now,
      targetDate: pickupDate,
      requestStatus,
      statusHistory: [
        { status: "INIT", at: now },
        ...(requestStatus !== "INIT" ? [{ status: requestStatus, at: now }] : []),
      ],
    });

    return NextResponse.json({
      id: insertResult.insertedId,
      requestStatus,
      // Keep legacy compatibility for frontend that still reads `status`.
      status: requestStatus,
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
