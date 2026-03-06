// app.js (FINAL - fast load + updates visible in textarea + safe logging)
// Notes:
// - Fast initial render from localStorage (no waiting for Supabase)
// - Update textarea shows full update history
// - Save supports two workflows:
//   A) Type ONLY the new update (textarea contains just new text) -> it will be timestamped + prepended to old history
//   B) Type the new update at the TOP and keep old history below -> it will timestamp just the new top part
//   If user freely edits the log, we save exactly what they typed.

import { supabase, isSupabaseConfigured } from "./supabase-config.js";

/* =========================
   DOM
========================= */
const $ = (id) => document.getElementById(id);

const searchInput = $("searchInput");
const searchBtn = $("searchBtn");
const clearSearchBtn = $("clearSearchBtn");

const exportCSVBtn = $("exportCSV");
const addTaskBtn = $("globalAddTask");
const logoutBtn = $("logoutBtn");

const themeSwitch = $("themeSwitch");

const modal = $("taskModal");
const saveBtn = $("saveBtn");
const cancelBtn = $("cancelBtn");

// âœ… MUST match app.html IDs
const taskTitle = $("taskTitle");
const taskDesc = $("taskDesc");
const taskUpdate = $("taskUpdate");
const taskDept = $("taskDept");
const taskOwner = $("taskOwner"); // optional unless you added it in app.html
const taskReceived = $("taskReceived");
const taskDeadline = $("taskDeadline");
const taskUrgency = $("taskUrgency");

const archiveList = $("archiveList");

/* =========================
   STATE
========================= */
const SB_TABLE_TASKS = "tasks";
const SB_TABLE_ARCHIVE = "archive";
const SB_TABLE_ADMINS = "admins";

let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
let archive = JSON.parse(localStorage.getItem("archive") || "[]");
let editId = null;
let isAdmin = false;
let isDragging = false;

/* =========================
   HELPERS
========================= */
function escapeHTML(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function persistAll() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  localStorage.setItem("archive", JSON.stringify(archive));
}

// Parse "YYYY-MM-DD" as LOCAL midnight (not UTC)
function parseLocalDate(v) {
  const parts = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) return new Date(+parts[1], +parts[2] - 1, +parts[3]);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(v) {
  try {
    const d = parseLocalDate(v);
    if (!d) return String(v);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(v);
  }
}

/* =========================
   AUTH
========================= */
async function requireAuth() {
  if (!isSupabaseConfigured()) return true;

  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

async function doLogout() {
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem("tasks");
  localStorage.removeItem("archive");
  window.location.href = "index.html";
}

async function checkAdmin() {
  if (!isSupabaseConfigured()) return false;

  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return false;

  const { data: rows, error } = await supabase
    .from(SB_TABLE_ADMINS)
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return false;
  return !!rows?.user_id;
}

/* =========================
   SUPABASE LOAD/SAVE
========================= */
async function sbLoadAll() {
  if (!isSupabaseConfigured()) return false;
  if (Date.now() < sbSaveCooldown) return false;

  const [{ data: tData, error: tErr }, { data: aData, error: aErr }] =
    await Promise.all([
      supabase.from(SB_TABLE_TASKS).select("*").order("id", { ascending: true }),
      supabase.from(SB_TABLE_ARCHIVE).select("*").order("id", { ascending: true }),
    ]);

  if (tErr || aErr) {
    console.warn("Supabase load failed; using localStorage.", tErr || aErr);
    return false;
  }

  // Log raw Supabase data
  console.log("ðŸ“¦ Raw Supabase tasks data:", tData);
  console.log("ðŸ“¦ Raw Supabase archive data:", aData);

  tasks = (tData || []).map((r) => r.payload).filter(Boolean);
  archive = (aData || []).map((r) => r.payload).filter(Boolean);

  // Log processed tasks
  console.log("âœ… Processed tasks:", tasks);
  console.log("âœ… Processed archive:", archive);

  localStorage.setItem("tasks", JSON.stringify(tasks));
  localStorage.setItem("archive", JSON.stringify(archive));
  return true;
}

// NOTE:
// Previously, the dashboard upserted *ALL* tasks whenever any task changed.
// That creates a "last write wins" bug: a stale tab/user doing a drag/drop can
// overwrite newer edits (especially the Update textarea) on other tasks.
//
// Fix: write only what changed.
// - Modal save: upsert only that task.
// - Drag/drop: patch only moved fields (status/department) by fetching latest
//   payload first and merging.

let sbSaveTimer = null;
let sbSaveCooldown = 0;

function sbScheduleUpsertOne(table, payloadObj) {
  clearTimeout(sbSaveTimer);
  sbSaveCooldown = Date.now() + 3000;
  sbSaveTimer = setTimeout(async () => {
    await sbUpsertOne(table, payloadObj);
    sbSaveCooldown = Date.now() + 2000;
  }, 250);
}

async function sbUpsertAll() {
  if (!isSupabaseConfigured()) return;

  const tRows = (tasks || []).map((t) => ({ id: t.id, payload: t }));
  const aRows = (archive || []).map((a) => ({ id: a.id, payload: a }));

  const promises = [];
  if (tRows.length) promises.push(supabase.from(SB_TABLE_TASKS).upsert(tRows, { onConflict: "id" }));
  if (aRows.length) promises.push(supabase.from(SB_TABLE_ARCHIVE).upsert(aRows, { onConflict: "id" }));

  const results = await Promise.all(promises);
  results.forEach((r) => {
    if (r.error) console.warn("Supabase upsert failed.", r.error);
  });
}

async function sbPatchTask(id, patch) {
  if (!isSupabaseConfigured()) return;

  const { data, error } = await supabase
    .from(SB_TABLE_TASKS)
    .select("payload")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("Supabase patch load failed.", error);
    await sbUpsertOne(SB_TABLE_TASKS, { id, ...patch });
    return;
  }

  const base = data?.payload || { id };
  const merged = { ...base, ...patch, id };
  await sbUpsertOne(SB_TABLE_TASKS, merged);
}

