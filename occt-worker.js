/* CADVIEW Studio: Import off the UI thread. Runs entirely in user's browser. */
let parserPromise = null;
// 0.0.23 is the latest published npm release (0.0.24 exists only in the upstream git repository).
// Both the JS loader and its matching WASM binary must come from the SAME version.
const OCCT_VERSION = '0.0.23';
// Bundled locally since 1.5.0 (offline-capable, no third-party request). CDNs remain as fallback only.
const OCCT_CDNS = [
  new URL('./vendor/occt-import-js/', self.location.href).href,
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
function meshStats(result){
  let triangles = 0, surfaces = 0;
  for (const mesh of result?.meshes ?? []){
    const count = (mesh.index?.array?.length ?? 0) / 3;
    if (count < 1) continue;
    triangles += count;
    surfaces++;
  }
  return {triangles, surfaces};
}
function modelSpan(meshes){
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of meshes){
    if (!mesh.index?.array?.length) continue;
    const vertices = mesh.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3){
      for (let axis = 0; axis < 3; axis++){
        const value = vertices[i + axis];
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
    }
  }
  return Math.max(...max.map((value, axis) => value - min[axis]));
}
function readStep(engine, bytes, standardOptions, onRefining){
  const standard = engine.ReadStepFile(bytes, standardOptions);
  if (!standard?.success || !standard.meshes?.length) return standard;

  // A single STEP can contain many replicated solids. Refine only low-complexity
  // imports to keep large assemblies on the standard, faster path.
  const initial = meshStats(standard);
  if (bytes.length > 12 * 1024 * 1024 || initial.triangles > 25000 ||
      standard.meshes.length > 64 || !initial.surfaces) return standard;
  const span = modelSpan(standard.meshes);
  if (!Number.isFinite(span) || span <= 0) return standard;

  onRefining();
  try {
    // Derive a physical chord tolerance from the visible span, instead of
    // relying on the kernel's STEP bounding-box-ratio estimate.
    const refined = engine.ReadStepFile(bytes, {
      ...standardOptions,
      linearDeflectionType: 'absolute_value',
      linearDeflection: Math.max(0.005, span * 0.001),
      angularDeflection: 0.25
    });
    const detail = meshStats(refined);
    if (refined?.success && detail.surfaces >= initial.surfaces &&
        detail.triangles > initial.triangles && detail.triangles <= 350000) return refined;
  } catch {
    // The first successful import stays usable if refinement fails.
  }
  return standard;
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
    if (format === 'step' || format === 'stp') result = readStep(engine, bytes, opts, () => self.postMessage({id, phase:'refining'}));
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