import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import Fuse from "fuse.js";
import {
  initSupabase,
  initialize,
  onAuthStateChange,
  signInWithGoogle,
  signInWithGitHub,
  signOut,
} from "./auth";
import {
  Note,
  ClipboardItem,
  getNotes,
  getPinnedNotes,
  addNote,
  updateNote,
  deleteNote,
  incrementClick,
  pinNote,
  unpinNote,
  reorderPinned,
  togglePrivate,
  getClipboardHistory,
  addClipboardItem,
  deleteClipboardItem,
  clearClipboardHistory,
  copyImageToClipboard,
} from "./services";

// ── State ──
let mruNotes: Note[] = [];
let pinnedNotes: Note[] = [];
let clipboardItems: ClipboardItem[] = [];
let fuseMru: Fuse<Note>;
let fusePinned: Fuse<Note>;

let selectedMruIndex = 0;
let isAddMode = false;
let editingNoteId: string | null = null;
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let mergeSelectedIds = new Set<string>();

// Drag state for pinned reorder
let dragSrcId: string | null = null;

// ── DOM refs ──
const searchInput   = document.getElementById("searchInput")   as HTMLInputElement;
const notesList     = document.getElementById("notesList")     as HTMLDivElement;
const pinnedList    = document.getElementById("pinnedList")    as HTMLDivElement;
const clipboardList = document.getElementById("clipboardList") as HTMLDivElement;
const addForm       = document.getElementById("addForm")       as HTMLDivElement;
const noteTitle     = document.getElementById("noteTitle")     as HTMLInputElement;
const noteContent   = document.getElementById("noteContent")   as HTMLTextAreaElement;
const saveBtn       = document.getElementById("saveBtn")       as HTMLButtonElement;
const cancelBtn     = document.getElementById("cancelBtn")     as HTMLButtonElement;
const addBtn        = document.getElementById("addBtn")        as HTMLButtonElement;
const closeBtn      = document.getElementById("closeBtn")      as HTMLButtonElement;
const lockBtn       = document.getElementById("lockBtn")       as HTMLButtonElement;
const mergeBtn      = document.getElementById("mergeBtn")      as HTMLButtonElement;
const mergeBtnLabel = document.getElementById("mergeBtnLabel") as HTMLSpanElement;
const mergeDialog   = document.getElementById("mergeDialog")   as HTMLDivElement;
const mergeDialogTitle = document.getElementById("mergeDialogTitle") as HTMLDivElement;
const mergeTitleInput  = document.getElementById("mergeTitleInput")  as HTMLInputElement;
const mergeCancelBtn   = document.getElementById("mergeCancelBtn")   as HTMLButtonElement;
const mergeConfirmBtn  = document.getElementById("mergeConfirmBtn")  as HTMLButtonElement;
const mergeDeleteOriginals = document.getElementById("mergeDeleteOriginals") as HTMLInputElement;
const separatorList    = document.getElementById("separatorList")    as HTMLDivElement;
const toast         = document.getElementById("toast")         as HTMLDivElement;
const clearClipboardBtn = document.getElementById("clearClipboardBtn") as HTMLButtonElement;
const noteViewerDialog  = document.getElementById("noteViewerDialog")  as HTMLDivElement;
const noteViewerTitle   = document.getElementById("noteViewerTitle")   as HTMLDivElement;
const noteViewerContent = document.getElementById("noteViewerContent") as HTMLDivElement;
const noteViewerCopyBtn = document.getElementById("noteViewerCopyBtn") as HTMLButtonElement;
const noteViewerCloseBtn = document.getElementById("noteViewerCloseBtn") as HTMLButtonElement;

