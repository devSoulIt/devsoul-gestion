import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const ICONS_DIR = new URL("../public/icons/", import.meta.url);
const APP_DIR = new URL("../app/", import.meta.url);
const LOGO_W = 1878;
const LOGO_H = 2017;
const PATHS =
  '<path d="M0 0H1878L1482 402H941L1482 1008L585 2017H0L895 1008Z"/><path d="M0 707L266 1008L0 1306Z"/>';

function iconSvg({ size, logoRatio, radius = 0, background = null }) {
  const h = size * logoRatio;
  const scale = h / LOGO_H;
  const w = LOGO_W * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  const bg = background ? `<rect width="${size}" height="${size}" rx="${size * radius}" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(5)})" fill="#bdf61d">${PATHS}</g></svg>`;
}

const png = (svg) => sharp(Buffer.from(svg)).png().toBuffer();

const favicon = iconSvg({ size: 512, logoRatio: 0.92 });
await writeFile(new URL("icon.svg", ICONS_DIR), favicon + "\n");

const targets = [
  ["icon-192.png", iconSvg({ size: 192, logoRatio: 0.84 })],
  ["icon-512.png", iconSvg({ size: 512, logoRatio: 0.84 })],
  ["icon-maskable-512.png", iconSvg({ size: 512, logoRatio: 0.56, background: "#000" })],
  ["apple-touch-icon.png", iconSvg({ size: 180, logoRatio: 0.66, background: "#000" })],
];
for (const [name, svg] of targets) await writeFile(new URL(name, ICONS_DIR), await png(svg));

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(
  icoSizes.map((s) => png(iconSvg({ size: s, logoRatio: 0.94 }))),
);
const header = Buffer.alloc(6 + 16 * icoSizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
icoSizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(icoImages[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += icoImages[i].length;
});
await writeFile(new URL("favicon.ico", APP_DIR), Buffer.concat([header, ...icoImages]));

const brand = await readFile(new URL("../public/brand/isotipo.svg", import.meta.url));
await writeFile(
  new URL("../public/brand/isotipo.png", import.meta.url),
  await sharp(brand, { density: 72 }).resize({ height: 1024 }).png().toBuffer(),
);

console.log("Íconos generados");
