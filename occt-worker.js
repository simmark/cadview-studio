/* CADVIEW Studio: Import off the UI thread. Runs entirely in user's browser. */
let parserPromise = null;
const OCCT_VERSION = '0.0.24';
const OCCT_CDN = `https://cdn.jsdelivr.net/npm/occt-import-js@${OCCT_VERSION}/dist/`;
async function initializeParser(){
  if (!parserPromise){
    parserPromise = (async () => {
      importScripts(OCCT_CDN + 'occt-import-js.js');
      if (typeof self.occtimportjs !== 'function') throw new Error('CAD-Engine konnte nicht geladen werden. Internetverbindung prüfen.');
      return await self.occtimportjs({ locateFile: (name) => OCCT_CDN + name });
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