// ── Helpers ──
function escapeHtml(text: string): string {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)  return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function showToast(message: string, type: "success" | "error" | "" = "") {
  toast.textContent = message;
  toast.className = "toast show" + (type ? ` ${type}` : "");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

// ── Load all data ──
async function loadAll() {
  try {
    const [mru, pinned, clips] = await Promise.all([
      getNotes(),
      getPinnedNotes(),
      getClipboardHistory(80),
    ]);
    mruNotes = mru;
    pinnedNotes = pinned;
    clipboardItems = clips;
    rebuildFuse();
    renderMRU(mruNotes);
    renderPinned(pinnedNotes);
    renderClipboard(clipboardItems);
  } catch (e) {
    console.error("loadAll failed:", e);
    showToast("Error loading data", "error");
  }
}

async function refreshClipboard() {
  try {
    clipboardItems = await getClipboardHistory(80);
    renderClipboard(clipboardItems);
  } catch (_) { /* ignore */ }
}

function rebuildFuse() {
  const fuseOpts = { keys: ["title", "content"], threshold: 0.25, includeScore: true };
  fuseMru    = new Fuse(mruNotes, fuseOpts);
  fusePinned = new Fuse(pinnedNotes, fuseOpts);
}

// ── Render clipboard column ──
function renderClipboard(items: ClipboardItem[]) {
  clipboardList.innerHTML = "";
  if (items.length === 0) {
    clipboardList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          </svg>
        </div>
        <div class="empty-state-title">Sin historial</div>
        <div class="empty-state-text">Copia algo para empezar</div>
      </div>`;
    return;
  }
  for (const item of items) {
    const isImage = item.content_type === "image";
    const card = document.createElement("div");
    card.className = "clipboard-card";

    const bodyHtml = isImage
      ? `<img class="clipboard-thumb" src="data:image/png;base64,${item.image_data}" alt="imagen" />`
      : `<div class="clipboard-content">${escapeHtml(item.content)}</div>`;

    card.innerHTML = `
      <div class="note-body">
        ${bodyHtml}
        <div class="clipboard-time">${relativeTime(item.captured_at)}</div>
      </div>
      <div class="clipboard-actions">
        <button class="clipboard-save" title="Guardar como nota">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
        </button>
        <button class="clipboard-del" title="Eliminar">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>`;

    card.querySelector(".clipboard-save")!.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        if (isImage) {
          await addNote("Imagen capturada", "[imagen]");
        } else {
          const title = item.content.split("\n")[0].slice(0, 40) || "Sin título";
          await addNote(title, item.content);
        }
        showToast("Guardado como nota", "success");
        await loadAll();
      } catch (_) { showToast("Error guardando", "error"); }
    });

    card.querySelector(".clipboard-del")!.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await deleteClipboardItem(item.id);
        clipboardItems = clipboardItems.filter(c => c.id !== item.id);
        renderClipboard(clipboardItems);
      } catch (_) { showToast("Error", "error"); }
    });

    card.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".clipboard-actions")) return;
      if (isImage) {
        copyImageToClipboard(item.image_data)
          .then(() => showToast("Imagen copiada", "success"))
          .catch(() => showToast("Error copiando imagen", "error"));
      } else {
        writeText(item.content);
        showToast("Copiado", "success");
      }
      invoke("hide_window");
    });

    clipboardList.appendChild(card);
  }
}

// ── Render pinned column ──
function renderPinned(notes: Note[]) {
  pinnedList.innerHTML = "";
  if (notes.length === 0) {
    pinnedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35">
            <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
          </svg>
        </div>
        <div class="empty-state-title">Sin notas fijadas</div>
        <div class="empty-state-text">Fija notas con el ícono 📌</div>
      </div>`;
    return;
  }
  for (const note of notes) {
    const card = buildNoteCard(note, { pinned: true });
    pinnedList.appendChild(card);
  }
}

// ── Render MRU column ──
function renderMRU(notes: Note[]) {
  notesList.innerHTML = "";
  selectedMruIndex = 0;

  if (notes.length === 0) {
    notesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="empty-state-title">Sin notas usadas aún</div>
        <div class="empty-state-text">Se populan automáticamente al usar notas</div>
      </div>`;
    return;
  }

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const card = buildNoteCard(note, { pinned: false, selected: i === 0 });
    notesList.appendChild(card);
  }
}

// ── Build note card (shared for pinned and MRU) ──
function buildNoteCard(
  note: Note,
  opts: { pinned: boolean; selected?: boolean }
): HTMLElement {
  const card = document.createElement("div");
  const isMergeSelected = mergeSelectedIds.has(note.id);
  card.className = "note-card" +
    (opts.selected ? " selected" : "") +
    (isMergeSelected ? " merge-selected" : "") +
    (note.is_private ? " private" : "");
  card.dataset.id = String(note.id);

  const dragHandle = opts.pinned
    ? `<div class="drag-handle" draggable="false">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
          <circle cx="3" cy="3" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="3" r="1.2" fill="currentColor"/>
          <circle cx="3" cy="7" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
          <circle cx="3" cy="11" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="11" r="1.2" fill="currentColor"/>
        </svg>
      </div>`
    : "";

  const pinIconPath = opts.pinned
    ? `<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/><line x1="12" y1="17" x2="12" y2="22"/>`
    : `<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>`;

  const checkmark = isMergeSelected
    ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
    : "";

  card.innerHTML = `
    <div class="merge-checkbox${isMergeSelected ? " checked" : ""}" title="Seleccionar para merge">${checkmark}</div>
    ${dragHandle}
    <div class="note-body">
      <div class="note-title">${escapeHtml(note.title)}</div>
      <div class="note-content">${escapeHtml(note.content)}</div>
    </div>
    <div class="note-actions">
      <button class="note-btn edit-btn" title="Editar">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        </svg>
      </button>
      <button class="note-btn ${opts.pinned ? "unpin-btn" : "pin-btn"}" title="${opts.pinned ? "Desfijar" : "Fijar"}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${pinIconPath}
        </svg>
      </button>
      <button class="note-btn private-btn" title="${note.is_private ? "Hacer pública" : "Hacer privada"}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${note.is_private
            ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
            : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`}
        </svg>
      </button>
      <button class="note-btn delete-btn" title="Eliminar">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
      </button>
    </div>`;

  // Checkbox click → toggle merge selection (no copy)
  card.querySelector(".merge-checkbox")!.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMergeSelect(note.id);
  });

  // Click on card body → open viewer; Cmd/Ctrl+Click → toggle merge selection
  card.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(".note-actions") || target.closest(".drag-handle") || target.closest(".merge-checkbox")) return;
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleMergeSelect(note.id);
    } else {
      openNoteViewer(note);
    }
  });

  card.querySelector(".edit-btn")!.addEventListener("click", (e) => {
    e.stopPropagation();
    editNote(note);
  });

  const pinBtn = card.querySelector(opts.pinned ? ".unpin-btn" : ".pin-btn")!;
  pinBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      if (opts.pinned) {
        await unpinNote(note.id);
      } else {
        await pinNote(note.id);
      }
      mergeSelectedIds.delete(note.id);
      await loadAll();
    } catch (_) { showToast("Error", "error"); }
  });

  card.querySelector(".delete-btn")!.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await deleteNote(note.id);
      mergeSelectedIds.delete(note.id);
      updateMergeBtn();
      await loadAll();
    } catch (_) { showToast("Error deleting note", "error"); }
  });

  card.querySelector(".private-btn")!.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await togglePrivate(note.id);
      await loadAll();
    } catch (_) { showToast("Error", "error"); }
  });

  // Drag & drop for pinned reorder
  if (opts.pinned) {
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", () => {
      dragSrcId = note.id;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      pinnedList.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
    });
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      pinnedList.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
      card.classList.add("drag-over");
    });
    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      if (dragSrcId === null || dragSrcId === note.id) return;

      const srcIdx = pinnedNotes.findIndex(n => n.id === dragSrcId);
      const dstIdx = pinnedNotes.findIndex(n => n.id === note.id);
      if (srcIdx === -1 || dstIdx === -1) return;

      const reordered = [...pinnedNotes];
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(dstIdx, 0, moved);

      try {
        await reorderPinned(reordered.map(n => n.id));
        pinnedNotes = reordered;
        renderPinned(pinnedNotes);
      } catch (_) { showToast("Error reordering", "error"); }
    });
  }

  return card;
}

