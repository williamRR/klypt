export type Route = 'landing' | 'app';

let currentRoute: Route = 'landing';
const listeners: Set<(route: Route) => void> = new Set();

export function getCurrentRoute(): Route {
  return currentRoute;
}

export function navigate(route: Route): void {
  if (currentRoute === route) return;
  currentRoute = route;
  
  if (typeof window !== 'undefined') {
    window.location.hash = route;
    localStorage.setItem('klypt_last_route', route);
  }
  
  listeners.forEach(callback => callback(route));
}

export function onRouteChange(callback: (route: Route) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function initRouter(): Route {
  if (typeof window === 'undefined') return 'landing';
  
  const hash = window.location.hash.slice(1) as Route;
  if (hash === 'app' || hash === 'landing') {
    currentRoute = hash;
    return currentRoute;
  }
  
  const last = localStorage.getItem('klypt_last_route') as Route | null;
  if (last === 'app') {
    currentRoute = 'app';
    return currentRoute;
  }
  
  currentRoute = 'landing';
  return currentRoute;
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1) as Route;
  if (hash === currentRoute) return;
  
  if (hash === 'app' || hash === 'landing') {
    currentRoute = hash;
    listeners.forEach(callback => callback(currentRoute));
  }
});
