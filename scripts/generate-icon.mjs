/**
 * Generates LegalBill app icon (1024×1024 PNG) using sharp + SVG,
 * then runs `tauri icon` to produce all required sizes.
 */
import sharp from "sharp";
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../src-tauri/icons/icon.png");

// ── SVG icon design ──────────────────────────────────────────────────────────
// Deep navy background, gold balance scales, clean legal aesthetic
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e3a5f"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5d485"/>
      <stop offset="100%" stop-color="#c9972a"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background with rounded corners -->
  <rect width="1024" height="1024" rx="230" ry="230" fill="url(#bg)"/>

  <!-- Subtle inner glow ring -->
  <rect width="1024" height="1024" rx="230" ry="230"
    fill="none" stroke="#2a4a7f" stroke-width="3"/>

  <!-- ── Balance Scales ── -->

  <!-- Central pillar -->
  <rect x="500" y="310" width="24" height="380" rx="12" fill="url(#gold)"/>

  <!-- Top crossbar -->
  <rect x="290" y="310" width="444" height="24" rx="12" fill="url(#gold)"/>

  <!-- Top decorative knob -->
  <circle cx="512" cy="295" r="28" fill="url(#gold)"/>
  <circle cx="512" cy="295" r="16" fill="#0f172a"/>
  <circle cx="512" cy="295" r="8" fill="url(#gold)"/>

  <!-- Left arm pivot circle -->
  <circle cx="312" cy="322" r="12" fill="url(#gold)"/>
  <!-- Right arm pivot circle -->
  <circle cx="712" cy="322" r="12" fill="url(#gold)"/>

  <!-- Left chain -->
  <line x1="312" y1="334" x2="305" y2="490" stroke="url(#gold)" stroke-width="6" stroke-linecap="round"/>
  <!-- Right chain -->
  <line x1="712" y1="334" x2="719" y2="490" stroke="url(#gold)" stroke-width="6" stroke-linecap="round"/>

  <!-- Left pan -->
  <path d="M220,490 Q305,530 390,490" stroke="url(#gold)" stroke-width="10"
    fill="none" stroke-linecap="round"/>
  <line x1="220" y1="490" x2="390" y2="490" stroke="url(#gold)" stroke-width="5" opacity="0.3"/>

  <!-- Right pan -->
  <path d="M634,490 Q719,530 804,490" stroke="url(#gold)" stroke-width="10"
    fill="none" stroke-linecap="round"/>
  <line x1="634" y1="490" x2="804" y2="490" stroke="url(#gold)" stroke-width="5" opacity="0.3"/>

  <!-- Base of pillar -->
  <rect x="410" y="678" width="204" height="24" rx="12" fill="url(#gold)"/>
  <rect x="370" y="700" width="284" height="18" rx="9" fill="url(#gold)" opacity="0.7"/>

  <!-- ── "LB" monogram subtle watermark at bottom ── -->
  <text x="512" y="800" font-family="Georgia, serif" font-size="72" font-weight="bold"
    fill="#f5d485" fill-opacity="0.18" text-anchor="middle" letter-spacing="8">
    LEGALBILL
  </text>
</svg>`;

// Write SVG to buffer and convert to 1024×1024 PNG
const svgBuf = Buffer.from(svg);
await sharp(svgBuf)
  .resize(1024, 1024)
  .png()
  .toFile(OUT);

console.log("✅  icon.png written to", OUT);

// Run tauri icon to generate all required sizes
console.log("⏳  Running `tauri icon` to generate all sizes…");
execSync(`npx tauri icon "${OUT}"`, {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
});

console.log("✅  All icon sizes generated.");