// ── Merge selection ──
function toggleMergeSelect(id: string) {
  if (mergeSelectedIds.has(id)) {
    mergeSelectedIds.delete(id);
  } else {
    mergeSelectedIds.add(id);
  }
  updateMergeBtn();
  // Re-render to reflect selection highlight
  const currentSearch = searchInput.value.trim();
  if (currentSearch) {
    applySearch(currentSearch);
  } else {
    renderPinned(pinnedNotes);
    renderMRU(mruNotes);
  }
}

function updateMergeBtn() {
  const count = mergeSelectedIds.size;
  if (count >= 2) {
    mergeBtn.classList.remove("hidden");
    mergeBtnLabel.textContent = `Merge (${count})`;
  } else {
    mergeBtn.classList.add("hidden");
  }
}

// ── Separator option highlight ──
separatorList.addEventListener("change", (e) => {
  separatorList.querySelectorAll(".separator-option").forEach(opt => opt.classList.remove("active"));
  const radio = e.target as HTMLInputElement;
  radio.closest(".separator-option")?.classList.add("active");
});

// ── Merge dialog ──
function showMergeDialog() {
  const count = mergeSelectedIds.size;
  mergeDialogTitle.textContent = `Unir ${count} nota${count > 1 ? "s" : ""}`;
  const allNotes = [...pinnedNotes, ...mruNotes];
  const firstNote = [...mergeSelectedIds]
    .map(id => allNotes.find(n => n.id === id))
    .find((n): n is Note => n !== undefined);
  mergeTitleInput.value = firstNote ? firstNote.title + " (merged)" : "Merged";
  mergeDialog.classList.remove("hidden");
  mergeTitleInput.focus();
  mergeTitleInput.select();
}

