/**
 * Web data layer — all operations via Supabase directly.
 */
import { getSupabase, getCurrentUser } from "./auth-web";

export interface Note {
  id: string;
  title: string;
  content: string;
  click_count: number;
  is_pinned: boolean;
  pin_order: number;
  is_private: boolean;
  created_at: number;
  updated_at: number;
}

function fromRow(n: Record<string, unknown>): Note {
  return {
    id: n.id as string,
    title: n.title as string,
    content: n.content as string,
    click_count: n.click_count as number,
    is_pinned: n.is_pinned as boolean,
    pin_order: n.pin_order as number,
    is_private: n.is_private as boolean,
    created_at: Math.floor(new Date(n.created_at as string).getTime() / 1000),
    updated_at: Math.floor(new Date(n.updated_at as string).getTime() / 1000),
  };
}

function uid(): string {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

function sb() {
  return getSupabase();
}

export async function getNotes(): Promise<Note[]> {
  const { data, error } = await sb()
    .from("notes")
    .select("*")
    .eq("user_id", uid())
    .eq("is_pinned", false)
    .order("click_count", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function getPinnedNotes(): Promise<Note[]> {
  const { data, error } = await sb()
    .from("notes")
    .select("*")
    .eq("user_id", uid())
    .eq("is_pinned", true)
    .order("pin_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function addNote(title: string, content: string): Promise<Note> {
  const { data, error } = await sb()
    .from("notes")
    .insert({ user_id: uid(), title, content })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateNote(id: string, title: string, content: string): Promise<void> {
  const { error } = await sb()
    .from("notes")
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await sb().from("notes").delete().eq("id", id);
  if (error) throw error;
}

export async function incrementClick(id: string): Promise<void> {
  const { data } = await sb().from("notes").select("click_count").eq("id", id).single();
  await sb()
    .from("notes")
    .update({ click_count: ((data?.click_count as number) ?? 0) + 1 })
    .eq("id", id);
}

export async function pinNote(id: string): Promise<void> {
  const { data } = await sb()
    .from("notes")
    .select("pin_order")
    .eq("user_id", uid())
    .eq("is_pinned", true)
    .order("pin_order", { ascending: false })
    .limit(1);
  const maxOrder = (data?.[0]?.pin_order as number) ?? -1;
  await sb().from("notes").update({ is_pinned: true, pin_order: maxOrder + 1 }).eq("id", id);
}

export async function unpinNote(id: string): Promise<void> {
  await sb().from("notes").update({ is_pinned: false, pin_order: 0 }).eq("id", id);
}

export async function reorderPinned(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id, i) => sb().from("notes").update({ pin_order: i }).eq("id", id))
  );
}

export async function togglePrivate(id: string): Promise<void> {
  const { data } = await sb().from("notes").select("is_private").eq("id", id).single();
  await sb().from("notes").update({ is_private: !(data?.is_private as boolean) }).eq("id", id);
}

// ── Clipboard ─────────────────────────────────────────────────────────────────

export interface ClipboardItem {
  id: string;
  content: string;
  content_type: string;
  image_data: string;
  captured_at: number;
}

function fromClipboard(n: Record<string, unknown>): ClipboardItem {
  return {
    id: n.id as string,
    content: n.content as string,
    content_type: n.content_type as string,
    image_data: n.image_data as string,
    captured_at: Math.floor(new Date(n.captured_at as string).getTime() / 1000),
  };
}

export async function getClipboardHistory(limit: number): Promise<ClipboardItem[]> {
  const { data, error } = await sb()
    .from("clipboard_items")
    .select("*")
    .eq("user_id", uid())
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(fromClipboard);
}

export async function deleteClipboardItem(id: string): Promise<void> {
  const { error } = await sb().from("clipboard_items").delete().eq("id", id);
  if (error) throw error;
}

export async function clearClipboardHistory(): Promise<void> {
  const { error } = await sb().from("clipboard_items").delete().eq("user_id", uid());
  if (error) throw error;
}
