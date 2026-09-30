/**
 * Rebuilds the beast list inside docs/art-prompts.html from the game data,
 * so every beast (hand-designed or generated) gets Gemini prompts.
 *
 *   npx tsx tools/build-prompts.ts
 *
 * Beasts that already have art in ART_FILES are marked as done on the page.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { RARITY, RARITY_ORDER, SPECIES } from '../src/data';
import { ART_FILES } from '../src/beasts/art';

const file = new URL('../docs/art-prompts.html', import.meta.url);
let html = readFileSync(file, 'utf8');

const order = (k: string) => RARITY_ORDER.indexOf(SPECIES[k].rarity);
const keys = Object.keys(SPECIES).sort((a, b) => order(b) - order(a) || SPECIES[a].el.localeCompare(SPECIES[b].el) || a.localeCompare(b));
const rows = keys.map(k => {
  const sp = SPECIES[k];
  const look = sp.look ?? `A ${sp.body} beast of the ${sp.el} element.`;
  const [e1, e2] = sp.evoLooks ?? ['Bigger and stronger, with a brighter elemental glow.', 'A grand final form with dramatic elemental effects and gold runes orbiting it.'];
  const done = (ART_FILES[k] ?? []).length === 3;
  return ` [${JSON.stringify(k)},${JSON.stringify(sp.el)},${JSON.stringify(sp.rarity)},${JSON.stringify(sp.forms)},\n  ${JSON.stringify(look)},\n  ${JSON.stringify(e1)},\n  ${JSON.stringify(e2)},${done}],`;
});

const start = html.indexOf('const BEASTS=[');
const end = html.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('Could not find the BEASTS list in docs/art-prompts.html');
html = html.slice(0, start) + 'const BEASTS=[\n' + rows.join('\n') + html.slice(end);

html = html.replace(/const RAR=\{[^}]*\};/, 'const RAR=' + JSON.stringify(Object.fromEntries(RARITY_ORDER.map(r => [r, RARITY[r].color]))) + ';');
html = html.replace(/covering all \d+ beasts/, `covering all ${keys.length} beasts`);
html = html.replace(/so all \d+ beasts come out/, `so all ${keys.length} beasts come out`);
html = html.replace(/>All \d+<\/button>/, `>All ${keys.length}</button>`);

writeFileSync(file, html);
console.log(`Wrote prompts for ${keys.length} beasts to docs/art-prompts.html`);
