// js/storage.js
// Storage + shared helper functions. Har page par sab se pehle load hoti hai.

const STORAGE_KEYS = {
  company: "hcm_company",
  admin: "hcm_admin",
  employees: "hcm_employees",
  attendance: "hcm_attendance",
  leaves: "hcm_leaves",
  settings: "hcm_settings",
  currentUser: "hcm_current_user",
  theme: "hcm_theme",
};

// Admin ne settings save na ki ho to ye default rules use honge
const DEFAULT_SETTINGS = {
  officeStartTime: "09:00",
  graceMinutes: 15,
  halfDayAfterMinutes: 120, // office start se itne minute baad aaye to Half Day
  leaveQuota: 20,
  workingDays: [1, 2, 3, 4, 5], // 0 = Sunday ... 6 = Saturday
};

/* ---------- localStorage ---------- */

function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Data save nahi hua:", error);
    return false;
  }
}

function getData(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data !== null ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error("Data load nahi hua:", error);
    return defaultValue;
  }
}

function removeData(key) {
  localStorage.removeItem(key);
}

// Saara HCM data clear karo (theme ki setting rehne do)
function clearHCMData() {
  Object.values(STORAGE_KEYS).forEach((key) => {
    if (key !== STORAGE_KEYS.theme) localStorage.removeItem(key);
  });
}

/* ---------- Shortcuts ---------- */

function getEmployees() {
  return getData(STORAGE_KEYS.employees, []);
}

function getAttendance() {
  return getData(STORAGE_KEYS.attendance, []);
}

function getLeaves() {
  return getData(STORAGE_KEYS.leaves, []);
}

function getCurrentUser() {
  return getData(STORAGE_KEYS.currentUser, null);
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...getData(STORAGE_KEYS.settings, {}) };
}

function getCompanyName() {
  return getData(STORAGE_KEYS.company, {})?.name || "HCM Lite";
}

/* ---------- Dates and time ---------- */

// Date ko YYYY-MM-DD string banata hai (local time ke hisaab se)
function toDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getToday() {
  return toDateString();
}

// Abhi ka time 24 ghante format mein, jaise "09:05"
function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// "09:30" ko minutes mein badalta hai (570)
function timeToMinutes(time) {
  const [hours, minutes] = String(time || "")
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
}

// Do dates ke beech total din (dono din shamil)
function countDays(from, to) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const days = Math.round((end - start) / 86400000) + 1;
  return Math.max(days, 0);
}

// Do dates ke beech sirf working days (settings ke working days ke mutabiq)
function countWorkingDays(from, to, workingDays = getSettings().workingDays) {
  let count = 0;
  const current = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  while (current <= end) {
    if (workingDays.includes(current.getDay())) count++;
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/* ---------- Formatting ---------- */

function formatCurrency(amount) {
  return `Rs ${Number(amount || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() || "")
      .join("") || "U"
  );
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Toast message (alert ki jagah) ---------- */

function showToast(message, type = "info") {
  let box = document.getElementById("toastBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    box.className = "toast-box";
    box.setAttribute("aria-live", "polite");
    document.body.appendChild(box);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  box.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
