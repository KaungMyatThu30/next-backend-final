import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import corsHeaders from "@/lib/cors";

const JWT_SECRET = process.env.JWT_SECRET || "mydefaulyjwtsecret";

export const ROLE = {
  ADMIN: "ADMIN",
  USER: "USER",
};

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ message }, { status: 401, headers: corsHeaders });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ message }, { status: 403, headers: corsHeaders });
}

export function badRequest(message = "Bad request") {
  return NextResponse.json({ message }, { status: 400, headers: corsHeaders });
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
    return { error: unauthorized("Authentication required") };
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
    return { error: forbidden("Insufficient permissions") };
  }
  return auth;
}
