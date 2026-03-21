/**
 * Web data layer — all operations via Supabase directly.
 */
import { getSupabase, getCurrentUser } from "./auth-web";
function fromRow(n) {
    return {
        id: n.id,
        title: n.title,
        content: n.content,
        click_count: n.click_count,
        is_pinned: n.is_pinned,
        pin_order: n.pin_order,
        is_private: n.is_private,
        created_at: Math.floor(new Date(n.created_at).getTime() / 1000),
        updated_at: Math.floor(new Date(n.updated_at).getTime() / 1000),
    };
}
function uid() {
    const user = getCurrentUser();
    if (!user)
        throw new Error("Not authenticated");
    return user.id;
}
function sb() {
    return getSupabase();
}
export async function getNotes() {
    const { data, error } = await sb()
        .from("notes")
        .select("*")
        .eq("user_id", uid())
        .eq("is_pinned", false)
        .order("click_count", { ascending: false })
        .limit(50);
    if (error)
        throw error;
    return (data ?? []).map(fromRow);
}
export async function getPinnedNotes() {
    const { data, error } = await sb()
        .from("notes")
        .select("*")
        .eq("user_id", uid())
        .eq("is_pinned", true)
        .order("pin_order", { ascending: true });
    if (error)
        throw error;
    return (data ?? []).map(fromRow);
}
export async function addNote(title, content) {
    const { data, error } = await sb()
        .from("notes")
        .insert({ user_id: uid(), title, content })
        .select()
        .single();
    if (error)
        throw error;
    return fromRow(data);
}
export async function updateNote(id, title, content) {
    const { error } = await sb()
        .from("notes")
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error)
        throw error;
}
export async function deleteNote(id) {
    const { error } = await sb().from("notes").delete().eq("id", id);
    if (error)
        throw error;
}
export async function incrementClick(id) {
    const { data } = await sb().from("notes").select("click_count").eq("id", id).single();
    await sb()
        .from("notes")
        .update({ click_count: (data?.click_count ?? 0) + 1 })
        .eq("id", id);
}
export async function pinNote(id) {
    const { data } = await sb()
        .from("notes")
        .select("pin_order")
        .eq("user_id", uid())
        .eq("is_pinned", true)
        .order("pin_order", { ascending: false })
        .limit(1);
    const maxOrder = data?.[0]?.pin_order ?? -1;
    await sb().from("notes").update({ is_pinned: true, pin_order: maxOrder + 1 }).eq("id", id);
}
export async function unpinNote(id) {
    await sb().from("notes").update({ is_pinned: false, pin_order: 0 }).eq("id", id);
}
export async function reorderPinned(ids) {
    await Promise.all(ids.map((id, i) => sb().from("notes").update({ pin_order: i }).eq("id", id)));
}
export async function togglePrivate(id) {
    const { data } = await sb().from("notes").select("is_private").eq("id", id).single();
    await sb().from("notes").update({ is_private: !data?.is_private }).eq("id", id);
}
function fromClipboard(n) {
    return {
        id: n.id,
        content: n.content,
        content_type: n.content_type,
        image_data: n.image_data,
        captured_at: Math.floor(new Date(n.captured_at).getTime() / 1000),
    };
}
export async function getClipboardHistory(limit) {
    const { data, error } = await sb()
        .from("clipboard_items")
        .select("*")
        .eq("user_id", uid())
        .order("captured_at", { ascending: false })
        .limit(limit);
    if (error)
        throw error;
    return (data ?? []).map(fromClipboard);
}
export async function deleteClipboardItem(id) {
    const { error } = await sb().from("clipboard_items").delete().eq("id", id);
    if (error)
        throw error;
}
export async function clearClipboardHistory() {
    const { error } = await sb().from("clipboard_items").delete().eq("user_id", uid());
    if (error)
        throw error;
}