async function sbUpsertOne(table, payloadObj) {
  if (!isSupabaseConfigured()) return;
  await supabase
    .from(table)
    .upsert({ id: payloadObj.id, payload: payloadObj }, { onConflict: "id" });
}

async function sbDeleteOne(table, id) {
  if (!isSupabaseConfigured()) return;
  await supabase.from(table).delete().eq("id", id);
}

/* =========================
   REALTIME
========================= */
let realtimeEnabled = false;
function enableRealtime() {
  if (realtimeEnabled) return;
  if (!isSupabaseConfigured()) return;

  realtimeEnabled = true;
  const ch = supabase.channel("pmtool-realtime");

  ch.on("postgres_changes", { event: "*", schema: "public", table: SB_TABLE_TASKS }, async () => {
    await sbLoadAll();
    renderTasks(getFilteredTasks());
    renderArchive();
  });

  ch.on("postgres_changes", { event: "*", schema: "public", table: SB_TABLE_ARCHIVE }, async () => {
    await sbLoadAll();
    renderTasks(getFilteredTasks());
    renderArchive();
  });

  ch.subscribe();
}

/* =========================
   MODAL
========================= */
function openModal(id = null) {
  editId = id;
  modal.style.display = "flex";

  if (id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;

    taskTitle.value = t.title || "";
    taskDesc.value = t.desc || "";

    // âœ… Show full update history INSIDE the textarea
    taskUpdate.value = t.update || "";

    taskDept.value = t.department || "Admin";
    if (taskOwner) taskOwner.value = t.owner || "";
    taskReceived.value = t.received || "";
    taskDeadline.value = t.deadline || "";
    taskUrgency.value = t.urgency || "low";
  } else {
    taskTitle.value = "";
    taskDesc.value = "";
    taskUpdate.value = "";
    taskDept.value = "";
    if (taskOwner) taskOwner.value = "";
    taskReceived.value = "";
    taskDeadline.value = "";
    taskUrgency.value = "low";
  }
}

function closeModal() {
  modal.style.display = "none";
  editId = null;
}