function hideMergeDialog() {
  mergeDialog.classList.add("hidden");
}

async function confirmMerge() {
  const selectedRadio = separatorList.querySelector<HTMLInputElement>("input[name='sep']:checked");
  const sepValue = selectedRadio?.value ?? "newline";

  const allNotes = [...pinnedNotes, ...mruNotes];
  const selectedNotes = [...mergeSelectedIds]
    .map(id => allNotes.find(n => n.id === id))
    .filter((n): n is Note => n !== undefined);

  if (selectedNotes.length < 2) return;

  let merged: string;
  if (sepValue === "numbered") {
    merged = selectedNotes.map((n, i) => `${i + 1}. ${n.content}`).join("\n");
  } else {
    const sep: Record<string, string> = {
      newline: "\n",
      blank: "\n\n",
      none: "",
      dashes: "\n—\n",
    };
    merged = selectedNotes.map(n => n.content).join(sep[sepValue] ?? "\n");
  }

  const mergedTitle = mergeTitleInput.value.trim() || selectedNotes[0].title + " (merged)";

  try {
    await addNote(mergedTitle, merged);
    if (mergeDeleteOriginals.checked) {
      for (const note of selectedNotes) {
        if (note.is_pinned) {
          await unpinNote(note.id);
        }
        await deleteNote(note.id);
      }
    }
    showToast("Notas unidas", "success");
    mergeSelectedIds.clear();
    updateMergeBtn();
    hideMergeDialog();
    await loadAll();
  } catch (_) {
    showToast("Error al unir notas", "error");
  }
}

// ── Note viewer ──
let viewerNote: Note | null = null;

function openNoteViewer(note: Note) {
  viewerNote = note;
  noteViewerTitle.textContent = note.title;
  noteViewerContent.textContent = note.content;
  noteViewerDialog.classList.remove("hidden");
}

function closeNoteViewer() {
  noteViewerDialog.classList.add("hidden");
  viewerNote = null;
}

noteViewerCloseBtn.onclick = closeNoteViewer;

noteViewerDialog.addEventListener("click", (e) => {
  if (e.target === noteViewerDialog) closeNoteViewer();
});

noteViewerCopyBtn.addEventListener("click", async () => {
  if (!viewerNote) return;
  await writeText(viewerNote.content);
  await incrementClick(viewerNote.id);
  showToast("Copiado", "success");
});

noteViewerContent.addEventListener("mouseup", () => {
  const sel = window.getSelection();
  if (sel && sel.toString().trim().length > 0) {
    writeText(sel.toString());
    showToast("Selección copiada", "success");
  }
});

