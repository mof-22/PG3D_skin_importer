// スキンをいい感じにするライブラリ的な

// 矩形領域をスナップショットする。
// src/dst が重なる転送(3px->4px拡張や自己反転)でも書き込み前の値を読めるようにするため、
// canvas全体のgetImageDataではなく、必要な矩形だけを毎回小さくコピーする。
function snapshotRect(data, width, x, y, w, h) {
  const snap = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const srcStart = ((y + row) * width + x) * 4;
    snap.set(data.subarray(srcStart, srcStart + w * 4), row * w * 4);
  }
  return snap;
}

// 透明度が255のドットのみを転送する
function pasteOpaquePixels(data, width, srcX, srcY, dstX, dstY, w, h) {
  const snap = snapshotRect(data, width, srcX, srcY, w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      if (snap[si + 3] === 255) {
        const di = ((dstY + y) * width + (dstX + x)) * 4;
        data[di] = snap[si]; // R
        data[di + 1] = snap[si + 1]; // G
        data[di + 2] = snap[si + 2]; // B
        data[di + 3] = 255; // A
      }
    }
  }
}

// ドット転送、x回転版
// UV反転してんのまじで許さない
function pasteOpaquePixelsFlipX(data, width, srcX, srcY, dstX, dstY, w, h) {
  const snap = snapshotRect(data, width, srcX, srcY, w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      if (snap[si + 3] === 255) {
        const di = ((dstY + y) * width + (dstX + (w - 1 - x))) * 4;
        data[di] = snap[si];
        data[di + 1] = snap[si + 1];
        data[di + 2] = snap[si + 2];
        data[di + 3] = 255;
      }
    }
  }
}

// ドットのAを0に、つまりドットを削除する
function clearPixel(data, width, x, y) {
  data[(y * width + x) * 4 + 3] = 0; // A = 0
}

// 矩形領域を透明にする(差し替え前の残留ピクセルを消すため)
function clearRect(data, width, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      data[(y * width + x) * 4 + 3] = 0;
    }
  }
}

// 指定した原点にあるリムブロック(腕/脚)の正面が既に4px幅かどうかを判定する。
// 標準UVでは奥行きは4px固定で、正面の幅だけが3px/4pxで変わる。
// 原点+14の列はw=4のときだけ塗られる列なので、ここの不透明度で判定できる。
// 作者タグ等の小さな書き込みが1点だけこの列に乗っていても誤判定しないよう、
// 側面帯の全12行を見て大部分が不透明かどうかで判定する(1点だけの判定だと巻き込まれやすい)。
function isLimbSlotAlready4px(data, width, originX, originY) {
  const x = originX + 14;
  const sideH = 12;
  let opaqueCount = 0;
  for (let i = 0; i < sideH; i++) {
    const y = originY + 4 + i;
    if (data[(y * width + x) * 4 + 3] >= 128) opaqueCount++;
  }
  return opaqueCount / sideH >= 0.8;
}

// 腕/脚のようなボックス状UVブロック(right/front/left/back/top/bottom)を、
// 左右反転しつつ別の位置へコピーする。
// ブロック全体をまとめて1回反転すると、top/bottom行のtop面とbottom面の並びが
// 入れ替わってしまったり、right/left/front/backの並びが単純な鏡像にならないため、
// 面ごとに「同じ位置のまま内部だけ反転(top/bottom/front/back)」
// 「right面とleft面を入れ替えつつ反転」を個別に行う。
function pasteMirroredLimbBlock(data, width, srcX, srcY, dstX, dstY, faceW, depth, sideH) {
  // top, bottom: 位置はそのまま、内部だけ反転
  pasteOpaquePixelsFlipX(data, width, srcX + depth, srcY, dstX + depth, dstY, faceW, depth);
  pasteOpaquePixelsFlipX(
    data, width, srcX + depth + faceW, srcY, dstX + depth + faceW, dstY, faceW, depth
  );
  // right面とleft面は入れ替えつつ反転
  pasteOpaquePixelsFlipX(
    data, width, srcX + depth + faceW, srcY + depth, dstX, dstY + depth, depth, sideH
  );
  pasteOpaquePixelsFlipX(
    data, width, srcX, srcY + depth, dstX + depth + faceW, dstY + depth, depth, sideH
  );
  // front, back: 位置はそのまま、内部だけ反転
  pasteOpaquePixelsFlipX(data, width, srcX + depth, srcY + depth, dstX + depth, dstY + depth, faceW, sideH);
  pasteOpaquePixelsFlipX(
    data,
    width,
    srcX + depth + faceW + depth,
    srcY + depth,
    dstX + depth + faceW + depth,
    dstY + depth,
    faceW,
    sideH
  );
}

