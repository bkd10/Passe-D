import sharp from "sharp";
// Visuels de démonstration : terrains stylisés (pas de vraies photos dans cet environnement).
const scenes = [
  ["#1f6b3a","#2a7d45","#e8ff8a", "goal"],
  ["#123d24","#1a5130","#d7ff3a", "center"],
  ["#2d5a1f","#386b27","#ffffff", "box"],
  ["#0e2a1a","#16402a","#5ce1a6", "corner"],
  ["#3b2a14","#4a361c","#ffb547", "center"],
  ["#14243b","#1b3150","#6fb7ff", "box"],
  ["#3a1420","#4d1b2b","#ff7a59", "goal"],
  ["#241a3b","#2f2350","#b79cff", "corner"],
  ["#1a3a2a","#22503a","#ff4f8b", "center"],
  ["#2a2f1a","#3a4122","#d7ff3a", "box"],
];
for (const [i,[a,b,c,kind]] of scenes.entries()) {
  const W=1800,H=1200; let stripes="";
  for(let x=0;x<W;x+=150) stripes+=`<rect x="${x}" y="0" width="75" height="${H}" fill="${b}"/>`;
  const lines = {
    goal:`<rect x="600" y="-10" width="600" height="300" fill="none" stroke="${c}" stroke-width="10"/><rect x="760" y="-10" width="280" height="120" fill="none" stroke="${c}" stroke-width="10"/><circle cx="900" cy="560" r="34" fill="#fff"/>`,
    center:`<line x1="0" y1="600" x2="${W}" y2="600" stroke="${c}" stroke-width="10"/><circle cx="900" cy="600" r="220" fill="none" stroke="${c}" stroke-width="10"/><circle cx="900" cy="600" r="14" fill="${c}"/>`,
    box:`<rect x="-10" y="250" width="420" height="700" fill="none" stroke="${c}" stroke-width="10"/><rect x="-10" y="430" width="160" height="340" fill="none" stroke="${c}" stroke-width="10"/><path d="M410 470 A220 220 0 0 1 410 730" fill="none" stroke="${c}" stroke-width="10"/>`,
    corner:`<path d="M0 120 A120 120 0 0 0 120 0" fill="none" stroke="${c}" stroke-width="10"/><line x1="0" y1="0" x2="${W}" y2="0" stroke="${c}" stroke-width="20"/><circle cx="1250" cy="760" r="30" fill="#fff"/>`,
  }[kind];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g" cx="0.7" cy="0.3" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient></defs><rect width="${W}" height="${H}" fill="${a}"/>${stripes}${lines}<rect width="${W}" height="${H}" fill="url(#g)"/></svg>`;
  await sharp(Buffer.from(svg)).jpeg({quality:85}).toFile(`/tmp/claude-0/demo/img${i}.jpg`);
}
console.log("ok");
