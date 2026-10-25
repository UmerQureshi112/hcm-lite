
(function () {
  "use strict";

  const script = document.currentScript;
  const requiredRole = script?.dataset?.role || "";

  const scriptURL = script?.src
    ? new URL(script.src, window.location.href)
    : new URL("../js/auth.js", window.location.href);

  const ROOT_URL = new URL("../", scriptURL).href;
  const LOGIN_PAGE = new URL("index.html", ROOT_URL).href;
  const ADMIN_PAGE = new URL("pages/admin.html", ROOT_URL).href;
  const EMPLOYEE_PAGE = new URL("pages/employee.html", ROOT_URL).href;
  const SETUP_PAGE = new URL("setup.html", ROOT_URL).href;

  function getStoredData(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.error(`Unable to read ${key}:`, error);
      return fallback;
    }
  }

  function saveStoredData(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Unable to save ${key}:`, error);
      return false;
    }
  }

  function getAdmin() {
    return getStoredData("hcm_admin");
  }

  function getEmployees() {
    const employees = getStoredData("hcm_employees", []);
    return Array.isArray(employees) ? employees : [];
  }

  function getCurrentUser() {
    return getStoredData("hcm_currentUser");
  }

  function clearCurrentUser() {
    localStorage.removeItem("hcm_currentUser");
  }

  function getValidUser() {
    const user = getCurrentUser();

    if (!user || !user.id || !user.role) {
      return null;
    }

    if (user.role === "admin") {
      const admin = getAdmin();

      if (!admin || admin.email?.toLowerCase() !== user.email?.toLowerCase()) {
        clearCurrentUser();
        return null;
      }

      return user;
    }

    if (user.role === "employee") {
      const employee = getEmployees().find(
        (item) =>
          String(item.id) === String(user.id) &&
          item.email?.toLowerCase() === user.email?.toLowerCase()
      );

      if (!employee || employee.status === "Inactive") {
        clearCurrentUser();
        return null;
      }

      return {
        ...user,
        name: employee.name || employee.fullName || user.name,
        email: employee.email,
        role: "employee"
      };
    }

    clearCurrentUser();
    return null;
  }

  function startSession(user, role) {
    const session = {
      id: user.id,
      name: user.name || user.fullName || "User",
      email: user.email,
      role
    };

    if (!saveStoredData("hcm_currentUser", session)) {
      showError("Unable to save your session. Please check browser storage.");
      return;
    }

    window.location.href =
      role === "admin" ? ADMIN_PAGE : EMPLOYEE_PAGE;
  }

  function showError(message) {
    const errorElement =
      document.getElementById("loginError") ||
      document.getElementById("setupError") ||
      document.getElementById("formError");

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = "block";
    } else {
      alert(message);
    }
  }

  function hideError() {
    const errorElement =
      document.getElementById("loginError") ||
      document.getElementById("setupError") ||
      document.getElementById("formError");

    if (errorElement) {
      errorElement.textContent = "";
      errorElement.style.display = "none";
    }
  }

  function setupLoginPage() {
    const loginForm = document.getElementById("loginForm");

    if (!loginForm) return;

    const existingUser = getValidUser();

    if (existingUser) {
      window.location.replace(
        existingUser.role === "admin" ? ADMIN_PAGE : EMPLOYEE_PAGE
      );
      return;
    }

    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      hideError();

      const emailInput = document.getElementById("loginEmail");
      const passwordInput = document.getElementById("loginPassword");

      const email = emailInput?.value.trim().toLowerCase();
      const password = passwordInput?.value;

      if (!email || !password) {
        showError("Please enter your email and password.");
        return;
      }

      const admin = getAdmin();

      if (
        admin &&
        admin.email?.toLowerCase() === email &&
        admin.password === password
      ) {
        startSession(
          {
            id: admin.id || "admin",
            name: admin.name || admin.fullName || "Admin",
            email: admin.email
          },
          "admin"
        );
        return;
      }

      const employee = getEmployees().find(
        (item) =>
          item.email?.toLowerCase() === email &&
          item.password === password &&
          item.status !== "Inactive"
      );

      if (employee) {
        startSession(
          {
            id: employee.id,
            name: employee.name || employee.fullName || "Employee",
            email: employee.email
          },
          "employee"
        );
        return;
      }

      showError("Invalid email or password, or your account is inactive.");
    });
  }

  function setupSetupPage() {
    const setupForm = document.getElementById("setupForm");

    if (!setupForm) return;

    const admin = getAdmin();

    if (admin) {
      const setupSection = document.getElementById("setupSection");
      const loginSection = document.getElementById("loginSection");

      if (setupSection) setupSection.style.display = "none";
      if (loginSection) loginSection.style.display = "block";

      return;
    }

    setupForm.addEventListener("submit", function (event) {
      event.preventDefault();
      hideError();

      const name =
        document.getElementById("adminName")?.value.trim() || "";
      const email =
        document.getElementById("adminEmail")?.value.trim().toLowerCase() || "";
      const password =
        document.getElementById("adminPassword")?.value || "";
      const confirmPassword =
        document.getElementById("confirmPassword")?.value || "";

      if (!name || !email || !password || !confirmPassword) {
        showError("Please complete all required fields.");
        return;
      }

      if (password.length < 8) {
        showError("Password must contain at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        showError("Passwords do not match.");
        return;
      }

      const newAdmin = {
        id: "admin",
        name,
        email,
        password,
        role: "admin"
      };

      if (!saveStoredData("hcm_admin", newAdmin)) {
        showError("Unable to save admin details. Please try again.");
        return;
      }

      alert("Admin account created successfully. Please log in.");
      window.location.href = LOGIN_PAGE;
    });
  }

  function protectPage() {
    const user = getValidUser();

    if (!user) {
      window.location.replace(LOGIN_PAGE);
      return;
    }

    if (requiredRole && requiredRole !== "any" && user.role !== requiredRole) {
      window.location.replace(
        user.role === "admin" ? ADMIN_PAGE : EMPLOYEE_PAGE
      );
      return;
    }

    fillUserInfo(user);
    setupLogoutButtons();
  }

  function fillUserInfo(user) {
    const name = user.name || user.fullName || "User";

    [
      "adminName",
      "employeeName",
      "welcomeName",
      "userName",
      "profileName"
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = name;
    });

    const emailElement = document.getElementById("profileEmail");
    if (emailElement) emailElement.textContent = user.email || "";

    const roleElement = document.getElementById("userRole");
    if (roleElement) {
      roleElement.textContent =
        user.role === "admin" ? "Administrator" : "Employee";
    }
  }

  function setupLogoutButtons() {
    const logoutButtons = document.querySelectorAll(
      "#logoutBtn, #logoutButton, [data-logout]"
    );

    logoutButtons.forEach((button) => {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        clearCurrentUser();
        window.location.replace(LOGIN_PAGE);
      });
    });
  }

  function initializeAuth() {
    const path = window.location.pathname.toLowerCase();

    if (path.endsWith("/setup.html") || path.endsWith("setup.html")) {
      setupSetupPage();
      return;
    }

    if (
      path.endsWith("/index.html") ||
      path.endsWith("index.html") ||
      path.endsWith("/")
    ) {
      setupLoginPage();
      return;
    }

    protectPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAuth);
  } else {
    initializeAuth();
  }
})();
