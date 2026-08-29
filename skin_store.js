// スキン一覧の状態管理

const SkinStore = (() => {
  let entries = [];
  const listeners = [];

  function notify() {
    for (const fn of listeners) fn(entries);
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  function getEntries() {
    return entries;
  }

  function stripExtension(filename) {
    const idx = filename.lastIndexOf(".");
    return idx > 0 ? filename.slice(0, idx) : filename;
  }

  function getImageBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
    });
  }

  // .regに書き出すsnowflakeIDの割り当て。
  // .regから読み込んだスキンは元のIDをそのまま保持し、新規スキンだけ新しいIDを振る。
  // (再エクスポートのたびにIDが変わると、PG3D側で別スキン扱いになってしまうのを防ぐため)
  const usedSnowflakeIds = new Set();
  let nextSnowflakeCandidate = 9223372036854775807n;

  function allocateSnowflakeId() {
    while (usedSnowflakeIds.has(nextSnowflakeCandidate.toString())) {
      nextSnowflakeCandidate -= 1n;
    }
    const id = nextSnowflakeCandidate.toString();
    usedSnowflakeIds.add(id);
    nextSnowflakeCandidate -= 1n;
    return id;
  }

  // ファイルから新規スキンを追加し、現在のオプションで加工する。
  // 元データ(バイト列=base64)が一覧内の既存スキンと完全一致するものはスキップする。
  async function addFiles(fileList, option) {
    let skipped = 0;
    for (const file of fileList) {
      const sourceBase64 = await getImageBase64(file);
      if (entries.some((e) => e.sourceBase64 === sourceBase64)) {
        skipped += 1;
        continue;
      }
      const processedBase64 = await processSkin(sourceBase64, option);
      entries.push({
        id: crypto.randomUUID(),
        name: stripExtension(file.name),
        sourceBase64,
        processedBase64,
        fromImport: false,
        options: { ...option },
        snowflakeId: allocateSnowflakeId(),
      });
    }
    notify();
    return { skipped };
  }

  // .regから読み込んだskinMap/nameMapを一覧末尾に追加する。
  // インポートした64x32のデータをそのまま「元データ」として扱い、通常の新規スキンと同様に
  // 現在のオプションで加工する(他所で作られたスキンが3px幅のまま等、未修正な場合があるため)。
  // 元データ(インポートした64x32画像)が一覧内の既存スキンと完全一致するものはスキップする。
  async function addFromImport(skinMap, nameMap, option) {
    let count = 0;
    let skipped = 0;
    for (const key of Object.keys(skinMap)) {
      const sourceBase64 = skinMap[key];
      if (entries.some((e) => e.sourceBase64 === sourceBase64)) {
        skipped += 1;
        continue;
      }
      // 万が一、既に一覧にある(未インポートの)新規スキンとIDが衝突していたら、
      // インポート元のIDを優先し、衝突した側に新しいIDを振り直す。
      if (usedSnowflakeIds.has(key)) {
        const conflicting = entries.find(
          (e) => e.snowflakeId === key && !e.fromImport
        );
        if (conflicting) conflicting.snowflakeId = allocateSnowflakeId();
      } else {
        usedSnowflakeIds.add(key);
      }
      const processedBase64 = await processSkin(sourceBase64, option);
      entries.push({
        id: crypto.randomUUID(),
        name: nameMap[key] || `Skin ${key}`,
        sourceBase64,
        processedBase64,
        fromImport: true,
        options: { ...option },
        snowflakeId: key,
      });
      count += 1;
    }
    notify();
    return { count, skipped };
  }

  function removeById(id) {
    entries = entries.filter((e) => e.id !== id);
    notify();
  }

  function removeManyByIds(ids) {
    const idSet = new Set(ids);
    entries = entries.filter((e) => !idSet.has(e.id));
    notify();
  }

  function move(id, delta) {
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return;
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= entries.length) return;
    const [item] = entries.splice(index, 1);
    entries.splice(newIndex, 0, item);
    notify();
  }

  function moveUp(id) {
    move(id, -1);
  }

  function moveDown(id) {
    move(id, 1);
  }

  function moveToTop(id) {
    const index = entries.findIndex((e) => e.id === id);
    if (index <= 0) return;
    const [item] = entries.splice(index, 1);
    entries.unshift(item);
    notify();
  }

  function moveToBottom(id) {
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1 || index === entries.length - 1) return;
    const [item] = entries.splice(index, 1);
    entries.push(item);
    notify();
  }

  function rename(id, name) {
    const entry = entries.find((e) => e.id === id);
    if (entry) entry.name = name;
  }

  // 指定したスキン単体のオプションを差し替える(再加工はしない)
  function updateOptions(id, options) {
    const entry = entries.find((e) => e.id === id);
    if (entry) entry.options = { ...options };
  }

  // 指定したスキン単体を、そのスキン自身のオプションで再加工する
  async function reprocessOne(id) {
    const entry = entries.find((e) => e.id === id);
    if (!entry || !entry.sourceBase64) return;
    entry.processedBase64 = await processSkin(entry.sourceBase64, entry.options);
    notify();
  }

  // 各スキンをそれぞれ自身のオプションで再加工する(元画像を持たないものはスキップ)
  async function reprocessAll() {
    for (const entry of entries) {
      if (!entry.sourceBase64) continue;
      entry.processedBase64 = await processSkin(entry.sourceBase64, entry.options);
    }
    notify();
  }

  // 渡されたオプションを全スキンに一括適用してから再加工する(元画像を持たないものはスキップ)
  async function applyOptionsToAll(options) {
    for (const entry of entries) {
      if (!entry.sourceBase64) continue;
      entry.options = { ...options };
      entry.processedBase64 = await processSkin(entry.sourceBase64, entry.options);
    }
    notify();
  }

  // 渡されたオプションを指定したIDのスキンだけに一括適用してから再加工する
  async function applyOptionsToIds(ids, options) {
    const idSet = new Set(ids);
    for (const entry of entries) {
      if (!idSet.has(entry.id)) continue;
      if (!entry.sourceBase64) continue;
      entry.options = { ...options };
      entry.processedBase64 = await processSkin(entry.sourceBase64, entry.options);
    }
    notify();
  }

  return {
    subscribe,
    getEntries,
    addFiles,
    addFromImport,
    removeById,
    removeManyByIds,
    moveUp,
    moveDown,
    moveToTop,
    moveToBottom,
    rename,
    updateOptions,
    reprocessOne,
    reprocessAll,
    applyOptionsToAll,
    applyOptionsToIds,
  };
})();
