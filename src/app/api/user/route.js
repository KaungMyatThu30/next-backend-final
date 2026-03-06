
// REFERENCE: This file is provided as a user registration example.
// Students must implement authentication and role-based logic as required in the exam.
import { ROLE, badRequest, readJsonBody, requireRole } from "@/lib/auth";
import { getCorsHeaders } from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

const DB_NAME = process.env.MONGODB_DB || "library_management";
const USER_COLLECTION = process.env.USER_COLLECTION || "users";

export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(req),
  });
}

export async function  POST (req) {
  const auth = requireRole(req, ROLE.ADMIN);
  if (auth.error) {
    return auth.error;
  }

  const parsedBody = await readJsonBody(req);
  if (parsedBody.error) {
    return parsedBody.error;
  }

  const data = parsedBody.data;
  const username = data.username;
  const email = data.email;
  const password = data.password;
  const firstname = data.firstname;
  const lastname = data.lastname;

  if (!username || !email || !password) {
    return badRequest(req, "Missing mandatory data");
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const result = await db.collection(USER_COLLECTION).insertOne({
      username: username,
      email: email,
      password: await bcrypt.hash(password, 10),
      firstname: firstname,
      lastname: lastname,
      role: "USER",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return NextResponse.json({
      id: result.insertedId
    }, {
      status: 200,
      headers: getCorsHeaders(req)
    });
  }
  catch (error) {
    const errorMsg = String(error || "");
    let displayErrorMsg = "";
    if (errorMsg.includes("duplicate")) {
      if (errorMsg.includes("username")) {
        displayErrorMsg = "Duplicate Username!!"
      }
      else if (errorMsg.includes("email")) {
        displayErrorMsg = "Duplicate Email!!"
      }
    }
    return NextResponse.json({
      message: displayErrorMsg
    }, {
      status: 400,
      headers: getCorsHeaders(req)
    })
  }

}
