// js/theme.js
// Dark / Light mode with saved preference.

(function () {
  const THEME_KEY = "hcm_theme";
  const root = document.documentElement;

  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);

      if (saved === "dark" || saved === "light") {
        return saved;
      }
    } catch (error) {
      // localStorage unavailable; use system preference.
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.error("Theme save nahi hui:", error);
    }
  }

  function updateButton(button) {
    if (!button) return;

    const isDark = root.classList.contains("dark");

    button.innerHTML = isDark
      ? '<span aria-hidden="true">☀️</span><span class="theme-label">Light</span>'
      : '<span aria-hidden="true">🌙</span><span class="theme-label">Dark</span>';

    button.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  // Page render hone se pehle saved theme apply karo.
  applyTheme(getSavedTheme());

  document.addEventListener("DOMContentLoaded", () => {
    let buttons = [
      document.getElementById("themeToggle"),
      document.getElementById("themeToggleSettings"),
    ].filter(Boolean);

    // Agar kisi page par theme button nahi hai, to ek create karo.
    if (buttons.length === 0) {
      const button = document.createElement("button");
      button.id = "themeToggle";
      button.type = "button";
      button.className = "theme-toggle";
      button.setAttribute("type", "button");

      const slot = document.querySelector("[data-theme-slot]");

      if (slot) {
        slot.appendChild(button);
      } else {
        button.classList.add("floating");
        document.body.appendChild(button);
      }

      buttons = [button];
    }

    function refreshButtons() {
      buttons.forEach(updateButton);
    }

    function toggleTheme() {
      const nextTheme = root.classList.contains("dark") ? "light" : "dark";

      applyTheme(nextTheme);
      saveTheme(nextTheme);
      refreshButtons();
    }

    buttons.forEach((button) => {
      button.addEventListener("click", toggleTheme);
    });

    // Doosre tab mein theme change ho to yahan bhi update karo.
    window.addEventListener("storage", (event) => {
      if (event.key === THEME_KEY) {
        applyTheme(getSavedTheme());
        refreshButtons();
      }
    });

    refreshButtons();
  });
})();
