const APP_SHELL_ROUTES = [
  '/dashboard',
  '/students',
  '/lessons',
  '/digital-games',
  '/ai-quiz',
  '/events',
  '/feedback',
  '/activities',
  '/reports',
  '/settings',
  '/profile',
  '/subscription',
  '/admin',
] as const;

const LIVE_SHELL_ROUTES = ['/live/new', '/live/sessions'] as const;

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function usesAppShell(pathname: string): boolean {
  return (
    APP_SHELL_ROUTES.some((route) => matchesRoute(pathname, route)) ||
    LIVE_SHELL_ROUTES.some((route) => matchesRoute(pathname, route))
  );
}
