// GUI の多言語対応 (日本語 / 英語)

const I18N = (() => {
  const STORAGE_KEY = "pg3d_skin_importer_lang";

  const dict = {
    ja: {
      "app.title": "PG3D カスタムスキン インポーター",
      "header.language": "言語",
      "header.theme": "テーマ",
      "theme.system": "システム設定",
      "theme.light": "ライト",
      "theme.dark": "ダーク",
      "add.title": "スキンを追加",
      "add.selectImages": "画像を選択",
      "add.importReg": ".reg から読み込む",
      "options.title": "加工オプション",
      "options.useProcessSkin": "スキンの自動加工",
      "options.flipArmTop": "腕の上面をX軸反転",
      "options.eyelineRemove": "レイヤーのアイライン上書きを除去",
      "options.skipAll": "全レイヤー上書きをスキップ",
      "options.skipHead": "頭部レイヤーをスキップ",
      "options.skipBody": "胴体レイヤーをスキップ",
      "options.skipArm": "腕レイヤーをスキップ",
      "options.skipLeg": "脚レイヤーをスキップ",
      "options.textureSideArm": "使用する腕テクスチャ",
      "options.textureSideLeg": "使用する脚テクスチャ",
      "options.armRight": "右腕",
      "options.armLeft": "左腕",
      "options.legRight": "右脚",
      "options.legLeft": "左脚",
      "options.armWidthMode": "腕の幅判定",
      "options.armWidthAuto": "自動判定",
      "options.armWidthForce3px": "3pxとして変換する",
      "options.armWidthForce4px": "4px済みとして扱う(変換しない)",
      "options.applyToAll": "全スキンに現在のオプションを適用",
      "options.disabledHint": "このスキンは元データがないため再加工できません",
      "list.title": "スキン一覧",
      "list.empty": "まだスキンがありません。画像を追加するか .reg を読み込んでください。",
      "list.imported": "読込済み",
      "list.new": "新規",
      "list.moveUp": "上へ移動(Shiftクリックで先頭へ)",
      "list.moveDown": "下へ移動(Shiftクリックで末尾へ)",
      "list.delete": "削除",
      "list.selectAll": "全選択",
      "list.applySelected": "選択に現在のオプションを適用",
      "list.deleteSelected": "選択を削除",
      "list.pinned": "📌 固定中(クリックで解除)",
      "footer.generate": ".reg ファイルを生成",
      "footer.writeNames": "スキン名を書き出す",
      "footer.downloadImages": "画像を一括ダウンロード",
      "msg.emptyListGenerate": "スキンが1つもありません。画像を追加してください。",
      "msg.imagesDownloaded": "{count} 件の画像をZIPでダウンロードしました。",
      "msg.regParseError": ".reg ファイルの解析に失敗しました。",
      "msg.regImported": "{count} 件のスキンを読み込みました。",
      "msg.duplicatesSkipped": "重複する画像 {count} 件をスキップしました。",
      "preview.hint": "ドラッグで回転・ホイールでズーム",
      "preview.empty": "スキン一覧の画像にカーソルを合わせるとここに3Dプレビューが表示されます",
      "preview.title": "3Dプレビュー",
    },
    en: {
      "app.title": "PG3D Custom Skin Importer",
      "header.language": "Language",
      "header.theme": "Theme",
      "theme.system": "System",
      "theme.light": "Light",
      "theme.dark": "Dark",
      "add.title": "Add Skins",
      "add.selectImages": "Select Images",
      "add.importReg": "Import from .reg",
      "options.title": "Processing Options",
      "options.useProcessSkin": "Automatic skin processing",
      "options.flipArmTop": "Flip the top face of the arms on the X-axis",
      "options.eyelineRemove": "Remove dots that overwrite the eyeliner in the layer",
      "options.skipAll": "Skip overwriting all layer textures",
      "options.skipHead": "Skip overwriting the head layer",
      "options.skipBody": "Skip overwriting the body layer",
      "options.skipArm": "Skip overwriting the arm layer",
      "options.skipLeg": "Skip overwriting the leg layer",
      "options.textureSideArm": "Arm texture to use",
      "options.textureSideLeg": "Leg texture to use",
      "options.armRight": "Right arm",
      "options.armLeft": "Left arm",
      "options.legRight": "Right leg",
      "options.legLeft": "Left leg",
      "options.armWidthMode": "Arm width detection",
      "options.armWidthAuto": "Auto-detect",
      "options.armWidthForce3px": "Force convert (treat as 3px)",
      "options.armWidthForce4px": "Already 4px (skip conversion)",
      "options.applyToAll": "Apply current options to all skins",
      "options.disabledHint": "This skin has no source data, so it can't be reprocessed",
      "list.title": "Skin List",
      "list.empty": "No skins yet. Add images or import a .reg file.",
      "list.imported": "Imported",
      "list.new": "New",
      "list.moveUp": "Move up (Shift-click for top)",
      "list.moveDown": "Move down (Shift-click for bottom)",
      "list.delete": "Delete",
      "list.selectAll": "Select all",
      "list.applySelected": "Apply current options to selected",
      "list.deleteSelected": "Delete selected",
      "list.pinned": "📌 Pinned (click to unpin)",
      "footer.generate": "Generate .reg file",
      "footer.writeNames": "Write skin names",
      "footer.downloadImages": "Download all images",
      "msg.emptyListGenerate": "No skins added yet. Please add at least one image.",
      "msg.imagesDownloaded": "Downloaded {count} image(s) as a ZIP.",
      "msg.regParseError": "Failed to parse the .reg file.",
      "msg.regImported": "Imported {count} skin(s).",
      "msg.duplicatesSkipped": "Skipped {count} duplicate image(s).",
      "preview.hint": "Drag to rotate, scroll to zoom",
      "preview.empty": "Hover a skin in the list to preview it here in 3D",
      "preview.title": "3D Preview",
    },
  };

  let currentLang = "ja";

  function detectInitialLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && dict[saved]) return saved;
    } catch (e) {
      // localStorageが使えない環境でも起動は継続する
    }
    // 保存された選択が無い場合はブラウザの言語設定に関わらず英語を既定にする
    return "en";
  }

  function t(key, params) {
    const text = (dict[currentLang] && dict[currentLang][key]) || key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (_, name) =>
      params[name] !== undefined ? params[name] : `{${name}}`
    );
  }

  function applyToDom() {
    document.documentElement.lang = currentLang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
  }

  function setLang(lang) {
    if (!dict[lang]) return;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // 保存できなくても致命的ではない
    }
    applyToDom();
  }

  function getLang() {
    return currentLang;
  }

  function init() {
    currentLang = detectInitialLang();
    applyToDom();
  }

  return { init, t, setLang, getLang };
})();