function saveTask() {
  const title = (taskTitle.value || "").trim();
  if (!title) {
    alert("Please enter a Title.");
    return;
  }

  const dept = (taskDept.value || "").trim();
  if (!dept) {
    alert("Please select a Department.");
    return;
  }

  const currentText = String(taskUpdate.value || "").trim();

  // âœ… Overwrite behavior (no history):
  // Save ONLY what's currently in the Update textarea.
  // Old updates are replaced (deleted).
  const combinedUpdate = currentText;

  const payload = {
    title,
    desc: taskDesc.value || "",
    update: combinedUpdate,
    department: dept,
    owner: taskOwner ? (taskOwner.value || "") : "",
    received: taskReceived.value || "",
    deadline: taskDeadline.value || "",
    urgency: taskUrgency.value || "low",
    status: editId ? (tasks.find((t) => t.id === editId)?.status || "") : "",
  };

  let savedTask = null;
  if (editId) {
    const target = tasks.find((t) => t.id === editId);
    if (!target) return;
    Object.assign(target, payload);
    savedTask = target;
  } else {
    savedTask = { id: Date.now(), ...payload };
    tasks.push(savedTask);
  }

  persistAll();
  // Upsert only the task that was edited/created.
  // This prevents stale tabs/users from overwriting other tasks unintentionally.
  if (savedTask) sbScheduleUpsertOne(SB_TABLE_TASKS, savedTask);

  // Ensure modal reflects saved value if user re-opens immediately
  taskUpdate.value = combinedUpdate;

  closeModal();
  renderTasks();
  renderArchive();
}

/* =========================
   RENDERING
========================= */
const DEPT_KEYS = ["admin", "workforce", "compliance", "complaints"];
const DONE_KEY = "done";

function isDoneTask(t) {
  return String(t?.status || "").toLowerCase() === "done";
}

const KEY_TO_LABEL = {
  admin: "CAT-1",
  workforce: "CAT-2",
  compliance: "CAT-3",
  complaints: "CAT-4",
};
const LABEL_TO_KEY = Object.fromEntries(Object.entries(KEY_TO_LABEL).map(([k, v]) => [v, k]));

const LEGACY_KEYS = { teletrim: "alvin" };

function normalizeDeptKey(v) {
  const s = String(v || "").trim();
  const key = LABEL_TO_KEY[s] || s.toLowerCase();
  const resolved = LEGACY_KEYS[key] || key;
  return DEPT_KEYS.includes(resolved) ? resolved : "admin";
}

function keyToLabel(key) {
  return KEY_TO_LABEL[normalizeDeptKey(key)] || "Admin";
}

function renderTasks(filtered = null) {
  document.querySelectorAll(".tasks-container").forEach((c) => (c.innerHTML = ""));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const list = filtered || tasks;

  // Log Alvin tasks specifically
  const alvinTasks = list.filter((t) => normalizeDeptKey(t.department) === "alvin");
  console.log("ðŸŽ¯ Alvin tasks:", alvinTasks);

  updateColumnCounts(list);

  list.forEach((t) => {
    // Back-compat
    if (!t.deadline && t.due) t.deadline = t.due;
    if (!t.received && t.start) t.received = t.start;
    if (!t.urgency && t.priority) t.urgency = t.priority;
    if (!t.department && t.assignedTo) t.department = t.assignedTo;

    const deptKey = normalizeDeptKey(t.department);

    // If the UI doesn't have a "Done" column, keep done tasks visible in their department.
    const hasDoneColumn = !!document.querySelector(`[data-dept="${DONE_KEY}"] .tasks-container`);
    const targetKey = (isDoneTask(t) && hasDoneColumn) ? DONE_KEY : deptKey;

    const col = document.querySelector(`[data-dept="${targetKey}"] .tasks-container`);
    if (!col) return;

    const div = document.createElement("div");
    div.className = `task priority-${t.urgency || "low"}`;
    div.draggable = true;
    div.dataset.id = t.id;

    if (t.deadline) {
      const dueDate = parseLocalDate(t.deadline);
      if (dueDate) {
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate.getTime() === today.getTime()) div.classList.add("due-today");
        else if (dueDate.getTime() === tomorrow.getTime()) div.classList.add("due-tomorrow");
      }
    }

    const dueText = t.deadline ? formatDate(t.deadline) : "No deadline";
    const dueClass = t.deadline ? "task-due" : "task-due missing";

    div.innerHTML = `
      <div class="task-top">
        <div class="task-title">${escapeHTML(t.title)}</div>
                <div class="${dueClass}">${escapeHTML(dueText)}</div>
      </div>
      <div class="task-actions">
        <button class="archive-btn">Archive</button>
        ${isAdmin ? `<button class="delete-btn">Delete</button>` : ``}
      </div>
    `;

    div.querySelector(".archive-btn").onclick = async (e) => {
      e.stopPropagation();
      archive.push({ ...t, archivedAt: new Date().toLocaleString() });
      tasks = tasks.filter((x) => x.id !== t.id);

      await sbUpsertOne(SB_TABLE_ARCHIVE, archive[archive.length - 1]);
      await sbDeleteOne(SB_TABLE_TASKS, t.id);

      persistAll();
      renderTasks();
      renderArchive();
    };

    div.querySelector(".delete-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!isAdmin) return alert("Only admins can delete tasks.");
      if (confirm("Are you sure you want to delete this task?")) {
        tasks = tasks.filter((x) => x.id !== t.id);
        await sbDeleteOne(SB_TABLE_TASKS, t.id);
        persistAll();
        renderTasks();
      }
    });

    div.addEventListener("dragstart", (e) => {
      isDragging = true;
      e.dataTransfer.setData("id", div.dataset.id);
    });
    div.addEventListener("dragend", () => {
      setTimeout(() => (isDragging = false), 0);
    });

    div.addEventListener("click", () => {
      if (isDragging) return;
      openModal(t.id);
    });

    col.appendChild(div);
  });

  enableDragAndDrop();
}