// 実際の画像処理群 ////
// アイラインに被るレイヤー側のドット削除
function clearEyelineLayer(data, width, option) {
  // アイラインが上書きされるとあんまり良い見た目にならないので
  // アイラインがある一部のレイヤー側ドットを削除
  // TODO: 消し方を複数パターン用意したい。向いている/向いていないスキンがあるだろうし。
  clearPixel(data, width, 40, 13);
  clearPixel(data, width, 41, 12);
  clearPixel(data, width, 46, 12);
  clearPixel(data, width, 47, 13);
}
// レイヤー上書き
function layerOverlay(data, width, option) {
  if (!option.skipSeccondLayerOverLayHead) {
    // 頭
    pasteOpaquePixels(data, width, 32, 0, 0, 0, 32, 16);
  }
  if (!option.skipSeccondLayerOverLayBody) {
    // 胴体
    pasteOpaquePixels(data, width, 16, 32, 16, 16, 24, 16);
  }

  if (!option.skipSeccondLayerOverLayArm) {
    if (option.textureSideArm == "right") {
      // 右腕
      pasteOpaquePixels(data, width, 40, 32, 40, 16, 14, 16);
    } else {
      // 左腕(48,48起点)の袖を反転して右腕スロットへ合成。
      // 左袖も3px/4pxどちらの幅もありえるので、コピー前に実際の幅を判定する。
      const faceW = isLimbSlotAlready4px(data, width, 48, 48) ? 4 : 3;
      pasteMirroredLimbBlock(data, width, 48, 48, 40, 16, faceW, 4, 12);
    }
  }
  if (!option.skipSeccondLayerOverLayLeg) {
    if (option.textureSideLeg == "right") {
      // 右足
      pasteOpaquePixels(data, width, 0, 32, 0, 16, 16, 16);
    } else {
      // 左足(0,48起点)のオーバーレイを反転して右足スロットへ合成
      const faceW = isLimbSlotAlready4px(data, width, 0, 48) ? 4 : 3;
      pasteMirroredLimbBlock(data, width, 0, 48, 0, 16, faceW, 4, 12);
    }
  }
}
// 使用する腕テクスチャの選択に応じて、選ばれた側の生データを右腕スロット(40,16)へ差し替える。
// 左腕(32,48起点)と右腕は鏡像の関係にあるため、左腕を使う場合は反転コピーする。
function selectArmSource(data, width, option) {
  if (option.textureSideArm === "left") {
    // 左腕も3px/4pxどちらの幅もありえるため、正面幅を4px決め打ちにすると
    // 3px幅の左腕データがズレて合成されてしまう。コピー前に実際の幅を判定する。
    const faceW = isLimbSlotAlready4px(data, width, 32, 48) ? 4 : 3;
    clearRect(data, width, 40, 16, 16, 16);
    pasteMirroredLimbBlock(data, width, 32, 48, 40, 16, faceW, 4, 12);
  }
}
// 使用する脚テクスチャの選択に応じて、選ばれた側の生データを右脚スロット(0,16)へ差し替える。
// 左脚(16,48起点)と右脚は鏡像の関係にあるため、左脚を使う場合は反転コピーする。
function selectLegSource(data, width, option) {
  if (option.textureSideLeg === "left") {
    const faceW = isLimbSlotAlready4px(data, width, 16, 48) ? 4 : 3;
    clearRect(data, width, 0, 16, 16, 16);
    pasteMirroredLimbBlock(data, width, 16, 48, 0, 16, faceW, 4, 12);
  }
}
// 腕の正面が既に4px幅かどうかを判定する(右腕スロット(40,16)に対する判定)。
function isArmAlready4px(data, width) {
  return isLimbSlotAlready4px(data, width, 40, 16);
}

