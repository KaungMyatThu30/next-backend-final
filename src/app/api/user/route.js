
// REFERENCE: This file is provided as a user registration example.
// Students must implement authentication and role-based logic as required in the exam.
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

const DB_NAME = process.env.MONGODB_DB || "library_management";
const USER_COLLECTION = process.env.USER_COLLECTION || "users";

export async function  POST (req) {
  const data = await req.json();
  const username = data.username;
  const email = data.email;
  const password = data.password;
  const firstname = data.firstname;
  const lastname = data.lastname;

  if (!username || !email || !password) {
    return NextResponse.json({
      message: "Missing mandatory data"
    }, {
      status: 400,
      headers: corsHeaders
    })
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
      headers: corsHeaders
    });
  }
  catch (exception) {
    const errorMsg = exception.toString();
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
      headers: corsHeaders
    })
  }

}
