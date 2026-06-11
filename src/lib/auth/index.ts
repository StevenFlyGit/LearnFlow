import { NextRequest } from "next/server";

export interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface AuthResult {
  ok: boolean;
  user: User;
  response?: Response;
}

export function requireAuth(request: NextRequest): AuthResult {
  return {
    ok: true,
    user: {
      id: "local_user",
      name: "Local User",
      email: "local@example.com",
      avatarUrl: "",
    }
  };
}
