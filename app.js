// 1. Supabase-Projekt anlegen und URL + anon key hier eintragen (siehe README).
const SUPABASE_URL = "https://omiuidxwakvpoeibombj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2cJb29EVJWLUVuZgJJSfsQ_AmSKjT6G";
const ROOM = new URLSearchParams(location.search).get("raum") || "fewo-schnell-oy";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_ANON_KEY.startsWith("DEIN_");
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = id => document.getElementById(id);

let month = new Date();
month.setDate(1);
let bookings = [], shopping = [], todos = [], photos = [], checkins = [], checkouts = [], messages = [], activities = [];
let sessionName = localStorage.getItem("fewo_name") || "";

const defaultsIn = [
  "Schlüssel holen / Zugang prüfen",
  "Wohnung kurz durchlüften",
  "Heizung und Warmwasser prüfen",
  "Kühlschrank einschalten",
  "Betten beziehen",
  "Bei Ankunft Schäden oder fehlende Dinge notieren"
];
const defaultsOut = [
  "Kühlschrank leeren",
  "Geschirr spülen und Küche aufräumen",
  "Müll entsorgen",
  "Fenster schließen",
  "Heizung passend einstellen",
  "Licht und Elektrogeräte ausschalten",
  "Schlüssel zurücklegen",
  "Wohnung abschließen"
];

document.querySelectorAll("nav button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("nav button,.panel").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    $(b.dataset.tab).classList.add("active");
  };
});

if (!configured) $("setup").hidden = false;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

function todayLocalISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function all(table) {
  if (!db) return [];
  const { data, error } = await db.from(table).select("*").eq("room", ROOM).order("created_at", { ascending: true });
  if (error) console.error(error);
  return data || [];
}

async function logActivity(action, detail) {
  if (!db) return;
  const { error } = await db.from("activity_log").insert({
    room: ROOM,
    actor: sessionName || "Jemand",
    action,
    detail
  });
  if (error) console.error(error);
}

function tableLabel(t) {
  return ({
    bookings: "eine Kalenderreservierung",
    shopping_items: "die Einkaufsliste",
    todos: "eine Aufgabe",
    photos: "ein Foto",
    checkin_items: "die Check-in-Liste",
    checkout_items: "die Check-out-Liste"
  })[t] || t;
}

function activityDetail(t, o) {
  return ({
    shopping_items: "Einkauf: " + (o.name || ""),
    todos: "Aufgabe: " + (o.title || ""),
    photos: "Foto: " + (o.caption || ""),
    checkin_items: "Check-in-Punkt: " + (o.name || ""),
    checkout_items: "Check-out-Punkt: " + (o.name || ""),
    bookings: `${o.name || ""} · ${o.start_date || ""} bis ${o.end_date || ""}`
  })[t] || tableLabel(t);
}

async function add(table, obj, actionWord = "hinzugefügt") {
  if (!db) return alert("Bitte zuerst Supabase einrichten (siehe README).");
  const { error } = await db.from(table).insert({ ...obj, room: ROOM });
  if (error) return alert(error.message);
  await logActivity(actionWord, activityDetail(table, obj));
  await refresh();
}

async function del(table, id) {
  if (!db) return;
  const { error } = await db.from(table).delete().eq("id", id).eq("room", ROOM);
  if (error) return alert(error.message);
  await logActivity("entfernt", tableLabel(table));
  await refresh();
}

async function update(table, id, obj) {
  if (!db) return;
  const { error } = await db.from(table).update(obj).eq("id", id).eq("room", ROOM);
  if (error) return alert(error.message);
  await logActivity("aktualisiert", tableLabel(table));
  await refresh();
}

async function refresh() {
  if (!db) {
    renderChecks();
    renderCalendar();
    renderShopping();
    renderTodos();
    renderPhotos();
    renderMessages();
    renderActivity();
    return;
  }
  [bookings, shopping, todos, photos, checkins, checkouts, messages, activities] = await Promise.all(
    ["bookings", "shopping_items", "todos", "photos", "checkin_items", "checkout_items", "messages", "activity_log"].map(all)
  );
  renderCalendar();
  renderShopping();
  renderTodos();
  renderPhotos();
  renderChecks();
  renderMessages();
  renderActivity();
}