function updateColumnCounts(list) {
  document.querySelectorAll(".column").forEach((col) => {
    const rawKey = String(col.dataset.dept || "").toLowerCase();
    const deptKey = rawKey === DONE_KEY ? DONE_KEY : normalizeDeptKey(rawKey);

    const title = col.querySelector(".title");
    if (!title) return;

    const baseTitle = title.dataset.base || title.textContent.replace(/\(\d+\)$/g, "").trim();
    title.dataset.base = baseTitle;

    const count =
      deptKey === DONE_KEY
        ? list.filter((t) => isDoneTask(t)).length
        : list.filter((t) => !isDoneTask(t) && normalizeDeptKey(t.department) === deptKey).length;

    title.textContent = `${baseTitle} (${count})`;
  });
}

function renderArchive() {
  archiveList.innerHTML = archive.length ? "" : "<p>No archived tasks</p>";

  archive.forEach((t) => {
    const div = document.createElement("div");
    div.className = "archive-item";

    div.innerHTML = `
      <div class="archive-title">${escapeHTML(t.title)}</div>
      <div class="archive-meta">
        <span>${escapeHTML(t.department || "")}</span>
        <span>${escapeHTML(t.archivedAt || "")}</span>
      </div>
      <div class="archive-actions">
        <button class="restore-btn">Restore</button>
        <button class="archive-delete-btn">Delete</button>
      </div>
    `;

    div.querySelector(".restore-btn").addEventListener("click", async () => {
      archive = archive.filter((x) => x.id !== t.id);

      const restored = { ...t };
      delete restored.archivedAt;

      tasks.push(restored);

      persistAll();

      await sbUpsertOne(SB_TABLE_TASKS, restored);
      await sbDeleteOne(SB_TABLE_ARCHIVE, t.id);

      renderTasks();
      renderArchive();
    });

    div.querySelector(".archive-delete-btn").addEventListener("click", async () => {
      if (!confirm("Delete this archived task permanently?")) return;

      archive = archive.filter((x) => x.id !== t.id);
      persistAll();

      await sbDeleteOne(SB_TABLE_ARCHIVE, t.id);

      renderArchive();
    });

    archiveList.appendChild(div);
  });
}

/* =========================
   DRAG & DROP
========================= */
function enableDragAndDrop() {
  document.querySelectorAll(".tasks-container").forEach((container) => {
    container.ondragover = (e) => e.preventDefault();
    container.ondrop = (e) => {
      e.preventDefault();
      isDragging = false;
      const id = +e.dataTransfer.getData("id");
      const t = tasks.find((x) => x.id === id);
      if (!t) return;

      const columnEl = container.closest(".column");
      const rawKey = String(columnEl?.dataset?.dept || "").toLowerCase();

      if (rawKey === DONE_KEY) {
        t.status = "done";
      } else {
        t.status = "";
        const deptKey = normalizeDeptKey(rawKey);
        t.department = keyToLabel(deptKey);
      }

      persistAll();
      // Only patch the fields that drag/drop is supposed to change.
      // This avoids overwriting other fields (like Update text) with stale data from another tab.
      sbPatchTask(t.id, { status: t.status, department: t.department });
      renderTasks();
    };
  });
}

