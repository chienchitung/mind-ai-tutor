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
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('BROADCAST_SUBSCRIBE_TIMEOUT')), 5000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          reject(new Error(`BROADCAST_SUBSCRIBE_FAILED:${status}`));
        }
      });
    });
    await channel.send({ type: 'broadcast', event, payload });
    // send() resolving only means the message was handed to the socket, not
    // that it reached the server - closing the channel immediately after
    // risks tearing down the connection before that flush completes. A
    // short buffer avoids racing the teardown against actual delivery.
    await new Promise((resolve) => setTimeout(resolve, 250));
  } finally {
    await client.removeChannel(channel);
  }
}
