import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/getUserFromRequest";

export function middleware(req) {
  const user = getUserFromRequest(req);
  if (!user) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized access" }), {
      status: 401,
    });
  }

  // Add user information to the request for downstream handlers
  req.user = user;

  return NextResponse.next();
}
