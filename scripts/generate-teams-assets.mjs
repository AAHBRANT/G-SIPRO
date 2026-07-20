import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const output = path.join(process.cwd(), "appPackage");
await mkdir(output, { recursive: true });

const color = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="#1e3a5f"/><path d="M42 50h108v92H42z" fill="#2563eb" opacity=".3"/><path d="M57 65h78v62H57z" fill="none" stroke="#fff" stroke-width="10" stroke-linejoin="round"/><path d="M78 83H67v26h21V97H77" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M113 82h-16v16h16v15H97" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const outline = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="6" fill="none" stroke="#1e3a5f" stroke-width="2.5"/><path d="M13 11H9v10h7v-5h-4M23 11h-6v5h6v5h-6" fill="none" stroke="#1e3a5f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

await sharp(Buffer.from(color)).png().toFile(path.join(output, "color.png"));
await sharp(Buffer.from(outline)).png().toFile(path.join(output, "outline.png"));
