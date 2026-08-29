// スキン画像をまとめてダウンロードするための最小限のZIPライター。
// PNG自体が既に圧縮済みのため、圧縮方式は無圧縮(STORE)のみをサポートする。

const ZipWriter = (() => {
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // ZIPのDOS日時形式(西暦2980年問題ならぬ2107年問題があるが、この用途では無関係)
  function dosDateTime(date) {
    const time =
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((date.getSeconds() >> 1) & 0x1f);
    const dosDate =
      (((date.getFullYear() - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0xf) << 5) |
      (date.getDate() & 0x1f);
    return { time, dosDate };
  }

  function writeUint16(arr, offset, value) {
    arr[offset] = value & 0xff;
    arr[offset + 1] = (value >>> 8) & 0xff;
  }
  function writeUint32(arr, offset, value) {
    arr[offset] = value & 0xff;
    arr[offset + 1] = (value >>> 8) & 0xff;
    arr[offset + 2] = (value >>> 16) & 0xff;
    arr[offset + 3] = (value >>> 24) & 0xff;
  }

  // entries: [{ name: string, data: Uint8Array }] -> ZIP形式のBlob
  function build(entries) {
    const encoder = new TextEncoder();
    const { time, dosDate } = dosDateTime(new Date());
    const parts = [];
    const centralParts = [];
    let offset = 0;
    let centralDirSize = 0;

    for (const entry of entries) {
      const nameBytes = encoder.encode(entry.name);
      const data = entry.data;
      const crc = crc32(data);

      const localHeader = new Uint8Array(30);
      writeUint32(localHeader, 0, 0x04034b50);
      writeUint16(localHeader, 4, 20); // version needed to extract
      writeUint16(localHeader, 6, 0); // flags
      writeUint16(localHeader, 8, 0); // method: store(無圧縮)
      writeUint16(localHeader, 10, time);
      writeUint16(localHeader, 12, dosDate);
      writeUint32(localHeader, 14, crc);
      writeUint32(localHeader, 18, data.length); // compressed size
      writeUint32(localHeader, 22, data.length); // uncompressed size
      writeUint16(localHeader, 26, nameBytes.length);
      writeUint16(localHeader, 28, 0); // extra field length

      parts.push(localHeader, nameBytes, data);

      const centralHeader = new Uint8Array(46);
      writeUint32(centralHeader, 0, 0x02014b50);
      writeUint16(centralHeader, 4, 20); // version made by
      writeUint16(centralHeader, 6, 20); // version needed
      writeUint16(centralHeader, 8, 0); // flags
      writeUint16(centralHeader, 10, 0); // method
      writeUint16(centralHeader, 12, time);
      writeUint16(centralHeader, 14, dosDate);
      writeUint32(centralHeader, 16, crc);
      writeUint32(centralHeader, 20, data.length);
      writeUint32(centralHeader, 24, data.length);
      writeUint16(centralHeader, 28, nameBytes.length);
      writeUint16(centralHeader, 30, 0); // extra field length
      writeUint16(centralHeader, 32, 0); // comment length
      writeUint16(centralHeader, 34, 0); // disk number start
      writeUint16(centralHeader, 36, 0); // internal attrs
      writeUint32(centralHeader, 38, 0); // external attrs
      writeUint32(centralHeader, 42, offset); // ローカルヘッダへのオフセット

      centralParts.push(centralHeader, nameBytes);
      centralDirSize += centralHeader.length + nameBytes.length;
      offset += localHeader.length + nameBytes.length + data.length;
    }

    const centralDirOffset = offset;

    const eocd = new Uint8Array(22);
    writeUint32(eocd, 0, 0x06054b50);
    writeUint16(eocd, 4, 0); // disk number
    writeUint16(eocd, 6, 0); // central dirのあるdisk番号
    writeUint16(eocd, 8, entries.length); // このdiskのエントリ数
    writeUint16(eocd, 10, entries.length); // 総エントリ数
    writeUint32(eocd, 12, centralDirSize);
    writeUint32(eocd, 16, centralDirOffset);
    writeUint16(eocd, 20, 0); // コメント長

    return new Blob([...parts, ...centralParts, eocd], {
      type: "application/zip",
    });
  }

  function downloadZip(entries, filename = "skins.zip") {
    const blob = build(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { build, downloadZip };
})();
