(function () {
  const initialColorScheme = "dark"; // "light" | "dark"
  const currentTheme = localStorage.getItem("theme");

  function getPreferTheme() {
    if (currentTheme) return currentTheme;
    if (initialColorScheme) return initialColorScheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  const themeValue = getPreferTheme();

  // Set theme immediately to prevent flash
  document.firstElementChild?.setAttribute("data-theme", themeValue);

  // Export minimal API for external script
  window.theme = {
    themeValue: themeValue,
    getTheme: () => window.theme.themeValue,
    setTheme: val => {
      window.theme.themeValue = val;
    },
  };
})();
