// Checks that every dealer image in the character registry (src/app/core/dealers.ts) exists.
// A missing image stops the build with a clear message – it is never silently replaced.
import { existsSync, readFileSync } from 'node:fs';

const registry = readFileSync(new URL('../src/app/core/dealers.ts', import.meta.url), 'utf8');
const images = [...registry.matchAll(/image:\s*'([^']+)'/g)].map((m) => m[1]);
const clips = [...registry.matchAll(/'(assets\/dealers\/[^']+\.(?:mp4|webm))'/g)].map((m) => m[1]);
const missing = [...images, ...clips].filter((p) => !existsSync(new URL(`../src/${p}`, import.meta.url)));

if (images.length !== 4 || missing.length) {
  console.error(`Dealer images missing – please add them to src/assets/dealers:\n  ${missing.join('\n  ') || '(registry should list 4 dealers)'}`);
  process.exit(1);
}
console.log(`dealer images ok: ${images.map((p) => p.split('/').pop()).join(', ')}${clips.length ? ` + ${clips.length} clips` : ''}`);
