const APP_SHELL_ROUTES = [
  '/dashboard',
  '/students',
  '/classrooms',
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
  '/classroom-tools',
] as const;

const LIVE_SHELL_ROUTES = ['/live/new', '/live/sessions', '/live/recordings'] as const;

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

// Full-screen windows meant for the projector, under shell routes.
const BARE_ROUTES = ['/classroom-tools/display'] as const;

export function usesAppShell(pathname: string): boolean {
  if (BARE_ROUTES.some((route) => matchesRoute(pathname, route))) return false;
  return (
    APP_SHELL_ROUTES.some((route) => matchesRoute(pathname, route)) ||
    LIVE_SHELL_ROUTES.some((route) => matchesRoute(pathname, route))
  );
}
