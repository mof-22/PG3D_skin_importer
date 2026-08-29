// 画面の描画とイベント配線

const UI = (() => {
  const OPTION_CHECKBOX_IDS = {
    useProcessSkin: "use_process_skin",
    useFlipArmTop: "use_flip_arm_top",
    useSeccondLayerEyelineRemove: "use_seccond_layer_eyeline_remove",
    skipSeccondLayerOverLayAll: "skip_seccond_layer_ovarlay_all",
    skipSeccondLayerOverLayHead: "skip_seccond_layer_ovarlay_head",
    skipSeccondLayerOverLayBody: "skip_seccond_layer_ovarlay_body",
    skipSeccondLayerOverLayArm: "skip_seccond_layer_ovarlay_arm",
    skipSeccondLayerOverLayLeg: "skip_seccond_layer_ovarlay_leg",
  };
  const OPTION_SELECT_IDS = {
    textureSideArm: "texture_side_arm",
    textureSideLeg: "texture_side_leg",
    armWidthMode: "arm_width_mode",
  };

  function getOptions() {
    const options = {};
    for (const key in OPTION_CHECKBOX_IDS) {
      options[key] = document.getElementById(OPTION_CHECKBOX_IDS[key]).checked;
    }
    for (const key in OPTION_SELECT_IDS) {
      options[key] = document.getElementById(OPTION_SELECT_IDS[key]).value;
    }
    return options;
  }

  // 指定したオプションの内容をオプションパネルのDOMへ反映する(スキン選択切替時に使う)
  function setOptionsToDom(options) {
    for (const key in OPTION_CHECKBOX_IDS) {
      document.getElementById(OPTION_CHECKBOX_IDS[key]).checked = !!options[key];
    }
    for (const key in OPTION_SELECT_IDS) {
      document.getElementById(OPTION_SELECT_IDS[key]).value = options[key];
    }
  }

  // 元データを持たないスキンを選択中は、再加工しようがないのでパネルを無効化する
  function setOptionsPanelEnabled(enabled) {
    document
      .querySelectorAll("#panel-options input, #panel-options select")
      .forEach((el) => {
        el.disabled = !enabled;
      });
    document
      .getElementById("options_disabled_hint")
      .classList.toggle("hidden", enabled);
  }

  // 一覧の複数選択(一括削除・一括オプション適用用)
  const selectedIds = new Set();

  function updateBulkDeleteUI(entries) {
    const total = entries.length;
    const selectedCount = Array.from(selectedIds).filter((id) =>
      entries.some((e) => e.id === id)
    ).length;

    const deleteBtn = document.getElementById("btn_delete_selected");
    deleteBtn.disabled = selectedCount === 0;
    deleteBtn.textContent =
      selectedCount > 0
        ? `${I18N.t("list.deleteSelected")} (${selectedCount})`
        : I18N.t("list.deleteSelected");

    const applyBtn = document.getElementById("btn_apply_selected");
    applyBtn.disabled = selectedCount === 0;
    applyBtn.textContent =
      selectedCount > 0
        ? `${I18N.t("list.applySelected")} (${selectedCount})`
        : I18N.t("list.applySelected");

    const selectAll = document.getElementById("select_all_checkbox");
    selectAll.checked = total > 0 && selectedCount === total;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < total;
  }

  function renderList(entries) {
    const listEl = document.getElementById("skin_list");
    const emptyEl = document.getElementById("list_empty");
    const countEl = document.getElementById("list_count");

    // 一覧から消えたIDは選択状態からも取り除く
    const currentIds = new Set(entries.map((e) => e.id));
    for (const id of Array.from(selectedIds)) {
      if (!currentIds.has(id)) selectedIds.delete(id);
    }
    // 固定表示していたスキンが消えていたら固定を解除する
    if (pinnedId && !currentIds.has(pinnedId)) {
      pinnedId = null;
    }

    countEl.textContent = String(entries.length);
    emptyEl.classList.toggle("hidden", entries.length > 0);
    listEl.innerHTML = "";

    entries.forEach((entry, index) => {
      const li = document.createElement("li");
      li.className = "skin-row";
      if (entry.id === pinnedId) li.classList.add("skin-row--pinned");
      li.dataset.id = entry.id;

      // 固定中でなければ、行のどこにカーソルを合わせてもプレビューを更新する
      li.addEventListener("mouseenter", () => {
        if (!pinnedId) showPreview(entry);
      });
      // 行をクリックするとそのスキンにプレビューを固定/解除する。
      // ただし名前欄やボタン、チェックボックス(を包むlabel含む)へのクリックは通常の操作として扱う。
      li.addEventListener("click", (e) => {
        if (e.target.closest("input, button, label")) return;
        pinnedId = pinnedId === entry.id ? null : entry.id;
        showPreview(entry);
        renderList(SkinStore.getEntries());
      });

      // チェックボックス自体は小さいので、周囲にパディングを付けたlabelで包んで当たり判定を広げる
      // (負のmarginで見た目のレイアウトは変えず、クリック領域だけ拡張する)
      const selectWrap = document.createElement("label");
      selectWrap.className = "skin-select-wrap";
      const selectCheckbox = document.createElement("input");
      selectCheckbox.type = "checkbox";
      selectCheckbox.className = "skin-select";
      selectCheckbox.checked = selectedIds.has(entry.id);
      selectCheckbox.addEventListener("change", () => {
        if (selectCheckbox.checked) selectedIds.add(entry.id);
        else selectedIds.delete(entry.id);
        updateBulkDeleteUI(SkinStore.getEntries());
      });
      selectWrap.appendChild(selectCheckbox);

      const thumb = document.createElement("img");
      thumb.className = "skin-thumb";
      thumb.src = "data:image/png;base64," + entry.processedBase64;
      thumb.alt = entry.name;

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "skin-name";
      nameInput.value = entry.name;
      nameInput.addEventListener("change", () => {
        SkinStore.rename(entry.id, nameInput.value);
      });

      const badge = document.createElement("span");
      badge.className = "skin-badge";
      if (entry.fromImport) badge.classList.add("skin-badge--imported");
      badge.textContent = entry.fromImport
        ? I18N.t("list.imported")
        : I18N.t("list.new");

      const actions = document.createElement("div");
      actions.className = "skin-actions";

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "btn-icon";
      upBtn.textContent = "↑";
      upBtn.title = I18N.t("list.moveUp");
      upBtn.disabled = index === 0;
      upBtn.addEventListener("click", (e) => {
        if (e.shiftKey) SkinStore.moveToTop(entry.id);
        else SkinStore.moveUp(entry.id);
      });

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "btn-icon";
      downBtn.textContent = "↓";
      downBtn.title = I18N.t("list.moveDown");
      downBtn.disabled = index === entries.length - 1;
      downBtn.addEventListener("click", (e) => {
        if (e.shiftKey) SkinStore.moveToBottom(entry.id);
        else SkinStore.moveDown(entry.id);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-icon btn-icon--danger";
      delBtn.textContent = "×";
      delBtn.title = I18N.t("list.delete");
      delBtn.addEventListener("click", () => SkinStore.removeById(entry.id));

      actions.append(upBtn, downBtn, delBtn);
      li.append(selectWrap, thumb, nameInput, badge, actions);
      listEl.appendChild(li);
    });

    updateBulkDeleteUI(entries);

    // カーソルが乗っていたスキンが消えていたら、先頭のスキンを既定表示にする
    if (!entries.some((e) => e.id === currentPreviewId)) {
      if (entries.length > 0) {
        showPreview(entries[0]);
      } else {
        showEmptyPreview();
      }
    }
  }

  let viewer3d = null;
  let currentPreviewId = null;
  // クリックで固定したスキンのID。設定されている間はホバー/スクロール追従でプレビューが変わらない。
  let pinnedId = null;
  function getViewer3d() {
    if (!viewer3d) {
      viewer3d = SkinViewer3D.create(document.getElementById("preview_canvas"));
    }
    return viewer3d;
  }

  function showPreview(entry) {
    currentPreviewId = entry.id;
    document.getElementById("preview_name").textContent = entry.name;
    document.getElementById("preview_empty").classList.add("hidden");
    document
      .getElementById("preview_pin_hint")
      .classList.toggle("hidden", pinnedId !== entry.id);
    getViewer3d().setTexture(entry.processedBase64);
    setOptionsToDom(entry.options || getOptions());
    setOptionsPanelEnabled(!!entry.sourceBase64);
  }

  function showEmptyPreview() {
    currentPreviewId = null;
    pinnedId = null;
    document.getElementById("preview_name").textContent = "";
    document.getElementById("preview_empty").classList.remove("hidden");
    document.getElementById("preview_pin_hint").classList.add("hidden");
    setOptionsPanelEnabled(true);
  }

  // オプション変更時、現在選択中のスキン1枚だけをそのオプションで再加工する
  // (一覧・3Dプレビュー双方に反映する。他のスキンには影響しない)
  async function applyOptionsToCurrentSkin() {
    if (!currentPreviewId) return;
    const entry = SkinStore.getEntries().find((e) => e.id === currentPreviewId);
    if (!entry || !entry.sourceBase64) return;
    SkinStore.updateOptions(currentPreviewId, getOptions());
    await SkinStore.reprocessOne(currentPreviewId);
    const updated = SkinStore.getEntries().find((e) => e.id === currentPreviewId);
    if (updated) showPreview(updated);
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // ファイル名として使えない文字を置き換え、重複があれば連番を付ける
  function toUniqueFilename(name, used) {
    const base = (name || "skin").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "skin";
    let filename = base + ".png";
    let n = 2;
    while (used.has(filename)) {
      filename = `${base} (${n}).png`;
      n++;
    }
    used.add(filename);
    return filename;
  }

  let toastTimer = null;
  function showMessage(text) {
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add("toast--visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("toast--visible"), 3000);
  }

  // 一覧をマウスホイールでスクロールした場合、カーソル自体は動いていないので
  // mouseenterが発火せずプレビューが更新されない。カーソル直下の行を都度調べて追従させる。
  let lastMouseX = 0;
  let lastMouseY = 0;

  function initScrollFollow() {
    document.addEventListener("mousemove", (e) => {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    });
    document.getElementById("skin_list").addEventListener("scroll", () => {
      if (pinnedId) return;
      const el = document.elementFromPoint(lastMouseX, lastMouseY);
      const row = el && el.closest(".skin-row");
      if (!row) return;
      const entry = SkinStore.getEntries().find((e) => e.id === row.dataset.id);
      if (entry && entry.id !== currentPreviewId) showPreview(entry);
    });
  }

  function init() {
    I18N.init();
    document.getElementById("lang_select").value = I18N.getLang();

    Theme.init();
    document.getElementById("theme_select").value = Theme.getTheme();

    getViewer3d();
    showEmptyPreview();
    SkinStore.subscribe(renderList);
    renderList(SkinStore.getEntries());
    initScrollFollow();

    document.getElementById("preview_pin_hint").addEventListener("click", () => {
      pinnedId = null;
      const entries = SkinStore.getEntries();
      const entry = entries.find((e) => e.id === currentPreviewId);
      if (entry) showPreview(entry);
      renderList(entries);
    });

    document.getElementById("lang_select").addEventListener("change", (e) => {
      I18N.setLang(e.target.value);
      renderList(SkinStore.getEntries());
    });

    document.getElementById("theme_select").addEventListener("change", (e) => {
      Theme.setTheme(e.target.value);
      getViewer3d().refreshBackgroundFromCss();
    });

    // 「システム設定」時、OS側のライト/ダーク切替にも3Dプレビューの背景を追従させる
    if (window.matchMedia) {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
          if (Theme.getTheme() === "system") {
            getViewer3d().refreshBackgroundFromCss();
          }
        });
    }

    document
      .getElementById("imgInput")
      .addEventListener("change", async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const { skipped } = await SkinStore.addFiles(files, getOptions());
        if (skipped > 0) {
          showMessage(I18N.t("msg.duplicatesSkipped", { count: skipped }));
        }
        e.target.value = "";
      });

    document
      .getElementById("regInput")
      .addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const { skinMap, nameMap } = RegIO.parseRegFile(text);
          const { count, skipped } = await SkinStore.addFromImport(
            skinMap,
            nameMap,
            getOptions()
          );
          showMessage(
            skipped > 0
              ? `${I18N.t("msg.regImported", { count })} ${I18N.t(
                  "msg.duplicatesSkipped",
                  { count: skipped }
                )}`
              : I18N.t("msg.regImported", { count })
          );
        } catch (err) {
          console.error(err);
          showMessage(I18N.t("msg.regParseError"));
        }
        e.target.value = "";
      });

    document
      .getElementById("btn_reprocess")
      .addEventListener("click", async () => {
        await SkinStore.applyOptionsToAll(getOptions());
      });

    document
      .getElementById("panel-options")
      .addEventListener("change", () => {
        applyOptionsToCurrentSkin();
      });

    document
      .getElementById("select_all_checkbox")
      .addEventListener("change", (e) => {
        const entries = SkinStore.getEntries();
        if (e.target.checked) {
          entries.forEach((entry) => selectedIds.add(entry.id));
        } else {
          selectedIds.clear();
        }
        renderList(entries);
      });

    document
      .getElementById("btn_delete_selected")
      .addEventListener("click", () => {
        SkinStore.removeManyByIds(Array.from(selectedIds));
        selectedIds.clear();
      });

    document
      .getElementById("btn_apply_selected")
      .addEventListener("click", async () => {
        await SkinStore.applyOptionsToIds(Array.from(selectedIds), getOptions());
      });

    document.getElementById("btn_generate").addEventListener("click", async () => {
      const entries = SkinStore.getEntries();
      if (entries.length === 0) {
        showMessage(I18N.t("msg.emptyListGenerate"));
        return;
      }
      // プレビューだけ見て満足し、一覧に加工結果を反映し忘れたまま書き出すことがないよう、
      // 生成の直前に各スキン自身のオプションで一覧全体を必ず再加工する
      await SkinStore.reprocessAll();
      const writeNames = document.getElementById("write_skin_names").checked;
      const regText = RegIO.buildRegFile(SkinStore.getEntries(), { writeNames });
      RegIO.downloadRegFile(regText);
    });

    document
      .getElementById("btn_download_images")
      .addEventListener("click", async () => {
        const entries = SkinStore.getEntries();
        if (entries.length === 0) {
          showMessage(I18N.t("msg.emptyListGenerate"));
          return;
        }
        // .regの生成と同様、書き出し前に各スキン自身のオプションで一覧全体を再加工しておく
        await SkinStore.reprocessAll();

        const used = new Set();
        const zipEntries = SkinStore.getEntries().map((entry) => ({
          name: toUniqueFilename(entry.name, used),
          data: base64ToBytes(entry.processedBase64),
        }));
        ZipWriter.downloadZip(zipEntries);
        showMessage(I18N.t("msg.imagesDownloaded", { count: zipEntries.length }));
      });
  }

  return { init };
})();
