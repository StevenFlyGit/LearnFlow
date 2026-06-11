import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/user/profile
 * Returns the static mock user directly.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ ok: true, user: auth.user });
}
