import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth";

export async function requireProductAccess(req: Request) {
  const expectedAdminSecret = process.env.ADMIN_SECRET?.trim();
  const providedAdminSecret = req.headers.get("x-admin-secret")?.trim();

  // Admin/internal bypass only. This does not turn a beta reader into admin.
  if (expectedAdminSecret && providedAdminSecret === expectedAdminSecret) {
    return null;
  }

  const supabase = await createSupabaseAuthServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Auth is not configured" },
      { status: 500 },
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
