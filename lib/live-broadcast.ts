import 'server-only';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const liveSessionChannelName = (sessionId: string) => `live-session:${sessionId}`;

/**
 * Best-effort push to every client subscribed to this session's channel.
 * The write this follows has already committed - callers should catch and
 * log, never fail the request, if this throws (a client that misses a push
 * still gets fresh state on its next load).
 */
export async function broadcastLiveUpdate(sessionId: string, event: string, payload: Record<string, unknown>) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const channel = client.channel(liveSessionChannelName(sessionId));
  try {
    // An unsubscribed channel uses Realtime's HTTP broadcast endpoint. No
    // WebSocket handshake or teardown buffer is needed for each server event.
    const result = await channel.send({ type: 'broadcast', event, payload }, { timeout: 5000 });
    if (result !== 'ok') throw new Error(`BROADCAST_FAILED:${result}`);
  } finally {
    await client.removeChannel(channel);
  }
}
