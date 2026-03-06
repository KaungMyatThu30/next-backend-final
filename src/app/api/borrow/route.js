import { ObjectId } from "mongodb";
import { ROLE, badRequest, requireAuth, requireRole } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";

const DB_NAME = process.env.MONGODB_DB || "library_management";
const BOOK_COLLECTION = process.env.BOOK_COLLECTION || "books";
const BORROW_COLLECTION = process.env.BORROW_COLLECTION || "borrows";

const BORROW_STATUS = {
  INIT: "INIT",
  CLOSE_NO_AVAILABLE_BOOK: "CLOSE-NO-AVAILABLE-BOOK",
  ACCEPTED: "ACCEPTED",
  CANCEL_ADMIN: "CANCEL-ADMIN",
  CANCEL_USER: "CANCEL-USER",
};

export async function OPTIONS() {
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
    const client = await getClientPromise();
    const db = client.db(DB_NAME);

    const query = auth.user.role === ROLE.ADMIN
      ? {}
      : { userId: String(auth.user.id) };

    const requests = await db
      .collection(BORROW_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(requests, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (_) {
    return NextResponse.json(
      { message: "Internal server error" },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

export async function POST(req) {
  const auth = requireRole(req, ROLE.USER);
  if (auth.error) {
    return auth.error;
  }

  const data = await req.json();
  const { targetDate, bookId } = data;

  if (!targetDate || !bookId) {
    return badRequest("Missing mandatory data");
  }

  if (!ObjectId.isValid(bookId)) {
    return badRequest("Invalid book id");
  }

  const parsedTargetDate = new Date(targetDate);
  if (Number.isNaN(parsedTargetDate.getTime())) {
    return badRequest("Invalid target date");
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const books = db.collection(BOOK_COLLECTION);
    const borrows = db.collection(BORROW_COLLECTION);

    const book = await books.findOne({
      _id: new ObjectId(bookId),
      status: { $ne: "DELETED" },
    });

    if (!book) {
      return NextResponse.json(
        { message: "Book not found" },
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    const now = new Date();
    let requestStatus = BORROW_STATUS.INIT;

    if ((book.quantity || 0) > 0) {
      requestStatus = BORROW_STATUS.ACCEPTED;
      await books.updateOne(
        { _id: book._id },
        {
          $inc: { quantity: -1 },
          $set: {
            updatedAt: now,
            updatedBy: auth.user.email,
          },
        }
      );
    } else {
      requestStatus = BORROW_STATUS.CLOSE_NO_AVAILABLE_BOOK;
    }

    const result = await borrows.insertOne({
      userId: String(auth.user.id),
      userEmail: auth.user.email,
      bookId: String(book._id),
      bookTitle: book.title,
      createdAt: now,
      targetDate: parsedTargetDate,
      status: requestStatus,
    });

    return NextResponse.json(
      {
        id: result.insertedId,
        status: requestStatus,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (_) {
    return NextResponse.json(
      { message: "Internal server error" },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