// ── Copy note ──
async function copyNote(note: Note) {
  try {
    await writeText(note.content);
    await incrementClick(note.id);
    showToast(`Copiado: ${note.title}`, "success");
    await loadAll();
    await invoke("hide_window");
  } catch (_) {
    showToast("Error al copiar", "error");
  }
}

// ── Edit note ──
function editNote(note: Note) {
  editingNoteId = note.id;
  showAddForm();
  noteTitle.value = note.title;
  noteContent.value = note.content;
  saveBtn.textContent = "Update";
  noteTitle.focus();
}

// ── Add form ──
function showAddForm(withSearch = false) {
  isAddMode = true;
  addForm.classList.remove("hidden");
  searchInput.disabled = true;

  if (editingNoteId === null) {
    const query = withSearch ? searchInput.value : "";
    noteTitle.value = query.startsWith("+") ? query.slice(1).trim() : "";
    noteContent.value = "";
  }

  noteTitle.focus();
}

function hideAddForm() {
  isAddMode = false;
  editingNoteId = null;
  saveBtn.textContent = "Save";
  addForm.classList.add("hidden");
  searchInput.disabled = false;
  searchInput.value = "";
  searchInput.focus();
  renderMRU(mruNotes);
  renderPinned(pinnedNotes);
}

async function saveNote() {
  const title = noteTitle.value.trim();
  const content = noteContent.value.trim();

  if (!title && !content) {
    showToast("Escribe algo primero");
    return;
  }

  const finalTitle = title || "Untitled";
  const finalContent = content || title;

  try {
    if (editingNoteId !== null) {
      await updateNote(editingNoteId, finalTitle, finalContent);
      showToast("Nota actualizada!", "success");
    } else {
      await addNote(finalTitle, finalContent);
      showToast("Nota guardada!", "success");
    }
    hideAddForm();
    await loadAll();
  } catch (_) {
    showToast("Error guardando nota", "error");
  }
}

// ── Search ──
function applySearch(query: string) {
  const filteredMru    = fuseMru.search(query).map(r => r.item);
  const filteredPinned = fusePinned.search(query).map(r => r.item);
  renderMRU(filteredMru);
  renderPinned(filteredPinned);
}

function handleSearch() {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = searchInput.value.trim();

    if (query === "+" || (query.startsWith("+") && query.length <= 30)) {
      showAddForm(true);
      return;
    }

    if (query) {
      applySearch(query);
    } else {
      renderMRU(mruNotes);
      renderPinned(pinnedNotes);
    }
  }, 150);
}

function updateMruSelection() {
  const cards = notesList.querySelectorAll(".note-card");
  cards.forEach((card, i) => card.classList.toggle("selected", i === selectedMruIndex));
  const sel = cards[selectedMruIndex];
  if (sel) sel.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ── Event listeners ──
searchInput.addEventListener("input", handleSearch);

searchInput.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "Escape":
      if (isAddMode) {
        hideAddForm();
      } else if (viewerNote) {
        closeNoteViewer();
      } else if (mergeSelectedIds.size > 0) {
        mergeSelectedIds.clear();
        updateMergeBtn();
        renderMRU(mruNotes);
        renderPinned(pinnedNotes);
      } else {
        invoke("hide_window");
      }
      break;
    case "Enter":
      e.preventDefault();
      if (!isAddMode) {
        const visibleCards = notesList.querySelectorAll<HTMLElement>(".note-card");
        if (visibleCards.length > 0) {
          const id = visibleCards[selectedMruIndex]?.dataset.id ?? "";
          const note = mruNotes.find(n => n.id === id);
          if (note) copyNote(note);
        }
      }
      break;
    case "ArrowDown":
      e.preventDefault();
      if (!isAddMode) {
        const cards = notesList.querySelectorAll(".note-card");
        selectedMruIndex = Math.min(selectedMruIndex + 1, cards.length - 1);
        updateMruSelection();
      }
      break;
    case "ArrowUp":
      e.preventDefault();
      if (!isAddMode) {
        selectedMruIndex = Math.max(selectedMruIndex - 1, 0);
        updateMruSelection();
      }
      break;
  }
});

