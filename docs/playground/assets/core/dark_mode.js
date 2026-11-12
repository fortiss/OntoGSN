(() => {
  const KEY = "ontogsn.theme";
  const root = document.documentElement;

  function apply(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme === "dark" ? "dark" : "light";

    // Toggle highlight.js CSS themes
    const light = document.getElementById("hl-light");
    const dark  = document.getElementById("hl-dark");
    if (light && dark) {
      light.disabled = (theme === "dark");
      dark.disabled  = (theme !== "dark");
    }
  }

  const stored = localStorage.getItem(KEY);
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const initialTheme = stored || (prefersDark ? "dark" : "light");

  // Apply immediately (may run before <link> exists)
  apply(initialTheme);

  // Apply again once DOM is ready (so <link id="hl-..."> definitely exists)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => apply(initialTheme), { once: true });
  }

  window.OntoTheme = {
    get: () => root.dataset.theme,
    set: (t) => {
      apply(t);
      localStorage.setItem(KEY, t);
      window.dispatchEvent(new CustomEvent("ontogsn:theme", { detail: { theme: t } }));
    },
    toggle: () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      window.OntoTheme.set(next);
      return next;
    }
  };

  // If user didn't explicitly pick a theme, follow OS changes
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener?.("change", (e) => {
    if (localStorage.getItem(KEY)) return;
    apply(e.matches ? "dark" : "light");
  });
})();
