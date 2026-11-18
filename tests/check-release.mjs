/**
 * CADVIEW Studio lightweight release guard.
 * Static checks only: this does NOT replace interactive WebGL/PWA regression testing.
 * Run: node tests/check-release.mjs
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('index.html');
const css = read('rework.css');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const gui = read('gui.js');

for (const filename of ['app.js', 'gui.js', 'occt-worker.js', 'sw.js']) {
  execFileSync(process.execPath, ['--check', new URL('../'+filename, import.meta.url).pathname], {stdio:'pipe'});
}

assert.equal(manifest.id, '/cadview-studio/', 'CADVIEW PWA must have a unique identity');
assert.equal(manifest.scope, '/cadview-studio/', 'CADVIEW PWA must have its own scope');

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const refs = new Set([...app.matchAll(/\$\('([^']+)'\)/g), ...gui.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]));
const missing = [...refs].filter(id=>!ids.has(id));
assert.deepEqual(missing, [], 'UI references missing in index.html');

for (const id of ['cadCanvas','cadInteractionLayer','exportMenu','exportButton','sectionRange','explodeRange','measureLabel','measurementList']) {
  assert.ok(ids.has(id), 'Required UI element missing: ' + id);
}

const appTag = html.match(/src="\.\/(app\.js\?v=[^"]+)"/)?.[1];
const cssTag = html.match(/href="\.\/(rework\.css\?v=[^"]+)"/)?.[1];
assert.ok(appTag && cssTag,'App and GUI stylesheet must be versioned');
assert.ok(sw.includes("'./" + appTag + "'"), 'PWA precache must track app JS');
assert.ok(sw.includes("'./" + cssTag + "'"), 'PWA precache must track rework CSS');
assert.ok(app.includes('function renderNow('),'Direct redraw API missing');
assert.ok(app.includes("renderNow('selection changed')"),'Selection must redraw without mouse movement');
assert.ok(app.includes("renderNow('keyboard hide')"),'H shortcut must redraw immediately');
assert.ok(app.includes("refreshSelectionBox();\n  renderNow('selection changed')"),'Selection bounds must be synchronized before rendering');
assert.ok(app.indexOf('startRenderLoop();') < app.indexOf("safeStartup('PWA'"), 'Render loop must start before optional UI initialization');
assert.ok(app.includes('animationTicks'),'Render loop diagnostic counter missing');

for (const id of ['showAll','hideAll','updateSection','updateExplode','toggleMeasurements','makeMeasureGraphic']) {
  assert.ok(app.includes('function '+id+'('),'Scene function missing: '+id);
}
for (const label of ['section changed','explode changed','measurement visibility changed','single part visibility changed','saved measurement']) {
  assert.ok(app.includes("renderNow('" + label + "')"), 'Immediate redraw hook missing: '+label);
}
assert.ok(css.includes('body > #exportMenu.export-menu'),'Export popover must escape header stacking context');
assert.ok(app.includes('document.body.appendChild(exportMenu)'),'Export portal missing');

console.log('PASS CADVIEW static QA: module syntax, ID linkage, PWA cache, redraw hooks, export portal');
console.log('WARNING: Run QA-TESTPROTOKOLL.md in Edge/installed PWA for actual WebGL validation.');
