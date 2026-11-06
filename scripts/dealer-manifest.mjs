// Lists the dealer photos in src/assets/dealers so the live tables know which ones exist.
// Accepts one photo per dealer (sofia.jpg, maya.png, ...) and/or one 4-panel group photo
// named team.(jpg|png|webp) with the dealers left to right: Sofia, Maya, Elena, Lina.
import { readdirSync, writeFileSync } from 'node:fs';

const dir = new URL('../src/assets/dealers/', import.meta.url);
const names = ['sofia', 'maya', 'elena', 'lina', 'team'];
const files = readdirSync(dir)
  .filter((f) => /^[a-z]+\.(jpe?g|png|webp)$/i.test(f) && names.includes(f.split('.')[0].toLowerCase()))
  .sort();
writeFileSync(new URL('dealers.json', dir), JSON.stringify(files) + '\n');
console.log('dealer photos:', files.length ? files.join(', ') : 'none (illustrated dealers)');
