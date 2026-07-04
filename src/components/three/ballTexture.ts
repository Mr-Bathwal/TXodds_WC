import * as THREE from "three";

/** Draws the classic black-pentagon football pattern onto an equirect canvas. */
export function makeBallTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#f4f6f8");
  base.addColorStop(0.5, "#ffffff");
  base.addColorStop(1, "#e9edf1");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const pentagon = (cx: number, cy: number, r: number, rot = 0) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  ctx.strokeStyle = "rgba(30,38,46,0.18)";
  ctx.lineWidth = 3;
  const hexR = 74;
  for (let row = -1; row < 6; row++) {
    for (let col = -1; col < 9; col++) {
      const cx = col * hexR * 1.78 + (row % 2 ? hexR * 0.89 : 0);
      const cy = row * hexR * 1.54 + 40;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 6;
        const x = cx + hexR * Math.cos(a);
        const y = cy + hexR * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.fillStyle = "#12181f";
  const rows = [
    { y: 90, n: 5, r: 46, phase: 0 },
    { y: 256, n: 5, r: 52, phase: 0.5 },
    { y: 422, n: 5, r: 46, phase: 0 },
  ];
  for (const { y, n, r, phase } of rows) {
    for (let i = 0; i < n; i++) {
      const x = ((i + phase) / n) * w;
      pentagon(x, y, r, i * 0.6);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
