import Fuse from "fuse.js";
import {
  initialize,
  onAuthStateChange,
  signInWithGoogle,
  signInWithGitHub,
  signOut,
} from "./auth-web";
import {
  Note,
  getNotes,
  getPinnedNotes,
  addNote,
  updateNote,
  deleteNote,
  incrementClick,
  pinNote,
  unpinNote,
  ClipboardItem,
  getClipboardHistory,
  deleteClipboardItem,
  clearClipboardHistory,
} from "./services";
import { getSupabase, getCurrentUser } from "./auth-web";
import { initRouter, onRouteChange, navigate } from "./router";
import { mountLanding } from "./landing";

// ── State ────────────────────────────────────────────────────────────────────

let mruNotes: Note[] = [];
let pinnedNotes: Note[] = [];
let clipboardItems: ClipboardItem[] = [];
let fuseMru: Fuse<Note>;
let fusePinned: Fuse<Note>;
let activeNoteId: string | null = null;
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────

const authScreen     = document.getElementById("authScreen")     as HTMLDivElement;
const app            = document.getElementById("app")            as HTMLDivElement;
const loginGoogle    = document.getElementById("loginGoogle")    as HTMLButtonElement;
const loginGithub    = document.getElementById("loginGithub")    as HTMLButtonElement;
const signOutBtn     = document.getElementById("signOutBtn")     as HTMLButtonElement;
const newNoteBtn     = document.getElementById("newNoteBtn")     as HTMLButtonElement;
const searchInput    = document.getElementById("searchInput")    as HTMLInputElement;
const pinnedList     = document.getElementById("pinnedList")     as HTMLDivElement;
const notesList      = document.getElementById("notesList")      as HTMLDivElement;
const detailEmpty    = document.getElementById("detailEmpty")    as HTMLDivElement;
const detailView     = document.getElementById("detailView")     as HTMLDivElement;
const detailEdit     = document.getElementById("detailEdit")     as HTMLDivElement;
const detailTitle    = document.getElementById("detailTitle")    as HTMLDivElement;
const detailContent  = document.getElementById("detailContent")  as HTMLDivElement;
const detailMeta     = document.getElementById("detailMeta")     as HTMLDivElement;
const detailCopyBtn  = document.getElementById("detailCopyBtn")  as HTMLButtonElement;
const detailEditBtn  = document.getElementById("detailEditBtn")  as HTMLButtonElement;
const detailPinBtn   = document.getElementById("detailPinBtn")   as HTMLButtonElement;
const detailDeleteBtn= document.getElementById("detailDeleteBtn")as HTMLButtonElement;
const editTitleInput = document.getElementById("editTitleInput") as HTMLInputElement;
const editContentInput = document.getElementById("editContentInput") as HTMLTextAreaElement;
const editSaveBtn    = document.getElementById("editSaveBtn")    as HTMLButtonElement;
const editCancelBtn  = document.getElementById("editCancelBtn")  as HTMLButtonElement;
const clipboardList    = document.getElementById("clipboardList")    as HTMLDivElement;
const clearClipboardBtn= document.getElementById("clearClipboardBtn")as HTMLButtonElement;
const toast          = document.getElementById("toast")          as HTMLDivElement;

// ── Helpers ──────────────────────────────────────────────────────────────────

