/**
 * Browser-native OAuth flow for Klypt web.
 * No Tauri dependencies — uses Supabase's standard browser redirect.
 */
import { createClient, SupabaseClient, User, Session } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string || "";

let supabase: SupabaseClient | null = null;
let currentUser: User | null = null;

export function initSupabase(): SupabaseClient {
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

export function getSupabase(): SupabaseClient {
  return supabase ?? initSupabase();
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function isAuthenticated(): boolean {
  return currentUser !== null;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession();
  currentUser = data.session?.user ?? null;
  return data.session;
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  return signInWithProvider("google");
}

export async function signInWithGitHub(): Promise<{ error: string | null }> {
  return signInWithProvider("github");
}

async function signInWithProvider(provider: "google" | "github"): Promise<{ error: string | null }> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
  currentUser = null;
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    callback(currentUser);
  });
  return () => data.subscription.unsubscribe();
}

/** Call on app load — handles OAuth callback code in URL. */
export async function initialize(): Promise<User | null> {
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
