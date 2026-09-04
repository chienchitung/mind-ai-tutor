import { NextResponse } from "next/server";
import { getServerClient } from "@/app/lib/supabase";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!/^[0-9]{6}$/.test(code))
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });
  const client = await getServerClient();
  const { data, error } = await client.rpc("get_live_presentation", {
    p_code: code,
  });
  if (error)
    return NextResponse.json({ error: "LIVE_STORAGE_ERROR" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