function showToast(msg: string, type: "success" | "error" | "" = "") {
  toast.textContent = msg;
  toast.className = "toast show" + (type ? ` ${type}` : "");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

function showAuth() {
  authScreen.classList.remove("hidden");
  app.classList.add("hidden");
}

function showApp() {
  authScreen.classList.add("hidden");
  app.classList.remove("hidden");
}

// ── Load ─────────────────────────────────────────────────────────────────────

async function loadAll() {
  try {
    const [mru, pinned, clips] = await Promise.all([getNotes(), getPinnedNotes(), getClipboardHistory(80)]);
    mruNotes = mru;
    pinnedNotes = pinned;
    clipboardItems = clips;
    fuseMru = new Fuse(mruNotes, { keys: ["title", "content"], threshold: 0.25 });
    fusePinned = new Fuse(pinnedNotes, { keys: ["title", "content"], threshold: 0.25 });
    renderLists(mruNotes, pinnedNotes);
    renderClipboard(clipboardItems);
    // Refresh active note display if one is selected
    if (activeNoteId) {
      const all = [...pinnedNotes, ...mruNotes];
      const note = all.find(n => n.id === activeNoteId);
      if (note) showDetail(note);
      else hideDetail();
    }
  } catch (e) {
    console.error("loadAll failed:", e);
    showToast("Error loading notes", "error");
  }
}

// ── Render sidebar ────────────────────────────────────────────────────────────

function renderLists(mru: Note[], pinned: Note[]) {
  renderSection(pinnedList, pinned, true);
  renderSection(notesList, mru, false);
}

function renderSection(container: HTMLDivElement, notes: Note[], isPinned: boolean) {
  container.innerHTML = "";
  if (notes.length === 0) {
    container.innerHTML = `<div class="sidebar-empty">${isPinned ? "No pinned notes" : "No notes yet"}</div>`;
    return;
  }
  for (const note of notes) {
    const item = document.createElement("div");
    item.className = "sidebar-item" + (note.id === activeNoteId ? " active" : "") + (note.is_private ? " private" : "");
    item.dataset.id = note.id;
    item.innerHTML = `
      <div class="sidebar-item-title">${escapeHtml(note.title || "Untitled")}</div>
      <div class="sidebar-item-preview">${escapeHtml(note.content.slice(0, 60))}</div>
      <div class="sidebar-item-meta">${relativeTime(note.updated_at)}</div>`;
    item.addEventListener("click", () => {
      activeNoteId = note.id;
      showDetail(note);
      renderLists(mruNotes, pinnedNotes); // refresh active highlight
    });
    container.appendChild(item);
  }
}

// ── Render clipboard ─────────────────────────────────────────────────────────

function renderClipboard(items: ClipboardItem[]) {
  clipboardList.innerHTML = "";
  if (items.length === 0) {
    clipboardList.innerHTML = `<div class="sidebar-empty">No clipboard items</div>`;
    return;
  }
  for (const item of items) {
    const isImage = item.content_type === "image";
    const el = document.createElement("div");
    el.className = "sidebar-item clipboard-item";
    el.dataset.id = item.id;
    const preview = isImage
      ? `<img class="clipboard-thumb" src="data:image/png;base64,${item.image_data}" alt="image" />`
      : `<div class="sidebar-item-preview">${escapeHtml(item.content.slice(0, 60))}</div>`;
    el.innerHTML = `
      ${preview}
      <div class="sidebar-item-meta" style="display:flex;justify-content:space-between;align-items:center;">
        <span>${relativeTime(item.captured_at)}</span>
        <button class="clipboard-del-btn" title="Delete">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>`;
    el.querySelector(".clipboard-del-btn")!.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await deleteClipboardItem(item.id);
        clipboardItems = clipboardItems.filter(c => c.id !== item.id);
        renderClipboard(clipboardItems);
      } catch (_) { showToast("Error", "error"); }
    });
    el.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".clipboard-del-btn")) return;
      const text = isImage ? "" : item.content;
      if (text) {
        navigator.clipboard.writeText(text).then(() => showToast("Copied!", "success"));
      }
    });
    clipboardList.appendChild(el);
  }
}

clearClipboardBtn.addEventListener("click", async () => {
  if (!confirm("Clear clipboard history?")) return;
  try {
    await clearClipboardHistory();
    clipboardItems = [];
    renderClipboard([]);
    showToast("Cleared", "success");
  } catch (_) { showToast("Error", "error"); }
});

// ── Supabase Realtime — clipboard ─────────────────────────────────────────────

function subscribeClipboardRealtime() {
  const user = getCurrentUser();
  if (!user) return;
  getSupabase()
    .channel("clipboard_realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "clipboard_items", filter: `user_id=eq.${user.id}` },
      (payload) => {
        const n = payload.new as Record<string, unknown>;
        const item: ClipboardItem = {
          id: n.id as string,
          content: n.content as string,
          content_type: n.content_type as string,
          image_data: n.image_data as string,
          captured_at: Math.floor(new Date(n.captured_at as string).getTime() / 1000),
        };
        clipboardItems = [item, ...clipboardItems].slice(0, 100);
        renderClipboard(clipboardItems);
      }
    )
    .subscribe();
}

