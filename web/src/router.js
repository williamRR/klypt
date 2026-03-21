let currentRoute = 'landing';
const listeners = new Set();
export function getCurrentRoute() {
    return currentRoute;
}
export function navigate(route) {
    if (currentRoute === route)
        return;
    currentRoute = route;
    if (typeof window !== 'undefined') {
        window.location.hash = route;
        localStorage.setItem('klypt_last_route', route);
    }
    listeners.forEach(callback => callback(route));
}
export function onRouteChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}
export function initRouter() {
    if (typeof window === 'undefined')
        return 'landing';
    const hash = window.location.hash.slice(1);
    if (hash === 'app' || hash === 'landing') {
        currentRoute = hash;
        return currentRoute;
    }
    const last = localStorage.getItem('klypt_last_route');
    if (last === 'app') {
        currentRoute = 'app';
        return currentRoute;
    }
    currentRoute = 'landing';
    return currentRoute;
}
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    if (hash === currentRoute)
        return;
    if (hash === 'app' || hash === 'landing') {
        currentRoute = hash;
        listeners.forEach(callback => callback(currentRoute));
    }
});
