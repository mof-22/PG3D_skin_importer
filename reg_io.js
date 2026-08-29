// .reg ファイルの読み書き
// スキン本体と名前は同じ構造({snowflakeId: value}のJSONをUTF-8でhex化)で
// 別々のレジストリ値として同じキーの下に保存される。

const RegIO = (() => {
  const REG_KEY_PATH = "HKEY_CURRENT_USER\\Software\\Pixel Gun Team\\Pixel Gun 3D";
  const SKIN_VALUE_NAME = "User Skins_h1196497400";
  const NAME_VALUE_NAME = "User Name Skins_h1318731231";

  // object -> string -> utf-8 -> hex
  function objToHexArray(obj) {
    const encoder = new TextEncoder();
    const json = JSON.stringify(obj);
    const bytes = encoder.encode(json);
    const hex = [];
    for (const b of bytes) {
      hex.push(b.toString(16).padStart(2, "0"));
    }
    // レジストリ用のnull終端
    hex.push("00");
    return hex.join(",");
  }

  // hex(カンマ区切り) -> utf-8 -> string -> object
  function hexArrayToObj(hexArrayText) {
    const bytes = hexArrayText
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h.length > 0)
      .map((h) => parseInt(h, 16));

    // 末尾のnull終端を除去
    while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
      bytes.pop();
    }

    const json = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    return JSON.parse(json);
  }

  // regedit実出力は "\" + 改行で80桁付近で折り返される。手書きの1行形式も両方許容する。
  function extractHexBlock(regText, valueName) {
    const lines = regText.split(/\r\n|\n/);
    const prefix = `"${valueName}"=hex:`;

    let startIndex = -1;
    let hexText = "";
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith(prefix)) {
        startIndex = i;
        hexText = trimmed.slice(prefix.length);
        break;
      }
    }
    if (startIndex === -1) return null;

    let i = startIndex;
    while (hexText.endsWith("\\")) {
      hexText = hexText.slice(0, -1);
      i += 1;
      if (i >= lines.length) break;
      hexText += lines[i].trim();
    }
    return hexText;
  }

  function parseRegFile(regText) {
    const skinHex = extractHexBlock(regText, SKIN_VALUE_NAME);
    if (!skinHex) {
      throw new Error(`"${SKIN_VALUE_NAME}" not found in .reg file`);
    }
    const nameHex = extractHexBlock(regText, NAME_VALUE_NAME);

    const skinMap = hexArrayToObj(skinHex);
    const nameMap = nameHex ? hexArrayToObj(nameHex) : {};
    return { skinMap, nameMap };
  }

  // entries は各要素が snowflakeId を持っている前提(SkinStoreが追加時に割り当て/インポート元のIDを保持する)。
  function buildRegFile(entries, option) {
    const writeNames = !option || option.writeNames !== false;

    const skinMap = {};
    const nameMap = {};

    for (const entry of entries) {
      const id = entry.snowflakeId;
      skinMap[id] = entry.processedBase64;
      // 名前を書き出さない設定でも、値自体は必ず書き出す(空文字で上書きする)。
      // 値ごと省略すると、以前のインポートで残っている古い名前がレジストリ上に残留し、
      // IDが同じ別のスキンに古い名前が使われてしまうため。
      nameMap[id] = writeNames ? entry.name : "";
    }

    const skinHex = objToHexArray(skinMap);
    const nameHex = objToHexArray(nameMap);

    return (
      `Windows Registry Editor Version 5.00\r\n\r\n` +
      `[${REG_KEY_PATH}]\r\n` +
      `"${SKIN_VALUE_NAME}"=hex:${skinHex}\r\n` +
      `"${NAME_VALUE_NAME}"=hex:${nameHex}\r\n`
    );
  }

  function downloadRegFile(regText, filename = "skin.reg") {
    const blob = new Blob([regText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { parseRegFile, buildRegFile, downloadRegFile };
})();