function subscribeNotesRealtime() {
  const user = getCurrentUser();
  if (!user) return;
  getSupabase()
    .channel("notes_realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${user.id}` },
      () => { loadAll(); }
    )
    .subscribe();
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function hideDetail() {
  activeNoteId = null;
  detailEmpty.classList.remove("hidden");
  detailView.classList.add("hidden");
  detailEdit.classList.add("hidden");
}

function showDetail(note: Note) {
  detailEmpty.classList.add("hidden");
  detailEdit.classList.add("hidden");
  detailView.classList.remove("hidden");

  detailTitle.textContent = note.title || "Untitled";
  detailContent.textContent = note.content;
  detailMeta.textContent = `Updated ${relativeTime(note.updated_at)} · ${note.click_count} copies`;

  // Update pin button icon
  const pinPath = note.is_pinned
    ? `<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/><line x1="12" y1="17" x2="12" y2="22"/>`
    : `<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>`;
  detailPinBtn.querySelector("svg")!.innerHTML = pinPath;
  detailPinBtn.title = note.is_pinned ? "Unpin" : "Pin";
}

function openEdit(note?: Note) {
  detailEmpty.classList.add("hidden");
  detailView.classList.add("hidden");
  detailEdit.classList.remove("hidden");

  if (note) {
    editTitleInput.value = note.title;
    editContentInput.value = note.content;
  } else {
    editTitleInput.value = "";
    editContentInput.value = "";
  }
  editTitleInput.focus();
}

// ── Detail button actions ─────────────────────────────────────────────────────

detailCopyBtn.addEventListener("click", async () => {
  if (!activeNoteId) return;
  const note = [...pinnedNotes, ...mruNotes].find(n => n.id === activeNoteId);
  if (!note) return;
  try {
    await navigator.clipboard.writeText(note.content);
    await incrementClick(note.id);
    showToast("Copied!", "success");
    await loadAll();
  } catch (_) { showToast("Copy failed", "error"); }
});

detailEditBtn.addEventListener("click", () => {
  if (!activeNoteId) return;
  const note = [...pinnedNotes, ...mruNotes].find(n => n.id === activeNoteId);
  if (note) openEdit(note);
});

detailPinBtn.addEventListener("click", async () => {
  if (!activeNoteId) return;
  const note = [...pinnedNotes, ...mruNotes].find(n => n.id === activeNoteId);
  if (!note) return;
  try {
    if (note.is_pinned) await unpinNote(note.id);
    else await pinNote(note.id);
    await loadAll();
  } catch (_) { showToast("Error", "error"); }
});

detailDeleteBtn.addEventListener("click", async () => {
  if (!activeNoteId) return;
  if (!confirm("Delete this note?")) return;
  try {
    await deleteNote(activeNoteId);
    hideDetail();
    await loadAll();
    showToast("Note deleted", "success");
  } catch (_) { showToast("Error deleting", "error"); }
});

// ── Edit form actions ─────────────────────────────────────────────────────────

async function saveEdit() {
  const title = editTitleInput.value.trim();
  const content = editContentInput.value.trim();
  if (!title && !content) { showToast("Write something first"); return; }
  const finalTitle = title || "Untitled";
  const finalContent = content || title;

  try {
    if (activeNoteId) {
      await updateNote(activeNoteId, finalTitle, finalContent);
      showToast("Saved!", "success");
    } else {
      const note = await addNote(finalTitle, finalContent);
      activeNoteId = note.id;
      showToast("Note created!", "success");
    }
    await loadAll();
  } catch (_) { showToast("Error saving", "error"); }
}

editSaveBtn.addEventListener("click", saveEdit);
editCancelBtn.addEventListener("click", () => {
  if (activeNoteId) {
    const note = [...pinnedNotes, ...mruNotes].find(n => n.id === activeNoteId);
    if (note) { showDetail(note); return; }
  }
  hideDetail();
});

editContentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); saveEdit(); }
  if (e.key === "Escape") editCancelBtn.click();
});

editTitleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); editContentInput.focus(); }
  if (e.key === "Escape") editCancelBtn.click();
});

// ── New note button ───────────────────────────────────────────────────────────

newNoteBtn.addEventListener("click", () => {
  activeNoteId = null;
  openEdit();
});

// ── Search ────────────────────────────────────────────────────────────────────

searchInput.addEventListener("input", () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = searchInput.value.trim();
    if (!q) {
      renderLists(mruNotes, pinnedNotes);
    } else {
      renderLists(
        fuseMru.search(q).map(r => r.item),
        fusePinned.search(q).map(r => r.item)
      );
    }
  }, 150);
});

// ── Auth ──────────────────────────────────────────────────────────────────────

loginGoogle.addEventListener("click", async () => {
  loginGoogle.disabled = true;
  const { error } = await signInWithGoogle();
  if (error) { showToast(error, "error"); loginGoogle.disabled = false; }
});

loginGithub.addEventListener("click", async () => {
  loginGithub.disabled = true;
  const { error } = await signInWithGitHub();
  if (error) { showToast(error, "error"); loginGithub.disabled = false; }
});

signOutBtn.addEventListener("click", async () => {
  await signOut();
  showAuth();
});

// Content selection → copy
detailContent.addEventListener("mouseup", () => {
  const sel = window.getSelection();
  if (sel && sel.toString().trim().length > 0) {
    navigator.clipboard.writeText(sel.toString()).catch(() => {});
    showToast("Selection copied", "success");
  }
});

// ── Routing ────────────────────────────────────────────────────────────────────

const landingRoot = document.getElementById("landing-root") as HTMLDivElement;
const backToLandingBtn = document.getElementById("backToLanding") as HTMLButtonElement;

let isOnLanding = true;

function showLanding() {
  isOnLanding = true;
  landingRoot.classList.remove("hidden");
  authScreen.classList.add("hidden");
  app.classList.add("hidden");
  mountLanding();
}

function hideLanding() {
  isOnLanding = false;
  landingRoot.classList.add("hidden");
}

backToLandingBtn.addEventListener("click", () => {
  navigate("landing");
});

onRouteChange(async (route) => {
  if (route === "landing") {
    hideLanding();
    showLanding();
  } else {
    hideLanding();
    const user = await initialize();
    if (user) { showApp(); loadAll(); }
    else showAuth();
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

onAuthStateChange((user) => {
  if (user) {
    hideLanding();
    showApp();
    loadAll();
    subscribeClipboardRealtime();
    subscribeNotesRealtime();
  }
  else if (!isOnLanding) {
    showAuth();
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  initRouter();
  
  const route = window.location.hash.slice(1);
  if (route === "app") {
    hideLanding();
    const user = await initialize();
    if (user) { showApp(); loadAll(); }
    else showAuth();
  } else {
    showLanding();
    initialize();
  }
});