// Kalender
function dateInRange(date, b) {
  return date >= b.start_date && date <= b.end_date;
}

function renderCalendar() {
  const y = month.getFullYear(), m = month.getMonth();
  $("month-title").textContent = month.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const grid = $("calendar-grid");
  grid.innerHTML = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(x => `<div class="weekday">${x}</div>`).join("");
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const today = todayLocalISO();

  for (let i = 0; i < offset; i++) {
    grid.insertAdjacentHTML("beforeend", '<div class="day empty"></div>');
  }
  for (let d = 1; d <= days; d++) {
    const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const b = bookings.find(x => dateInRange(date, x));
    const el = document.createElement("button");
    el.className = "day" + (b ? " busy" : "") + (date === today ? " today" : "");
    el.innerHTML = `${d}${b ? `<span class="who">${esc(b.name)}</span>` : ""}`;
    el.onclick = () => bookingClick(date, b);
    grid.append(el);
  }
}

async function bookingClick(date, b) {
  if (!db) return alert("Bitte zuerst Supabase einrichten (siehe README).");
  if (b) {
    if (confirm(`${b.start_date} bis ${b.end_date}: Belegt von ${b.name}. Gesamte Reservierung entfernen?`)) {
      await del("bookings", b.id);
    }
    return;
  }
  const start = prompt("Anreisedatum (JJJJ-MM-TT):", date);
  if (!start) return;
  const end = prompt("Abreisedatum (JJJJ-MM-TT, letzter belegter Tag):", start);
  if (!end) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    alert("Bitte gültige Datumsangaben eingeben. Das Enddatum darf nicht vor dem Startdatum liegen.");
    return;
  }
  if (bookings.some(x => !(end < x.start_date || start > x.end_date))) {
    alert("Der Zeitraum überschneidet sich mit einer bestehenden Reservierung.");
    return;
  }
  const name = prompt("Wer reserviert diesen Zeitraum?");
  if (name?.trim()) {
    sessionName = name.trim();
    localStorage.setItem("fewo_name", sessionName);
    await add("bookings", { start_date: start, end_date: end, name: name.trim() }, "reserviert");
  }
}

$("prev").onclick = () => { month.setMonth(month.getMonth() - 1); renderCalendar(); };
$("next").onclick = () => { month.setMonth(month.getMonth() + 1); renderCalendar(); };

// Einkaufsliste
function renderShopping() {
  $("shopping-list").innerHTML = shopping.map(x => `
    <div class="item">
      <input type="checkbox" style="width:auto" ${x.done ? "checked" : ""} onchange="window.toggleShopping('${x.id}',this.checked)">
      <span style="${x.done ? "text-decoration:line-through;color:#888" : ""}">${esc(x.name)} <small>${x.added_by ? "· " + esc(x.added_by) : ""}</small></span>
      <button class="delete" onclick="window.removeShopping('${x.id}')">Entfernen</button>
    </div>
  `).join("") || '<p class="muted">Noch ist nichts auf der Liste.</p>';
}
window.toggleShopping = (id, done) => update("shopping_items", id, { done });
window.removeShopping = id => del("shopping_items", id);
$("shopping-form").onsubmit = async e => {
  e.preventDefault();
  const who = $("shopping-by").value.trim();
  if (who) { sessionName = who; localStorage.setItem("fewo_name", who); }
  await add("shopping_items", { name: $("shopping-name").value.trim(), added_by: who, done: false });
  e.target.reset();
};

// To-dos
function renderTodos() {
  $("todo-list").innerHTML = todos.map(x => `
    <div class="item">
      <input type="checkbox" style="width:auto" ${x.done ? "checked" : ""} onchange="window.toggleTodo('${x.id}',this.checked)">
      <span style="${x.done ? "text-decoration:line-through;color:#888" : ""}">${esc(x.title)} <small>· ${esc(x.priority)} ${x.added_by ? "· " + esc(x.added_by) : ""}</small></span>
      <button class="delete" onclick="window.removeTodo('${x.id}')">Löschen</button>
    </div>
  `).join("") || '<p class="muted">Keine offenen Aufgaben.</p>';
}
window.toggleTodo = (id, done) => update("todos", id, { done });
window.removeTodo = id => del("todos", id);
$("todo-form").onsubmit = async e => {
  e.preventDefault();
  const who = $("todo-by").value.trim();
  if (who) { sessionName = who; localStorage.setItem("fewo_name", who); }
  await add("todos", { title: $("todo-title").value.trim(), added_by: who, priority: $("todo-priority").value, done: false });
  e.target.reset();
};

