// REFERENCE: This file is provided as a user registration example.
// Students must implement authentication and role-based logic as required in the exam.
import { requireAuth } from "@/lib/auth";
import { getCorsHeaders } from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";

const DB_NAME = process.env.MONGODB_DB || "library_management";
const USER_COLLECTION = process.env.USER_COLLECTION || "users";

export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(req),
  });
}

export async function GET (req) {
  const auth = requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const profile = await db.collection(USER_COLLECTION).findOne(
      { email: auth.user.email, status: "ACTIVE" },
      {
        projection: {
          password: 0,
        },
      }
    );
    if (!profile) {
      return NextResponse.json({
        message: "Profile not found"
      }, {
        status: 404,
        headers: getCorsHeaders(req)
      });
    }
    return NextResponse.json(profile, {
      headers: getCorsHeaders(req)
    });
  }
  catch (_) {
    return NextResponse.json({
      message: "Internal server error"
    }, {
      status: 500,
      headers: getCorsHeaders(req)
    });
  }
}
