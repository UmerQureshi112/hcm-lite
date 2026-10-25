// js/auth.js
// Login, first-time setup, logout aur page guard.
// Ye script <head> mein bina defer ke load hogi, taake bina login wala page dikhne se pehle hi redirect ho jaye.

(function () {
  // <script src="../js/auth.js" data-role="admin"> se page ka role milta hai.
  // currentScript sirf script ke chalte waqt milta hai, isliye sab se pehle yahin le lo.
  const currentScript = document.currentScript;
  const requiredRole = currentScript?.dataset.role || "";

  // auth.js ka poora address (window.location.href jaisa) nikalo,
  // phir ek folder upar jaakar project ka root mil jata hai.
  // Is tarah page "/" par ho, "/pages/" par ho ya file:// par, raasta hamesha sahi rahega.
  const scriptUrl = currentScript?.src || window.location.href;
  const ROOT_URL = new URL("../", scriptUrl).href;

  const LOGIN_PAGE = `${ROOT_URL}index.html`;

  const HOME_PAGE = {
    admin: `${ROOT_URL}pages/admin.html`,
    employee: `${ROOT_URL}pages/employee.html`,
  };

  /* ---------- Session ---------- */

  // Sirf wahi user wapas deta hai jo abhi bhi system mein maujood ho
  function getValidUser() {
    const user = getCurrentUser();
    if (!user) return null;

    if (user.role === "admin") {
      const admin = getData(STORAGE_KEYS.admin, null);
      return admin && admin.email === user.email ? user : null;
    }

    if (user.role === "employee") {
      const exists = getEmployees().some(
        (employee) => String(employee.id) === String(user.id),
      );
      return exists ? user : null;
    }

    return null;
  }

  function logout() {
    removeData(STORAGE_KEYS.currentUser);
    window.location.href = LOGIN_PAGE;
  }

  // Doosri files bhi logout() call kar sakti hain
  window.logout = logout;

  /* ---------- Page guard ---------- */

  const user = getValidUser();

  // Purana ya kharab session saaf kar do
  if (!user && getCurrentUser()) {
    removeData(STORAGE_KEYS.currentUser);
  }

  if (requiredRole) {
    // replace() se back button dabane par guard wala page dobara nahi khulta
    if (!user) {
      window.location.replace(LOGIN_PAGE);
      return;
    }

    if (requiredRole !== "any" && user.role !== requiredRole) {
      window.location.replace(HOME_PAGE[user.role]);
      return;
    }
  }

  /* ---------- Page ka common kaam ---------- */

  function setupLogoutButtons() {
    document
      .querySelectorAll("#logoutBtn, [data-logout]")
      .forEach((button) => button.addEventListener("click", logout));
  }

  // Header mein user ka naam, role aur company ka naam bharo
  function fillUserInfo() {
    if (!user) return;

    document.querySelectorAll("[data-user-name]").forEach((el) => {
      el.textContent = user.name;
    });

    document.querySelectorAll("[data-user-role]").forEach((el) => {
      el.textContent = user.role === "admin" ? "Administrator" : "Employee";
    });

    document.querySelectorAll("[data-user-initials]").forEach((el) => {
      el.textContent = getInitials(user.name);
    });

    document.querySelectorAll("[data-company-name]").forEach((el) => {
      el.textContent = getCompanyName();
    });
  }

  /* ---------- Login page (index.html) ---------- */

  function setupLoginPage() {
    const setupSection = document.getElementById("setupSection");
    const loginSection = document.getElementById("loginSection");
    const setupForm = document.getElementById("setupForm");
    const loginForm = document.getElementById("loginForm");

    if (!setupForm || !loginForm) return;

    // Pehle se login hai to seedha dashboard par bhejo
    if (user) {
      window.location.href = HOME_PAGE[user.role];
      return;
    }

    const setupError = document.getElementById("setupError");
    const loginError = document.getElementById("loginError");

    // Admin pehle se bana hai to login dikhao, warna setup
    function showCorrectSection() {
      const adminExists = Boolean(getData(STORAGE_KEYS.admin, null));
      setupSection.hidden = adminExists;
      loginSection.hidden = !adminExists;
    }

    function readValue(id) {
      return document.getElementById(id)?.value ?? "";
    }

    function startSession(sessionUser) {
      saveData(STORAGE_KEYS.currentUser, sessionUser);
      window.location.href = HOME_PAGE[sessionUser.role];
    }

    // Typing shuru karte hi purana error hata do
    setupForm.addEventListener("input", () => (setupError.textContent = ""));
    loginForm.addEventListener("input", () => (loginError.textContent = ""));

    // Company aur admin setup
    setupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      setupError.textContent = "";

      const companyName = readValue("companyName").trim();
      const adminName = readValue("adminName").trim();
      const adminEmail = readValue("adminEmail").trim().toLowerCase();
      const adminPassword = readValue("adminPassword");

      if (getData(STORAGE_KEYS.admin, null)) {
        setupError.textContent = "Company is already set up. Please log in.";
        showCorrectSection();
        return;
      }

      if (!companyName || !adminName || !adminEmail || !adminPassword) {
        setupError.textContent = "Please fill in all fields.";
        return;
      }

      if (adminPassword.length < 6) {
        setupError.textContent = "Password must be at least 6 characters.";
        return;
      }

      const admin = {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: "admin",
      };

      const saved =
        saveData(STORAGE_KEYS.company, { name: companyName }) &&
        saveData(STORAGE_KEYS.admin, admin) &&
        saveData(STORAGE_KEYS.employees, getEmployees()) &&
        saveData(STORAGE_KEYS.attendance, getAttendance()) &&
        saveData(STORAGE_KEYS.leaves, getLeaves()) &&
        saveData(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS });

      if (!saved) {
        setupError.textContent = "Could not save data. Check browser storage.";
        return;
      }

      // Setup ke baad admin khud login ho jata hai
      startSession({ name: admin.name, email: admin.email, role: "admin" });
    });

    // Login
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      loginError.textContent = "";

      const email = readValue("email").trim().toLowerCase();
      const password = readValue("password");

      if (!email || !password) {
        loginError.textContent = "Enter your email and password.";
        return;
      }

      const admin = getData(STORAGE_KEYS.admin, null);

      if (admin && admin.email === email && admin.password === password) {
        startSession({ name: admin.name, email: admin.email, role: "admin" });
        return;
      }

      const employee = getEmployees().find(
        (item) =>
          item.email?.toLowerCase() === email && item.password === password,
      );

      if (employee) {
        startSession({
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: "employee",
        });
        return;
      }

      loginError.textContent = "Invalid email or password.";
    });

    showCorrectSection();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupLogoutButtons();
    fillUserInfo();
    setupLoginPage();
  });
})();