// Checklisten: Standardpunkte bleiben erhalten, auch wenn einzelne Punkte in DB liegen
function mergedCheckItems(dbItems, defaults) {
  const existingNames = new Set(dbItems.map(item => item.name.trim().toLowerCase()));
  const missingDefaults = defaults
    .map((name, index) => ({ id: "default" + index, name, done: false, local: true }))
    .filter(item => !existingNames.has(item.name.trim().toLowerCase()));
  return [...dbItems, ...missingDefaults];
}

function renderChecks() {
  drawCheck("checkin", checkins, defaultsIn, "checkin_items");
  drawCheck("checkout", checkouts, defaultsOut, "checkout_items");
}

function drawCheck(id, items, defaults, table) {
  const list = mergedCheckItems(items, defaults);
  $(id).innerHTML = list.map(x => `
    <div class="item">
      <input type="checkbox" style="width:auto" ${x.done ? "checked" : ""} onchange="window.checkItem('${table}','${x.id}',this.checked,${!!x.local})">
      <span style="${x.done ? "text-decoration:line-through;color:#888" : ""}">${esc(x.name)}</span>
      ${x.local ? "" : `<button class="delete" onclick="window.deleteCheck('${table}','${x.id}')">×</button>`}
    </div>
  `).join("");
}

window.checkItem = async (table, id, done, local) => {
  if (local) {
    const source = table === "checkin_items" ? defaultsIn : defaultsOut;
    await add(table, { name: source[Number(id.slice(7))], done });
  } else {
    await update(table, id, { done });
  }
};
window.deleteCheck = (table, id) => del(table, id);

function addCheckForm(form, input, table) {
  $(form).onsubmit = async e => {
    e.preventDefault();
    const val = $(input).value.trim();
    if (!val) return;
    await add(table, { name: val, done: false });
    $(input).value = "";
  };
}
addCheckForm("add-checkin", "new-checkin", "checkin_items");
addCheckForm("add-checkout", "new-checkout", "checkout_items");

async function resetChecklist(table) {
  if (!db) return alert("Bitte zuerst Supabase einrichten.");
  if (!confirm("Alle Häkchen dieser Checkliste für den neuen Aufenthalt zurücksetzen?")) return;
  const { error } = await db.from(table).update({ done: false }).eq("room", ROOM);
  if (error) return alert(error.message);
  await logActivity("zurückgesetzt", table === "checkin_items" ? "Check-in-Checkliste" : "Check-out-Checkliste");
  await refresh();
}
$("reset-checkin").onclick = () => resetChecklist("checkin_items");
$("reset-checkout").onclick = () => resetChecklist("checkout_items");

// Fotos (inkl. Storage-Löschung beim Entfernen)
function renderPhotos() {
  $("photo-list").innerHTML = photos.map(x => `
    <div class="card photo-card">
      <img class="photo" src="${esc(x.url)}" alt="${esc(x.caption || "Foto")}">
      <p>${esc(x.caption)}</p>
      <button class="delete" onclick="window.removePhoto('${x.id}','${esc(x.path || "")}')">Foto entfernen</button>
    </div>
  `).join("") || '<p class="muted">Noch keine Fotos hochgeladen.</p>';
}

window.removePhoto = async (id, path) => {
  if (!db) return;
  if (path) {
    const { error: storageError } = await db.storage.from("wohnung-fotos").remove([path]);
    if (storageError) console.warn("Storage-Löschung:", storageError.message);
  }
  await del("photos", id);
};

