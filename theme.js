// ライト/ダーク/システム設定のテーマ切り替え

const Theme = (() => {
  const STORAGE_KEY = "pg3d_skin_importer_theme";
  const VALID = ["system", "light", "dark"];

  let current = "system";

  function detectInitial() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && VALID.includes(saved)) return saved;
    } catch (e) {
      // localStorageが使えない環境でも起動は継続する
    }
    return "system";
  }

  function applyToDom() {
    if (current === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", current);
    }
  }

  function setTheme(theme) {
    if (!VALID.includes(theme)) return;
    current = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // 保存できなくても致命的ではない
    }
    applyToDom();
  }

  function getTheme() {
    return current;
  }

  function init() {
    current = detectInitial();
    applyToDom();
  }

  return { init, setTheme, getTheme };
})();
