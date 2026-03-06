import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/cors";

const JWT_SECRET = process.env.JWT_SECRET || "mydefaulyjwtsecret";

export const ROLE = {
  ADMIN: "ADMIN",
  USER: "USER",
};

export function unauthorized(req, message = "Unauthorized") {
  return NextResponse.json({ message }, { status: 401, headers: getCorsHeaders(req) });
}

export function forbidden(req, message = "Forbidden") {
  return NextResponse.json({ message }, { status: 403, headers: getCorsHeaders(req) });
}

export function badRequest(req, message = "Bad request") {
  return NextResponse.json({ message }, { status: 400, headers: getCorsHeaders(req) });
}

export async function readJsonBody(req) {
  try {
    const data = await req.json();
    return { data };
  } catch (_) {
    return { error: badRequest(req, "Invalid JSON body") };
  }
}

export function parseTokenFromRequest(req) {
  const token = req.cookies.get("token")?.value;
  if (!token) {
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

export function requireAuth(req) {
  const user = parseTokenFromRequest(req);
  if (!user) {
    return { error: unauthorized(req, "Authentication required") };
  }
  return { user };
}

export function requireRole(req, roles) {
  const auth = requireAuth(req);
  if (auth.error) {
    return auth;
  }
  const roleList = Array.isArray(roles) ? roles : [roles];
  if (!roleList.includes(auth.user.role)) {
    return { error: forbidden(req, "Insufficient permissions") };
  }
  return auth;
}
