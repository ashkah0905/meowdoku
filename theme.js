"use strict";

(() => {
  const key = "meowdoku-theme-v1";
  const choices = ["system", "light", "dark"];
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = "system";
  try {
    const saved = localStorage.getItem(key);
    if (choices.includes(saved)) preference = saved;
  } catch {
    // Keep the theme usable when storage is unavailable.
  }
  function apply() {
    document.documentElement.dataset.theme = preference === "system"
      ? (media.matches ? "dark" : "light") : preference;
  }
  apply();
  media.addEventListener("change", apply);
  document.addEventListener("DOMContentLoaded", () => {
    const select = document.querySelector("#themeSelect");
    const warning = document.querySelector("#themeWarning");
    select.value = preference;
    select.addEventListener("change", () => {
      if (!choices.includes(select.value)) return;
      preference = select.value;
      apply();
      try {
        localStorage.setItem(key, preference);
        warning.hidden = true;
      } catch {
        warning.hidden = false;
      }
    });
  });
})();
