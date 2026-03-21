/**
 * Browser-native OAuth flow for Klypt web.
 * No Tauri dependencies — uses Supabase's standard browser redirect.
 */
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
let supabase = null;
let currentUser = null;
export function initSupabase() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                flowType: "pkce",
            },
        });
    }
    return supabase;
}
export function getSupabase() {
    return supabase ?? initSupabase();
}
export function getCurrentUser() {
    return currentUser;
}
export function isAuthenticated() {
    return currentUser !== null;
}
export async function getSession() {
    const { data } = await getSupabase().auth.getSession();
    currentUser = data.session?.user ?? null;
    return data.session;
}
export async function signInWithGoogle() {
    return signInWithProvider("google");
}
export async function signInWithGitHub() {
    return signInWithProvider("github");
}
async function signInWithProvider(provider) {
    const { error } = await getSupabase().auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${window.location.origin}/`,
        },
    });
    return { error: error?.message ?? null };
}
export async function signOut() {
    await getSupabase().auth.signOut();
    currentUser = null;
}
export function onAuthStateChange(callback) {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user ?? null;
        callback(currentUser);
    });
    return () => data.subscription.unsubscribe();
}
/** Call on app load — handles OAuth callback code in URL. */
export async function initialize() {
    initSupabase();
    // If this is an OAuth callback, exchange the code
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
        await getSupabase().auth.exchangeCodeForSession(code);
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
    }
    const session = await getSession();
    currentUser = session?.user ?? null;
    return currentUser;
}