noteTitle.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideAddForm();
  if (e.key === "Enter") { e.preventDefault(); noteContent.focus(); }
});

noteContent.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideAddForm();
  if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); saveNote(); }
});

addBtn.onclick = () => showAddForm();
closeBtn.onclick = () => invoke("hide_window");
saveBtn.onclick = saveNote;
cancelBtn.onclick = hideAddForm;
mergeBtn.onclick = showMergeDialog;
clearClipboardBtn.onclick = async () => {
  try {
    await clearClipboardHistory();
    clipboardItems = [];
    renderClipboard([]);
    showToast("Historial limpiado", "success");
  } catch (_) { showToast("Error", "error"); }
};
lockBtn.onclick = async () => {
  await signOut();
  showAuthScreen();
};
mergeCancelBtn.onclick = hideMergeDialog;
mergeConfirmBtn.onclick = confirmMerge;

document.addEventListener("click", (e) => {
  if (isAddMode) return;
  const target = e.target as HTMLElement;
  if (target.closest(".auth-screen") || target.closest(".app-container")) return;
  invoke("hide_window");
});

// Close merge dialog clicking outside modal
mergeDialog.addEventListener("click", (e) => {
  if (e.target === mergeDialog) hideMergeDialog();
});

// Focus + refresh on window show
listen("focus-input", async () => {
  searchInput.focus();
  searchInput.select();
  await refreshClipboard();
});

// Listen for clipboard changes from Rust watcher → save to Supabase
listen<{ content: string; content_type: string; image_data: string; captured_at: number }>(
  "clipboard_change",
  async (event) => {
    const { content, content_type, image_data } = event.payload;
    try {
      await addClipboardItem(content, content_type, image_data);
      await refreshClipboard();
    } catch (_) { /* ignore if not authenticated */ }
  }
);

// ── Auth screen elements ──
const authScreen    = document.getElementById("authScreen")    as HTMLDivElement;
const appContainer  = document.getElementById("appContainer")   as HTMLDivElement;
const loginGoogle   = document.getElementById("loginGoogle")   as HTMLButtonElement;
const loginGithub   = document.getElementById("loginGithub")   as HTMLButtonElement;
const authSkip      = document.querySelector(".auth-skip")     as HTMLParagraphElement;

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  appContainer.classList.add("hidden");
}

function showApp() {
  authScreen.classList.add("hidden");
  appContainer.classList.remove("hidden");
}

async function handleGoogleLogin() {
  try {
    loginGoogle.disabled = true;
    loginGoogle.classList.add("loading");
    const { error } = await signInWithGoogle();
    if (error) {
      console.error("[OAuth] Error:", error);
      showToast(error, "error");
    }
    loginGoogle.disabled = false;
    loginGoogle.classList.remove("loading");
  } catch (e) {
    console.error("[OAuth] Unhandled error:", e);
    loginGoogle.disabled = false;
    loginGoogle.classList.remove("loading");
  }
}

async function handleGithubLogin() {
  try {
    loginGithub.disabled = true;
    loginGithub.classList.add("loading");
    const { error } = await signInWithGitHub();
    if (error) {
      console.error("[OAuth] Error:", error);
      showToast(error, "error");
    }
    loginGithub.disabled = false;
    loginGithub.classList.remove("loading");
  } catch (e) {
    console.error("[OAuth] Unhandled error:", e);
    loginGithub.disabled = false;
    loginGithub.classList.remove("loading");
  }
}

loginGoogle.addEventListener("click", handleGoogleLogin);
loginGithub.addEventListener("click", handleGithubLogin);
authSkip.addEventListener("click", () => {
  showApp();
  loadAll();
});

onAuthStateChange((user) => {
  if (user) {
    showApp();
    loadAll();
  } else {
    showAuthScreen();
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  initSupabase();
  const user = await initialize();
  if (user) {
    showApp();
    loadAll();
  } else {
    showAuthScreen();
  }
});
