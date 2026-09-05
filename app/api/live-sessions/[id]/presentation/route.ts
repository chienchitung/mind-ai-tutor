import { NextResponse, after } from "next/server";
import { getServerClient } from "@/app/lib/supabase";
import { presentationCommandSchema } from "@/lib/live-presentation";
import { broadcastLiveUpdate } from "@/lib/live-broadcast";
import { z } from "zod";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const client = await getServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { data: session, error } = await client
    .from("live_sessions")
    .select("join_code")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: "LIVE_STORAGE_ERROR" }, { status: 500 });
  if (!session)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const result = await client.rpc("get_live_presentation", {
    p_code: session.join_code,
  });
  if (result.error)
    return NextResponse.json({ error: "LIVE_STORAGE_ERROR" }, { status: 500 });
  return NextResponse.json(result.data, { headers });
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  const parsed = presentationCommandSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!z.string().uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const client = await getServerClient();
  // No client.auth.getUser() round trip here (unlike GET, which needs the
  // user id to look up join_code) - control_live_presentation itself
  // raises UNAUTHORIZED/NOT_FOUND from auth.uid(), so an extra Auth-server
  // round trip before every single owner command would only add latency
  // without adding any check the RPC doesn't already enforce.
  const command =
    parsed.data.action === "question"
      ? { action: "show", mode: "question", questionId: parsed.data.questionId }
      : parsed.data;
  const { data, error } = await client.rpc("control_live_presentation", {
    p_session_id: id,
    p_command: command,
  });
  if (error) {
    const known = [
      "UNAUTHORIZED",
      "NOT_FOUND",
      "SESSION_CLOSED",
      "POLL_NOT_ACTIVE",
      "POLL_NOT_FOUND",
      "QUESTION_NOT_PUBLIC",
      "INVALID_TRANSITION",
    ].find((x) => error.message?.includes(x));
    return NextResponse.json(
      { error: known ?? "LIVE_STORAGE_ERROR" },
      {
        status:
          known === "UNAUTHORIZED" ? 401 : known === "NOT_FOUND" ? 404 : known ? 409 : 500,
      },
    );
  }
  // Broadcast only invalidation; clients read an authorized, current snapshot.
  after(() =>
    broadcastLiveUpdate(id, "presentation:changed", {}).catch(console.error),
  );
  return NextResponse.json(data, { headers });
}