/* =========================
   SEARCH
========================= */
function getFilteredTasks() {
  const q = (searchInput?.value || "").trim().toLowerCase();
  if (!q) return null;

  return tasks.filter((t) => {
    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.desc && t.desc.toLowerCase().includes(q)) ||
      (t.update && t.update.toLowerCase().includes(q)) ||
      (t.department && String(t.department).toLowerCase().includes(q)) ||
      (t.owner && String(t.owner).toLowerCase().includes(q)) ||
      (t.received && String(t.received).includes(q)) ||
      (t.deadline && String(t.deadline).includes(q)) ||
      (t.urgency && String(t.urgency).toLowerCase().includes(q))
    );
  });
}

function doSearch() {
  renderTasks(getFilteredTasks());
}

/* =========================
   EXPORT CSV
========================= */
function exportToWord() {
  const catMap = [
    { key: "admin",      checkId: "expCat1" },
    { key: "workforce",  checkId: "expCat2" },
    { key: "compliance", checkId: "expCat3" },
    { key: "complaints", checkId: "expCat4" },
  ];
  const includeArchive = document.getElementById("expArchive")?.checked;
  const selectedCats = catMap.filter(c => document.getElementById(c.checkId)?.checked);

  if (!selectedCats.length && !includeArchive) return alert("Please select at least one section to export.");

  const esc = (v) => String(v || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const urgencyLabel = (u) => u === "high" ? "High" : u === "medium" ? "Mid" : "Low";
  const urgencyColor = (u) => u === "high" ? "#C00000" : u === "medium" ? "#C55A11" : "#375623";

  const tableHeader = `
    <thead>
      <tr style="background:#1a3a8f;color:#fff;">
        <th style="padding:8px 10px;font-size:12px;text-align:left;border:1px solid #1a3a8f;">Title</th>
        <th style="padding:8px 10px;font-size:12px;text-align:left;border:1px solid #1a3a8f;">Description</th>
        <th style="padding:8px 10px;font-size:12px;text-align:left;border:1px solid #1a3a8f;">Update</th>
        <th style="padding:8px 10px;font-size:12px;text-align:center;border:1px solid #1a3a8f;">Owner</th>
        <th style="padding:8px 10px;font-size:12px;text-align:center;border:1px solid #1a3a8f;">Received</th>
        <th style="padding:8px 10px;font-size:12px;text-align:center;border:1px solid #1a3a8f;">Deadline</th>
        <th style="padding:8px 10px;font-size:12px;text-align:center;border:1px solid #1a3a8f;">Urgency</th>
      </tr>
    </thead>`;

  const makeRow = (t) => `
    <tr>
      <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:13px;">${esc(t.title)}</td>
      <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;color:#444;">${esc(t.desc)}</td>
      <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;color:#444;">${esc(t.update)}</td>
      <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;text-align:center;">${esc(t.owner)}</td>
      <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;text-align:center;">${esc(t.received)}</td>
      <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;text-align:center;">${esc(t.deadline) || "No deadline"}</td>
      <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;text-align:center;font-weight:700;color:${urgencyColor(t.urgency)}">${urgencyLabel(t.urgency)}</td>
    </tr>`;

  let sections = "";

  selectedCats.forEach(({ key }) => {
    const deptLabel = KEY_TO_LABEL[key];
    const group = tasks.filter((t) => !isDoneTask(t) && normalizeDeptKey(t.department) === key);
    if (!group.length) return;
    sections += `
      <h2 style="font-size:16px;font-weight:700;color:#1a3a8f;margin:28px 0 8px;padding-bottom:4px;border-bottom:2px solid #1a3a8f;">${esc(deptLabel)}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">${tableHeader}<tbody>${group.map(makeRow).join("")}</tbody></table>`;
  });

  if (includeArchive && archive.length) {
    sections += `
      <h2 style="font-size:16px;font-weight:700;color:#6b7a99;margin:28px 0 8px;padding-bottom:4px;border-bottom:2px solid #6b7a99;">Archived Tasks</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <thead>
          <tr style="background:#6b7a99;color:#fff;">
            <th style="padding:8px 10px;font-size:12px;text-align:left;border:1px solid #6b7a99;">Title</th>
            <th style="padding:8px 10px;font-size:12px;text-align:left;border:1px solid #6b7a99;">Description</th>
            <th style="padding:8px 10px;font-size:12px;text-align:left;border:1px solid #6b7a99;">Update</th>
            <th style="padding:8px 10px;font-size:12px;text-align:center;border:1px solid #6b7a99;">Owner</th>
            <th style="padding:8px 10px;font-size:12px;text-align:center;border:1px solid #6b7a99;">Received</th>
            <th style="padding:8px 10px;font-size:12px;text-align:center;border:1px solid #6b7a99;">Deadline</th>
            <th style="padding:8px 10px;font-size:12px;text-align:center;border:1px solid #6b7a99;">Archived On</th>
          </tr>
        </thead>
        <tbody>
          ${archive.map(t => `
            <tr>
              <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:13px;">${esc(t.title)}</td>
              <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;color:#444;">${esc(t.desc)}</td>
              <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;color:#444;">${esc(t.update)}</td>
              <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;text-align:center;">${esc(t.owner)}</td>
              <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;text-align:center;">${esc(t.received)}</td>
              <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;text-align:center;">${esc(t.deadline) || "No deadline"}</td>
              <td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:12px;text-align:center;color:#6b7a99;">${esc(t.archivedAt)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }

  if (!sections) return alert("No tasks found in the selected categories.");

  const exportDate = new Date().toLocaleDateString(undefined, {year:"numeric",month:"long",day:"numeric"});
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8"><title>Team Dashboard — Tasks</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
      <style>body{font-family:Calibri,Arial,sans-serif;margin:40px;color:#1a2540;}h1{font-size:22px;color:#1a3a8f;margin-bottom:4px;}.subtitle{font-size:12px;color:#6b7a99;margin-bottom:32px;}</style>
    </head>
    <body>
      <h1>Team Dashboard — Task Report</h1>
      <p class="subtitle">Exported on ${exportDate}</p>
      ${sections}
    </body></html>`;

  const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tasks.doc";
  link.click();
}
/* =========================
   THEME
========================= */
function loadTheme() {
  const mode = localStorage.getItem("theme") || "light";
  document.body.classList.toggle("dark", mode === "dark");
  if (themeSwitch) themeSwitch.checked = mode === "dark";
}

function toggleTheme() {
  const isDark = !!themeSwitch?.checked;
  document.body.classList.toggle("dark", isDark);
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

/* =========================
   INIT
========================= */
async function init() {
  loadTheme();

  // Auth first
  if (!(await requireAuth())) return;

  // âœ… FAST: render immediately from localStorage
  renderTasks();
  renderArchive();

  // Admin check (doesn't block initial render)
  isAdmin = await checkAdmin();
  renderTasks();

  // Supabase sync in the background (no blocking)
  if (isSupabaseConfigured()) {
    sbLoadAll().then((ok) => {
      if (ok) {
        renderTasks();
        renderArchive();
      }
    });
    enableRealtime();
  }

  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
  clearSearchBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    renderTasks();
  });

  exportCSVBtn?.addEventListener("click", () => {
    document.getElementById("exportModal").style.display = "flex";
  });

  document.getElementById("exportCancelBtn")?.addEventListener("click", () => {
    document.getElementById("exportModal").style.display = "none";
  });

  document.getElementById("exportConfirmBtn")?.addEventListener("click", () => {
    document.getElementById("exportModal").style.display = "none";
    exportToWord();
  });
  addTaskBtn?.addEventListener("click", () => openModal(null));
  logoutBtn?.addEventListener("click", doLogout);

  themeSwitch?.addEventListener("change", toggleTheme);

  saveBtn?.addEventListener("click", saveTask);
  cancelBtn?.addEventListener("click", closeModal);

  window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

init();
