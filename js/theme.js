const THEME_STORAGE_KEY = "panelbasico-theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    // localStorage no disponible (modo privado, etc.) — el tema no se recuerda, pero no rompe nada.
  }

  const label = theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  document.querySelectorAll(".theme-toggle").forEach((toggle) => {
    toggle.setAttribute("aria-label", label);
  });
}

function initTheme() {
  const toggles = document.querySelectorAll(".theme-toggle");
  if (toggles.length === 0) return;

  const current = document.documentElement.getAttribute("data-theme") || "light";
  const label = current === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  toggles.forEach((toggle) => {
    toggle.setAttribute("aria-label", label);
    toggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  });
}

initTheme();
