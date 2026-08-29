// スキンをMinecraft classic(64x32)形式の人型モデルに貼り付けて表示する簡易3Dビューア。
// 外部ライブラリは使わず素のWebGLで実装(ビルド不要・file://でも動作させるため)。

const SkinViewer3D = (() => {
  const TEX_W = 64;
  const TEX_H = 32;

  // ---- UVユーティリティ (Minecraft classicの標準ボックスUV展開) ----
  // 加工後テクスチャは頭0,0/胴16,16/腕40,16(4px幅)/脚0,16に正規化済みなので、
  // この標準レイアウトをそのまま前提にできる。
  function rect(u, v, w, h) {
    return { u0: u / TEX_W, v0: v / TEX_H, u1: (u + w) / TEX_W, v1: (v + h) / TEX_H };
  }
  function boxUV(u, v, w, h, d) {
    return {
      top: rect(u + d, v, w, d),
      bottom: rect(u + d + w, v, w, d),
      right: rect(u, v + d, d, h),
      front: rect(u + d, v + d, w, h),
      left: rect(u + d + w, v + d, d, h),
      back: rect(u + d + w + d, v + d, w, h),
    };
  }
  function flipU(r) {
    return { u0: r.u1, v0: r.v0, u1: r.u0, v1: r.v1 };
  }
  // classic形式は腕/脚とも片側分のテクスチャしか持たないため、
  // 逆側はUVを左右反転して使い回す(ゲーム内の挙動と同じ)。
  function mirrorFaces(faces) {
    return {
      top: flipU(faces.top),
      bottom: flipU(faces.bottom),
      right: flipU(faces.left),
      left: flipU(faces.right),
      front: flipU(faces.front),
      back: flipU(faces.back),
    };
  }

  // ---- ジオメトリ構築 ----
  const SHADE = { top: 1.0, bottom: 0.5, front: 0.85, back: 0.6, left: 0.7, right: 0.7 };

  function addBox(geo, x0, y0, z0, x1, y1, z1, faces) {
    function quad(p0, p1, p2, p3, r, shade) {
      const base = geo.positions.length / 3;
      geo.positions.push(...p0, ...p1, ...p2, ...p3);
      geo.uvs.push(r.u0, r.v1, r.u1, r.v1, r.u1, r.v0, r.u0, r.v0);
      geo.shades.push(shade, shade, shade, shade);
      geo.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], faces.top, SHADE.top);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], faces.bottom, SHADE.bottom);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], faces.front, SHADE.front);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], faces.back, SHADE.back);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], faces.right, SHADE.right);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], faces.left, SHADE.left);
  }

  function buildHumanoidGeometry() {
    const geo = { positions: [], uvs: [], shades: [], indices: [] };

    const head = boxUV(0, 0, 8, 8, 8);
    const body = boxUV(16, 16, 8, 12, 4);
    const rightArm = boxUV(40, 16, 4, 12, 4);
    const rightLeg = boxUV(0, 16, 4, 12, 4);
    const leftArm = mirrorFaces(rightArm);
    const leftLeg = mirrorFaces(rightLeg);

    // ゲーム側は腕のtop面だけ描画時に反転して表示する既知の挙動がある。
    // 書き出すテクスチャ自体はそのままにしつつ(実機で正しいことを確認済み)、
    // プレビューだけ実際の見た目に合わせて両腕のtop面に追加でU反転をかける。
    rightArm.top = flipU(rightArm.top);
    leftArm.top = flipU(leftArm.top);

    // 単位はスキンのpx相当。原点(0,0,0)は足元中央。
    addBox(geo, -4, 24, -4, 4, 32, 4, head);
    addBox(geo, -4, 12, -2, 4, 24, 2, body);
    addBox(geo, -8, 12, -2, -4, 24, 2, rightArm);
    addBox(geo, 4, 12, -2, 8, 24, 2, leftArm);
    addBox(geo, -4, 0, -2, 0, 12, 2, rightLeg);
    addBox(geo, 0, 0, -2, 4, 12, 2, leftLeg);

    return geo;
  }

  // ---- 4x4行列(列優先) ----
  function multiply(a, b) {
    const out = new Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
        out[col * 4 + row] = sum;
      }
    }
    return out;
  }
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ];
  }
  function translate(x, y, z) {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  }
  // 胴体中心(body: y 12-24 の中央)を回転の中心にする
  const PIVOT_Y = 18;
  function rotateX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  }
  function rotateY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  }

  // ---- シェーダ ----
  const VERTEX_SRC = `
    attribute vec3 aPosition;
    attribute vec2 aUV;
    attribute float aShade;
    uniform mat4 uMVP;
    varying vec2 vUV;
    varying float vShade;
    void main() {
      vUV = aUV;
      vShade = aShade;
      gl_Position = uMVP * vec4(aPosition, 1.0);
    }
  `;
  const FRAGMENT_SRC = `
    precision mediump float;
    varying vec2 vUV;
    varying float vShade;
    uniform sampler2D uSampler;
    void main() {
      // ゲーム内では透明ドットは黒として描画されるため、破棄せず黒へフォールバックさせる
      vec4 color = texture2D(uSampler, vUV);
      vec3 finalColor = mix(vec3(0.0), color.rgb * vShade, color.a);
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  function compileShader(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("shader compile error: " + log);
    }
    return shader;
  }

  function createProgram(gl) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("program link error: " + gl.getProgramInfoLog(program));
    }
    return program;
  }

  function create(canvas) {
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) throw new Error("WebGL is not supported in this browser");

    const program = createProgram(gl);
    const aPosition = gl.getAttribLocation(program, "aPosition");
    const aUV = gl.getAttribLocation(program, "aUV");
    const aShade = gl.getAttribLocation(program, "aShade");
    const uMVP = gl.getUniformLocation(program, "uMVP");
    const uSampler = gl.getUniformLocation(program, "uSampler");

    const geo = buildHumanoidGeometry();
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.positions), gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.uvs), gl.STATIC_DRAW);

    const shadeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.shades), gl.STATIC_DRAW);

    const idxBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.indices), gl.STATIC_DRAW);
    const indexCount = geo.indices.length;

    let texture = null;
    let yaw = 0.5;
    let pitch = -0.15;
    let distance = 58;
    let rafId = null;
    let clearColor = [0.93, 0.94, 0.96];

    function setClearColor(r, g, b) {
      clearColor = [r, g, b];
    }

    // canvasに適用されているCSSの--surface変数(カード背景色)を読み取り、
    // ダーク/ライトどちらのテーマでも周囲のパネルと馴染む背景色にする
    function refreshBackgroundFromCss() {
      const hex = getComputedStyle(canvas).getPropertyValue("--surface").trim();
      const match = /^#([0-9a-f]{6})$/i.exec(hex);
      if (!match) return;
      const n = parseInt(match[1], 16);
      setClearColor(
        ((n >> 16) & 0xff) / 255,
        ((n >> 8) & 0xff) / 255,
        (n & 0xff) / 255
      );
    }

    function setTexture(base64) {
      const img = new Image();
      img.onload = () => {
        if (!texture) texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // v=0を画像の上端に合わせるため、Y反転はしない(反転させるとテクスチャの上下が逆になる)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      };
      img.src = "data:image/png;base64," + base64;
    }

    function resizeIfNeeded() {
      const displayWidth = canvas.clientWidth || canvas.width;
      const displayHeight = canvas.clientHeight || canvas.height;
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }
    }

    function render() {
      resizeIfNeeded();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      if (texture) {
        gl.useProgram(program);

        const aspect = canvas.width / Math.max(1, canvas.height);
        const proj = perspective(Math.PI / 5, aspect, 0.1, 1000);
        const view = translate(0, -16, -distance);
        // 胴体中心を原点に戻してから回転し、元の位置に戻す(足元ではなく胴体中心を軸にするため)
        const model = multiply(
          translate(0, PIVOT_Y, 0),
          multiply(rotateY(yaw), multiply(rotateX(pitch), translate(0, -PIVOT_Y, 0)))
        );
        const mvp = multiply(multiply(proj, view), model);
        gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(uSampler, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aUV);

        gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuffer);
        gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aShade);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
      }

      rafId = requestAnimationFrame(render);
    }

    // ---- マウス/タッチでの回転・ホイールでのズーム ----
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function onPointerDown(e) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw += dx * 0.01;
      pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.01));
    }
    function onPointerUp() {
      dragging = false;
    }
    function onWheel(e) {
      e.preventDefault();
      distance = Math.max(24, Math.min(120, distance + e.deltaY * 0.05));
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    function pause() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
    function resume() {
      if (!rafId) render();
    }
    function dispose() {
      pause();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    }

    refreshBackgroundFromCss();
    resume();
    return {
      setTexture,
      pause,
      resume,
      dispose,
      setClearColor,
      refreshBackgroundFromCss,
    };
  }

  return { create };
})();
