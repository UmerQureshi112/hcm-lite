// js/theme.js
// Dark / Light mode. Saved theme page load hote hi apply hoti hai (flash se bachne ke liye).

(function () {
  const THEME_KEY = "hcm_theme";
  const root = document.documentElement;

  // Pehli dafa user ne kuch choose nahi kiya to device ki setting dekho
  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch (error) {
      // localStorage block ho to default chalega
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

  // Script <head> mein ho to page dikhne se pehle theme lag jati hai
  applyTheme(getSavedTheme());

  document.addEventListener("DOMContentLoaded", () => {
    let toggle = document.getElementById("themeToggle");

    // Button HTML mein na ho to bana do
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.id = "themeToggle";
      toggle.type = "button";
      toggle.className = "theme-toggle";

      const slot = document.querySelector("[data-theme-slot]");

      if (slot) {
        slot.appendChild(toggle);
      } else {
        // Slot na ho (jaise login page) to screen ke corner mein float karega
        toggle.classList.add("floating");
        document.body.appendChild(toggle);
      }
    }

    function updateButton() {
      const isDark = root.classList.contains("dark");

      toggle.innerHTML = isDark
        ? '<span aria-hidden="true">☀️</span><span class="theme-label">Light</span>'
        : '<span aria-hidden="true">🌙</span><span class="theme-label">Dark</span>';

      toggle.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode",
      );
    }

    toggle.addEventListener("click", () => {
      const nextTheme = root.classList.contains("dark") ? "light" : "dark";
      applyTheme(nextTheme);
      saveTheme(nextTheme);
      updateButton();
    });

    // Doosre tab mein theme badle to ye tab bhi badal jaye
    window.addEventListener("storage", (event) => {
      if (event.key === THEME_KEY) {
        applyTheme(getSavedTheme());
        updateButton();
      }
    });

    updateButton();
  });
})();
