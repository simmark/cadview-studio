/* CADVIEW Studio: Import off the UI thread. Runs entirely in user's browser. */
let parserPromise = null;
// 0.0.23 is the latest published npm release (0.0.24 exists only in the upstream git repository).
// Both the JS loader and its matching WASM binary must come from the SAME version.
const OCCT_VERSION = '0.0.23';
const OCCT_CDNS = [
  `https://cdn.jsdelivr.net/npm/occt-import-js@${OCCT_VERSION}/dist/`,
  `https://unpkg.com/occt-import-js@${OCCT_VERSION}/dist/`
];
async function initializeParser(){
  if (!parserPromise){
    parserPromise = (async () => {
      const errors = [];
      for (const baseUrl of OCCT_CDNS) {
        try {
          importScripts(baseUrl + 'occt-import-js.js');
          if (typeof self.occtimportjs !== 'function') {
            throw new Error('JavaScript geladen, aber CAD-Engine fehlt');
          }
          const engine = await self.occtimportjs({
            locateFile: name => baseUrl + name
          });
          if (!engine || typeof engine.ReadStepFile !== 'function' || typeof engine.ReadIgesFile !== 'function') {
            throw new Error('CAD-Engine ohne STEP/IGES-Unterstützung');
          }
          return engine;
        } catch (err) {
          errors.push(`${new URL(baseUrl).hostname}: ${err?.message || String(err)}`);
        }
      }
      throw new Error(`CAD-Engine konnte nicht geladen werden. Die bekannten Download-Adressen wurden ausprobiert. Details: ${errors.join(' | ')}. Bitte Internetzugang und Werbeblocker prüfen.`);
    })().catch(err => { parserPromise = null; throw err; });
  }
  return parserPromise;
}
self.onmessage = async ({data}) => {
  if(data.type !== 'parse') return;
  const {id, format, buffer, quality} = data;
  try {
    self.postMessage({id, phase:'engine'});
    const engine = await initializeParser();
    self.postMessage({id, phase:'parsing'});
    const bytes = new Uint8Array(buffer);
    const opts = {linearUnit:'millimeter',linearDeflectionType:'bounding_box_ratio',linearDeflection:quality || 0.001,angularDeflection:0.5};
    let result;
    if (format === 'step' || format === 'stp') result = engine.ReadStepFile(bytes, opts);
    else if (format === 'iges' || format === 'igs') result = engine.ReadIgesFile(bytes, opts);
    else if (format === 'brep') result = engine.ReadBrepFile(bytes, opts);
    else throw new Error('Nicht unterstütztes CAD-Format');
    if (!result || !result.success) throw new Error('Die CAD-Datei konnte nicht eingelesen werden.');
    if (!result.meshes?.length) throw new Error('Die Datei enthält keine darstellbaren Flächen. Bei sehr großen Baugruppen kann das Arbeitsspeicherlimit erreicht sein.');
    self.postMessage({id,phase:'done',result});
  } catch(err) {
    self.postMessage({id,phase:'error',error:err?.message || String(err)});
  }
};