$("photo-form").onsubmit = async e => {
  e.preventDefault();
  if (!db) return alert("Bitte zuerst Supabase einrichten.");
  const file = $("photo-file").files[0];
  if (!file) return;
  const path = `${ROOM}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await db.storage.from("wohnung-fotos").upload(path, file);
  if (error) return alert(error.message);
  const { data } = db.storage.from("wohnung-fotos").getPublicUrl(path);
  await add("photos", { url: data.publicUrl, caption: $("photo-caption").value.trim(), path });
  e.target.reset();
};

// Wohnungsinfos & Titelbild
$("save-info").onclick = async () => {
  if (!db) return alert("Bitte zuerst Supabase einrichten.");
  const obj = {
    room: ROOM,
    address: $("info-address").value,
    general: $("info-general").value,
    wifi: $("info-wifi").value,
    password: $("info-password").value
  };
  const { error } = await db.from("apartment_info").upsert(obj, { onConflict: "room" });
  if (error) return alert(error.message);
  await logActivity("aktualisiert", "Wohnungsinfos");
  alert("Wohnungsinfos gespeichert.");
  await refresh();
};

async function loadInfo() {
  if (!db) return;
  const { data } = await db.from("apartment_info").select("*").eq("room", ROOM).maybeSingle();
  if (data) {
    $("info-address").value = data.address || "Mittelbergstraße 13b, 87466 Oy-Mittelberg";
    $("info-general").value = data.general || "";
    $("info-wifi").value = data.wifi || "";
    $("info-password").value = data.password || "";
    if (data.cover_url) $("cover-image").src = data.cover_url;
  }
}

$("upload-cover").onclick = async () => {
  if (!db) return alert("Bitte zuerst Supabase einrichten.");
  const file = $("cover-file").files[0];
  if (!file) return alert("Bitte zuerst ein Foto auswählen.");
  const path = `${ROOM}/titelbild-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await db.storage.from("wohnung-fotos").upload(path, file);
  if (error) return alert(error.message);
  const { data } = db.storage.from("wohnung-fotos").getPublicUrl(path);
  const { error: saveError } = await db.from("apartment_info").upsert({ room: ROOM, cover_url: data.publicUrl }, { onConflict: "room" });
  if (saveError) return alert(saveError.message);
  $("cover-image").src = data.publicUrl;
  await logActivity("aktualisiert", "Titelbild");
  alert("Titelbild wurde aktualisiert.");
  await refresh();
};

// Nachrichten & Änderungsverlauf
function renderMessages() {
  $("message-list").innerHTML = messages.slice().reverse().map(m => `
    <div class="message">
      <div class="row"><h3>${esc(m.title || "Nachricht")}</h3><small>${new Date(m.created_at).toLocaleString("de-DE")}</small></div>
      <p>${esc(m.body)}</p>
      <small class="muted">Von ${esc(m.author || "Unbekannt")}</small>
      <button class="delete" onclick="window.deleteMessage('${m.id}')">Löschen</button>
    </div>
  `).join("") || '<p class="muted">Noch keine Nachrichten. Schreibe die erste Info für alle!</p>';
}

function renderActivity() {
  $("activity-list").innerHTML = activities.slice().reverse().slice(0, 25).map(a => `
    <div class="activity">
      <b>${esc(a.actor || "Jemand")}</b> ${esc(a.action)}: ${esc(a.detail || "")}<br>
      <small class="muted">${new Date(a.created_at).toLocaleString("de-DE")}</small>
    </div>
  `).join("") || '<p class="muted">Noch keine Änderungen protokolliert.</p>';
}

$("message-form").onsubmit = async e => {
  e.preventDefault();
  if (!db) return alert("Bitte zuerst Supabase einrichten.");
  const author = $("message-author").value.trim();
  sessionName = author;
  localStorage.setItem("fewo_name", author);
  const { error } = await db.from("messages").insert({
    room: ROOM,
    author,
    title: $("message-title").value.trim(),
    body: $("message-body").value.trim()
  });
  if (error) return alert(error.message);
  await logActivity("geschrieben", "eine Nachricht für alle");
  e.target.reset();
  $("message-author").value = author;
  await refresh();
};

window.deleteMessage = async id => {
  if (!confirm("Diese Nachricht wirklich löschen?")) return;
  const { error } = await db.from("messages").delete().eq("id", id).eq("room", ROOM);
  if (error) return alert(error.message);
  await logActivity("gelöscht", "eine Nachricht");
  await refresh();
};

if ($("message-author")) $("message-author").value = sessionName;

if (db) {
  refresh();
  loadInfo();
  db.channel("room-" + ROOM)
    .on("postgres_changes", { event: "*", schema: "public", filter: `room=eq.${ROOM}` }, () => {
      refresh();
      loadInfo();
    })
    .subscribe();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}