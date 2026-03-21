import { createClient, SupabaseClient, User, Session } from "@supabase/supabase-js"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { open as openUrl } from "@tauri-apps/plugin-shell"

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ""
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

let supabase: SupabaseClient | null = null
let currentUser: User | null = null
let authStateCallback: ((user: User | null) => void) | null = null
let oauthPort: number | null = null
let oauthCallbackUnlisten: (() => void) | null = null

export function initSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        flowType: "pkce",
      },
    })
  }
  return supabase
}

export function getSupabase(): SupabaseClient {
  return supabase ?? initSupabase()
}

export async function getSession(): Promise<Session | null> {
  const sb = getSupabase()
  const { data } = await sb.auth.getSession()
  currentUser = data.session?.user ?? null
  return data.session
}

function getRedirectUri(port: number): string {
  return `http://localhost:${port}/auth/callback`
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { error: "Supabase not configured. Check .env file." }
  }
  return signInWithProvider("google")
}

export async function signInWithGitHub(): Promise<{ error: string | null }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { error: "Supabase not configured. Check .env file." }
  }
  return signInWithProvider("github")
}

async function signInWithProvider(provider: string): Promise<{ error: string | null }> {
  try {
    console.log("[OAuth] Setting up callback listener...")
    oauthCallbackUnlisten = await listen<string>("oauth_callback", async (event) => {
      console.log("[OAuth] Callback received:", event.payload)
      try {
        const url = new URL(event.payload)
        const code = url.searchParams.get("code")
        if (!code) {
          console.error("[OAuth] No code in callback")
          return
        }
        console.log("[OAuth] Exchanging code for session...")
        const sb = getSupabase()
        const { error } = await sb.auth.exchangeCodeForSession(code)
        if (error) {
          console.error("[OAuth] Exchange error:", error)
        } else {
          console.log("[OAuth] Session created!")
          const session = await getSession()
          currentUser = session?.user ?? null
          if (authStateCallback) authStateCallback(currentUser)
        }
      } catch (e) {
        console.error("[OAuth] Callback error:", e)
      } finally {
        cleanupOAuth()
      }
    })

    console.log("[OAuth] Starting local callback server...")
    oauthPort = await invoke<number>("start_oauth")
    console.log("[OAuth] Server on port:", oauthPort)
    const redirectUri = getRedirectUri(oauthPort)

    console.log("[OAuth] Getting OAuth URL from Supabase...")
    const sb = getSupabase()
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: provider as "google" | "github",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      console.error("[OAuth] Supabase error:", error)
      cleanupOAuth()
      return { error: error.message }
    }

    if (!data.url) {
      console.error("[OAuth] No URL returned")
      cleanupOAuth()
      return { error: "No OAuth URL returned" }
    }

    console.log("[OAuth] Full OAuth URL:", data.url)
    console.log("[OAuth] Opening browser with this URL")
    await openUrl(data.url)
    console.log("[OAuth] Done - waiting for callback")
    return { error: null }
  } catch (e) {
    console.error("[OAuth] Error:", e)
    cleanupOAuth()
    return { error: String(e) }
  }
}

export async function signOut(): Promise<void> {
  const sb = getSupabase()
  await sb.auth.signOut()
  currentUser = null
}

export function getCurrentUser(): User | null {
  return currentUser
}

export function isAuthenticated(): boolean {
  return currentUser !== null
}

export async function getAccessToken(): Promise<string | null> {
  const sb = getSupabase()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  authStateCallback = callback
  const sb = getSupabase()
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null
    callback(currentUser)
  })
  return () => data.subscription.unsubscribe()
}

export async function initialize(): Promise<User | null> {
  const session = await getSession()
  currentUser = session?.user ?? null
  if (authStateCallback) authStateCallback(currentUser)
  return currentUser
}

export async function cleanupOAuth(): Promise<void> {
  if (oauthCallbackUnlisten) {
    oauthCallbackUnlisten()
    oauthCallbackUnlisten = null
  }
  oauthPort = null
}
