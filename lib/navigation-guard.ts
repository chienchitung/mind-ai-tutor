export const NAVIGATION_REQUEST = 'mindai:request-navigation';

/** Programmatic navigation (command menu, account menu) shares the editor guard. */
export function confirmAppNavigation(): boolean {
  return window.dispatchEvent(new Event(NAVIGATION_REQUEST, { cancelable: true }));
}

export function isLeavingDocument(current: URL, target: URL): boolean {
  return current.origin !== target.origin || current.pathname !== target.pathname || current.search !== target.search;
}
