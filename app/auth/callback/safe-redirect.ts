// OAuth callbacks are attacker-controlled entry points. Only accept a local
// absolute path so a successful login cannot become an external redirect.
export function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  try {
    const parsed = new URL(value, 'https://mindaitutor.local');
    return parsed.origin === 'https://mindaitutor.local'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : '/dashboard';
  } catch {
    return '/dashboard';
  }
}
