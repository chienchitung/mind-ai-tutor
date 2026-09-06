const STORAGE_KEY = 'ellis_device_id';

/** A random id persisted per browser, global across every game/lesson - not
 * scoped by gameStorageKey() like most other local state here, since the
 * anti-abuse daily cap it backs (claim_game_chat_message,
 * scripts/add_game_chat_device_quota.sql) is meant to bound one browser's
 * total AI-tutor usage, not reset itself just because a student switched
 * games. Never sent anywhere except as an opaque id on /api/chat calls -
 * no login, no name, nothing identifying attached to it. */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // localStorage unavailable (private browsing, disabled) - a fresh id
    // every call still lets chat work, just without a durable daily cap
    // for that one session.
    return crypto.randomUUID();
  }
}
