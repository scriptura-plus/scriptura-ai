import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { computePublishedPearlBackfillPlan } from "@/lib/research-notes/computePublishedPearlBackfillPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();

    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Supabase admin client is unavailable." },
        { status: 500 }
      );
    }

    const plan = await computePublishedPearlBackfillPlan(supabase);

    return NextResponse.json({
      ok: true,
      mode: "dry_run",
      writes: false,
      plan,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "dry_run",
        writes: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