// 腕の3px->4px変換を実行すべきかどうかを判定する。
// 自動判定が作者タグ等で誤動作する場合に備え、スキンごとに強制指定できるようにする。
function shouldConvertArmWidth(data, width, option) {
  if (option.armWidthMode === "force3px") return true;
  if (option.armWidthMode === "force4px") return false;
  return !isArmAlready4px(data, width);
}

// 腕の幅を3pxから4pxに変換
function modifyArm3pxTo4px(data, width, option) {
  // frontとback、topとbottomのテクスチャの中央を2pxに増幅する
  // front,back
  pasteOpaquePixels(data, width, 45, 20, 46, 20, 9, 12);
  pasteOpaquePixels(data, width, 53, 20, 54, 20, 6, 16);
  // top,bottom
  pasteOpaquePixels(data, width, 45, 16, 46, 16, 5, 4);
  pasteOpaquePixels(data, width, 49, 16, 50, 16, 2, 4);
}
// 腕のtop面の反転
function flipArmTop(data, width, option) {
  pasteOpaquePixelsFlipX(data, width, 44, 16, 44, 16, 4, 4);
}
///////////////////////////

// バッファの左上 outWidth x outHeight を切り出して新しいImageDataを作る
// (canvasへのdrawImageコピーを介さず、直接ピクセル配列をコピーする)
function trimTopLeft(data, srcWidth, srcHeight, outWidth, outHeight) {
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  const copyWidth = Math.min(outWidth, srcWidth);
  const copyHeight = Math.min(outHeight, srcHeight);

  for (let row = 0; row < copyHeight; row++) {
    const srcStart = row * srcWidth * 4;
    const dstStart = row * outWidth * 4;
    out.set(data.subarray(srcStart, srcStart + copyWidth * 4), dstStart);
  }
  return new ImageData(out, outWidth, outHeight);
}

// メイン処理
function processSkin(base64, option) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = "data:image/png;base64," + base64;

    // 開始
    img.onload = () => {
      const width = img.width;
      const height = img.height;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      // canvasからのピクセル読み出しはここ1回だけ。以降は素のバッファ上で処理する。
      const data = ctx.getImageData(0, 0, width, height).data;

      // そもそも加工が許可されてなきゃ全部無視
      if (option.useProcessSkin) {
        // アイラインに被るレイヤーのドット削除
        if (option.useSeccondLayerEyelineRemove) {
          clearEyelineLayer(data, width, option);
        }

        // 使用する腕・脚テクスチャの選択(左を選んだ場合は反転して右スロットへ差し替え)
        selectArmSource(data, width, option);
        selectLegSource(data, width, option);

        // レイヤー上書き
        if (!option.skipSeccondLayerOverLayAll) {
          layerOverlay(data, width, option);
        }

        // 腕を3pxから4pxに太くする(元から4px幅のスキンでは実行すると肩がはみ出すため、
        // 既定はスキンごとに自動判定。作者タグ等で誤判定される場合は強制指定できる)
        if (shouldConvertArmWidth(data, width, option)) {
          modifyArm3pxTo4px(data, width, option);
        }

        // 腕のtop面反転
        if (option.useFlipArmTop) {
          flipArmTop(data, width, option);
        }
      }

      // 64x32にトリミングして出力canvasへ書き込み。putImageDataもここ1回だけ。
      const outCanvas = document.createElement("canvas");
      outCanvas.width = 64;
      outCanvas.height = 32;
      const outCtx = outCanvas.getContext("2d");
      outCtx.putImageData(trimTopLeft(data, width, height, 64, 32), 0, 0);

      // base64 出力
      const resultBase64 = outCanvas.toDataURL("image/png").split(",")[1];

      resolve(resultBase64);
    };
  });
}
