import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cadCanvas');
const viewport = $('canvasArea');
const scene = new THREE.Scene();
const darkColor = new THREE.Color('#101d2b');
const lightColor = new THREE.Color('#dce5eb');
scene.background = darkColor;
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1e8);
camera.up.set(0, 0, 1);
camera.position.set(160, -190, 140);
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(800, 600, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.36;
renderer.localClippingEnabled = true;
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.085;
controls.minDistance = 0.01;
controls.maxDistance = 1e9;
controls.target.set(0, 0, 30);
controls.update();
scene.add(new THREE.HemisphereLight(0xbfe8ff, 0x384555, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.65); keyLight.position.set(75, -85, 140); scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x80cbd2, 1.6); fillLight.position.set(-100, 100, 95); scene.add(fillLight);
const backLight = new THREE.DirectionalLight(0xffffff, 0.85); backLight.position.set(-40, 25, -50); scene.add(backLight);
const grid = new THREE.GridHelper(1000, 60, 0x365667, 0x273a49);
grid.rotation.x = Math.PI / 2;
grid.position.z = -8;
scene.add(grid);
const axes = new THREE.AxesHelper(46); axes.position.set(-130,-130,-8); scene.add(axes);
const sectionPlane = new THREE.Plane(new THREE.Vector3(0,0,-1),0);
const sectionPlane2 = new THREE.Plane(new THREE.Vector3(-1,0,0),0);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const measurePoints = [];
let measureMarkers = [];
let measureLine = null;
let selected = null;
const selectedNodes = new Set();
let lastTreeSelection = null;
let sourceStepText = null;
let stepExportCompatible = true;
const stepGlobalTransform = new THREE.Matrix4();
let fileIdentity = 'demo';
const savedMeasurements = [];
let dimensionGraphics = [];
let deferredInstall = null;
let studioEnvironment = null;
let lightTheme = false;
let modelRoot = null;
let worker = null;
let workerTask = null;
let partNodes = [];
let allNodes = [];
let currentFilename = 'demo-baugruppe';
let currentUnit = 'mm';
let selectionBox = null;
let clipEnabled = false;
let edgesEnabled = false;
let measuring = false;
let lightBackground = false;
let explodeFactor = 0;
let toastTimer = 0;
let toastEl = $('toast');
let renderedMeshCount = 0;
let tris = 0;
let idCounter = 0;
let dragCount = 0;
const nodeByObject = new WeakMap();
const basePositions = new WeakMap();
const originalsByMesh = new WeakMap();
const edgesByMesh = new WeakMap();

const presets = {
  aluminium:{color:'#b6c5d2', metalness:.77,roughness:.32,opacity:1},
  steel:{color:'#a4b0bb',metalness:.91,roughness:.3,opacity:1},
  chrome:{color:'#e4edf4',metalness:1,roughness:.09,opacity:1},
  copper:{color:'#ca7a48',metalness:.92,roughness:.28,opacity:1},
  brass:{color:'#c8a35c',metalness:.84,roughness:.27,opacity:1},
  plastic:{color:'#334556',metalness:0,roughness:.75,opacity:1},
  rubber:{color:'#1d2835',metalness:0,roughness:.92,opacity:1},
  glass:{color:'#9bdadd',metalness:.05,roughness:.1,opacity:.25}
};
function material(options={}){
  return new THREE.MeshStandardMaterial({
    color:options.color ?? '#8da3b4',metalness:options.metalness ?? .32,
    roughness:options.roughness ?? .48, transparent:(options.opacity??1)<1,
    opacity:options.opacity??1,side:THREE.DoubleSide,
    depthWrite:(options.opacity??1)>.96,
    clippingPlanes: clipEnabled ? [sectionPlane]:[]
  });
}
function toast(message,error=false){
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className = 'toast' + (error?' error':'');
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 5500);
}
function filenameStem(){return (currentFilename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_.äöüß]+/gi,'_') || 'modell').slice(0,120)}
function download(blob,filename){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
function setLoading(show,text='',detail=''){
  $('loadingOverlay').classList.toggle('hidden',!show);
  if(text)$('loadingText').textContent=text;
  if(detail)$('loadingDetail').textContent=detail;
}
function updateStatus(s){$('statusText').textContent=s}
function getMeshes(node){const arr=[];if(node)node.traverse(o=>{if(o.isMesh)arr.push(o)});return arr;}
function resetModel(){
  clearMeasure(); clearSavedMeasurements(); clearAutoDimensions(); selectNode(null);
  sourceStepText=null;stepGlobalTransform.identity();stepExportCompatible=true;fileIdentity='demo';
  if(selectionBox){scene.remove(selectionBox);selectionBox.geometry.dispose();selectionBox.material.dispose();selectionBox=null;}
  if(modelRoot){scene.remove(modelRoot);modelRoot.traverse(o=>{
    if(o.geometry)o.geometry.dispose();
    if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}
    if(edgesByMesh.has(o)){const edge=edgesByMesh.get(o);edge.geometry.dispose();edge.material.dispose();edgesByMesh.delete(o);}
  });}
  modelRoot = new THREE.Group(); modelRoot.name='Modell'; scene.add(modelRoot);
  allNodes=[];partNodes=[];idCounter=0;renderedMeshCount=0;tris=0; selected=null;selectedNodes.clear();lastTreeSelection=null;
  explodeFactor=0; $('explodeRange').value=0; $('explodeValue').textContent='0 %';
  $('treeSearch').value='';
}
function inferCategory(name=''){
  const s=String(name).toLocaleLowerCase('de');
  if(/pin|kontakt|terminal|lead|anschluss|contact/.test(s))return 'Pins';
  if(/coil|winding|wicklung|spule|wire|kupfer/.test(s))return 'Wicklung';
  if(/core|ferrit|kern|magnet/.test(s))return 'Kern';
  if(/case|housing|body|gehäuse|cover|kappe|deckel/.test(s))return 'Gehäuse';
  if(/isol|dielectric|kunststoff/.test(s))return 'Isolation';
  return 'Sonstige';
}
function registerNode(obj, parent=null, isPart=false){
  const node={id:++idCounter,obj,parent,children:[],isPart,collapsed:false,category:inferCategory(obj.name)};
  nodeByObject.set(obj,node);
  basePositions.set(obj,obj.position.clone());
  if(parent)parent.children.push(node);
  allNodes.push(node);
  if(isPart)partNodes.push(node);
  return node;
}
function captureOriginalMaterials(root){
  root.traverse(o=>{if(o.isMesh){
    originalsByMesh.set(o,(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.clone()));
  }});
}
function makeMesh(geom,mat,name){const m=new THREE.Mesh(geom,mat);m.name=name;m.castShadow=false;m.receiveShadow=false;return m;}
function simpleMaterial(hex,metalness=.35,roughness=.4){return material({color:hex,metalness,roughness})}
function addPart(name,geometry,mat,parent,position=[0,0,0],rotation=[0,0,0]){
  const group=new THREE.Group();group.name=name;parent.obj.add(group);
  const node=registerNode(group,parent,true);
  const mesh=makeMesh(geometry,mat,name);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  group.add(mesh);
  return node;
}
function addCustomPart(name,parent,fn){const group=new THREE.Group();group.name=name;parent.obj.add(group);const node=registerNode(group,parent,true);fn(group);return node;}
function createDemo(){
  resetModel();
  currentFilename='demo-baugruppe';currentUnit='mm';
  const root= new THREE.Group(); root.name='Antriebseinheit · Demo';modelRoot.add(root);
  const assembly=registerNode(root,null,false);
  const baseMat=simpleMaterial('#637b90',.75,.36), steelMat=simpleMaterial('#b6c8d0',.88,.28), copperMat=simpleMaterial('#d3905c',.82,.28), darkMat=simpleMaterial('#293945',.25,.72), blueMat=simpleMaterial('#3a9fb3',.68,.31), boltMat=simpleMaterial('#c1cbd1',.86,.25);
  addCustomPart('Grundplatte',assembly,g=>{
    const plate=makeMesh(new THREE.BoxGeometry(112,85,9),baseMat,'Grundplatte');plate.position.z=0;g.add(plate);
    for(let x of [-45,45])for(let y of [-31,31]){
      const screw=makeMesh(new THREE.CylinderGeometry(5,5,1.5,24),darkMat.clone(),'Befestigung');
      screw.rotation.x=Math.PI/2; screw.rotation.y=Math.PI/2; screw.position.set(x,y,5.1);g.add(screw);
    }
  });
  addCustomPart('Motorengehäuse',assembly,g=>{
    const body=makeMesh(new THREE.CylinderGeometry(25,25,49,64),blueMat,'Gehäuse');body.rotation.x=Math.PI/2;body.position.z=31;g.add(body);
    const collar=makeMesh(new THREE.CylinderGeometry(26.5,26.5,5,64),steelMat.clone(),'Deckel');collar.rotation.x=Math.PI/2;collar.position.z=56;g.add(collar);
  });
  addCustomPart('Welle',assembly,g=>{
    const shaft=makeMesh(new THREE.CylinderGeometry(7,7,54,40),steelMat.clone(),'Welle');shaft.rotation.x=Math.PI/2;shaft.position.z=84;g.add(shaft);
    const stub=makeMesh(new THREE.CylinderGeometry(5,5,8,40),steelMat.clone(),'Zapfen');stub.rotation.x=Math.PI/2;stub.position.z=115;g.add(stub);
  });
  addCustomPart('Kupferwicklung',assembly,g=>{
    const coil=makeMesh(new THREE.TorusGeometry(30,5.2,12,72),copperMat,'Wicklung');coil.position.z=31;g.add(coil);
  });
  addCustomPart('Flansch',assembly,g=>{
    const ring=makeMesh(new THREE.TorusGeometry(18,5.6,16,64),boltMat,'Flanschring');ring.position.z=60;g.add(ring);
  });
  addCustomPart('Anschlusskasten',assembly,g=>{
    const box=makeMesh(new THREE.BoxGeometry(26,30,24),darkMat.clone(),'Kasten');box.position.set(26,-3,35);g.add(box);
    const cover=makeMesh(new THREE.BoxGeometry(2.8,26,21),boltMat.clone(),'Abdeckung');cover.position.set(40,-3,35);g.add(cover);
  });
  captureOriginalMaterials(modelRoot);
  finalizeModel('Demo · Präzisionsbaugruppe','6 Komponenten · Demo');
  updateStatus('Demo geladen – STEP/IGES über „Modell öffnen“ importieren');
}

function parseCadResult(result, file){
  resetModel(); currentFilename=file.name;currentUnit='mm';
  const rootData=result.root;
  const geometryTemplates=result.meshes.map((meshData,i)=>{
    const geom=new THREE.BufferGeometry();
    const positions=meshData?.attributes?.position?.array;
    const indices=meshData?.index?.array;
    if(!positions || positions.length<9 || !indices || indices.length<3) return null;
    geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const normals=meshData?.attributes?.normal?.array;
    if(normals?.length===positions.length)geom.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geom.setIndex(indices);
    if(!geom.hasAttribute('normal'))geom.computeVertexNormals();
    const color = meshData.color || [0.62,0.71,0.78];
    const toHex = arr => new THREE.Color().setRGB(...arr.map(v=>v>1?v/255:v),THREE.LinearSRGBColorSpace).getHex();
    const materials=[simpleMaterial(toHex(color),.27,.49)];
    const faces=Array.isArray(meshData.brep_faces)?meshData.brep_faces:[];
    if(faces.length){
      let total=0;
      for(const f of faces){
        if(!Number.isFinite(f.first)||!Number.isFinite(f.last))continue;
        const start=Math.max(0,Math.trunc(f.first)*3);
        const count=Math.min(indices.length-start,(Math.trunc(f.last)-Math.trunc(f.first)+1)*3);
        if(count<=0)continue;
        let mi=0;
        if(Array.isArray(f.color)&&f.color.length>=3){
          const hex=toHex(f.color);
          mi=materials.findIndex((m,j)=>j>0&&m.color.getHex()===hex);
          if(mi<0){mi=materials.length;materials.push(simpleMaterial(hex,.28,.46));}
        }
        geom.addGroup(start,count,mi);
        total+=count;
      }
      if(!total)geom.clearGroups();
      // Note: faces cover each CAD triangle; additional ungrouped triangles are not expected.
    }
    renderedMeshCount++;
    tris+=Math.floor(indices.length/3);
    return {geom,materials,name:meshData.name || `Fläche ${i+1}`};
  });
  const used = new Set();
  function walk(node,parentObj,parentNode,depth=0){
    if(depth>80)return;
    const group=new THREE.Group();group.name=String(node.name||((parentNode?'Unterbaugruppe':'CAD-Baugruppe')));
    parentObj.add(group);
    const refs=Array.isArray(node.meshes)?node.meshes:[];
    const part=refs.length>0;
    const treeNode=registerNode(group,parentNode,part);
    refs.forEach(i=>{
      const template=geometryTemplates[i]; if(!template)return;
      used.add(i);
      const mesh=makeMesh(template.geom,template.materials.map(m=>m.clone()),template.name);
      group.add(mesh);
    });
    for(const child of (node.children||[])) walk(child,group,treeNode,depth+1);
    return treeNode;
  }
  if(rootData){walk(rootData,modelRoot,null);}
  else{const root=new THREE.Group();root.name='CAD-Modell';modelRoot.add(root);const rn=registerNode(root);
    geometryTemplates.forEach((t,i)=>{if(!t)return; const g=new THREE.Group();g.name=t.name;root.add(g);const n=registerNode(g,rn,true);g.add(makeMesh(t.geom,t.materials.map(m=>m.clone()),t.name));used.add(i)});
  }
  // Some CAD writers include flat meshes not referenced in the assembly tree.
  const missing=geometryTemplates.filter((t,i)=>t&&!used.has(i));
  if(missing.length){
    const parent=new THREE.Group();parent.name='Weitere Geometrien';modelRoot.add(parent);
    const pNode=registerNode(parent,null,false);
    missing.forEach(t=>{const g=new THREE.Group();g.name=t.name;parent.add(g);registerNode(g,pNode,true);g.add(makeMesh(t.geom,t.materials.map(m=>m.clone()),t.name))});
  }
  if(!getMeshes(modelRoot).length) throw new Error('CAD-Import lieferte keine nutzbare Geometrie.');
  captureOriginalMaterials(modelRoot);
  finalizeModel(file.name, `${partNodes.length} Bauteile · ${formatBytes(file.size)}`);
  updateStatus(`Import abgeschlossen: ${file.name}`);
  toast(`${file.name} erfolgreich geladen (${partNodes.length} Bauteile).`);
}
function formatBytes(n){if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}
function finalizeModel(title,sub){
  $('fileName').textContent=title;$('fileMeta').textContent=sub;
  $('partCount').textContent=partNodes.length;
  $('unitText').textContent='Einheit: '+currentUnit;
  $('inspectorUnit').textContent=currentUnit;
  $('dimensionNote').textContent=currentUnit==='Einheiten'?'STL und OBJ definieren keine Maßeinheit. Die Werte sind reine Modell-Koordinaten.':('Maße der Auswahl (oder des gesamten Modells) in '+currentUnit+'. Abhängig von den Koordinaten der Quelldatei.');
  renderedMeshCount=getMeshes(modelRoot).length;
  tris=getMeshes(modelRoot).reduce((a,m)=>a+(m.geometry.index?m.geometry.index.count/3:m.geometry.attributes.position.count/3),0);
  $('meshInfo').textContent=`${partNodes.length} Bauteile · ${renderedMeshCount} Netze`;
  $('trisInfo').textContent=`${Math.round(tris).toLocaleString('de-DE')} Dreiecke`;
  $('emptyOverlay').classList.add('hidden');
  updateTree();fitToObject(modelRoot);
  selectNode(null);
  repositionGrid();
  if(edgesEnabled)showEdges(true);
}
function repositionGrid(){
  const b=contentBounds(modelRoot);
  if(b.isEmpty())return;
  const s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());
  grid.position.set(c.x,c.y,b.min.z-Math.max(s.z*.04,2));
  grid.scale.setScalar(Math.max(s.x,s.y,s.z)/320 ||1);
  axes.position.set(b.min.x-s.x*.12,b.min.y-s.y*.12,grid.position.z);
  axes.scale.setScalar(Math.max(s.x,s.y,s.z)/155||1);
}
function contentBounds(root){
  const b=new THREE.Box3(); if(!root)return b;
  root.updateWorldMatrix(true,true);
  root.traverse(o=>{if(o.isMesh&&o.visible&&isActuallyVisible(o))b.expandByObject(o,true)});
  return b;
}
function isActuallyVisible(o){let v=o;while(v){if(!v.visible)return false;v=v.parent}return true}
function baseBounds(){const b=new THREE.Box3();if(!modelRoot)return b;modelRoot.updateWorldMatrix(true,true);modelRoot.traverse(o=>{if(o.isMesh)b.expandByObject(o,true)});return b;}
function fitToObject(o){
  const b=contentBounds(o); if(b.isEmpty()) {toast('Keine sichtbare Geometrie zum Einpassen.');return;}
  const size=b.getSize(new THREE.Vector3()); const center=b.getCenter(new THREE.Vector3());
  const radius=Math.max(size.length()*.63,1);
  const fov=camera.fov*Math.PI/180;
  const dist=radius/Math.tan(fov/2)*1.18;
  const dir=camera.position.clone().sub(controls.target).normalize();
  if(dir.lengthSq()<.001)dir.set(.65,-.7,.55).normalize();
  camera.near=Math.max(.001,dist/10000);camera.far=Math.max(dist*100,100);camera.updateProjectionMatrix();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(dir,dist);
  controls.minDistance=Math.max(radius*.005,.00001);
  controls.maxDistance=Math.max(radius*100,10);
  controls.update();
}
function setView(type){
  if(!modelRoot)return;
  const b=contentBounds(modelRoot);if(b.isEmpty())return;
  const center=b.getCenter(new THREE.Vector3());
  const dist=Math.max(b.getSize(new THREE.Vector3()).length()*1.6,10);
  const dirs={iso:new THREE.Vector3(1,-1,.9), top:new THREE.Vector3(0,0,1),front:new THREE.Vector3(0,-1,.001),right:new THREE.Vector3(1,0,.001),left:new THREE.Vector3(-1,0,.001),back:new THREE.Vector3(0,1,.001),bottom:new THREE.Vector3(0,0,-1)};
  const dir=dirs[type]||dirs.iso;
  controls.target.copy(center);camera.position.copy(center).add(dir.normalize().multiplyScalar(dist));
  camera.up.set(0,0,1); if(type==='top')camera.up.set(0,1,0);if(type==='bottom')camera.up.set(0,-1,0);
  camera.lookAt(center);controls.update();
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===type));
}
function closestNodeFromObject(obj){let v=obj;while(v&&v!==modelRoot){if(nodeByObject.has(v))return nodeByObject.get(v);v=v.parent;}return null}
function selectionBounds(){
  if(!selectedNodes.size)return contentBounds(modelRoot);
  const box=new THREE.Box3();
  for(const n of selectedNodes)box.union(contentBounds(n.obj));
  return box;
}
function selectNode(node, multi=false){
  if(!multi)selectedNodes.clear();
  if(node){
    if(multi && selectedNodes.has(node)) selectedNodes.delete(node);
    else selectedNodes.add(node);
  }
  selected=node && selectedNodes.has(node) ? node : ([...selectedNodes].at(-1)||null);
  if(selectionBox){scene.remove(selectionBox);selectionBox.geometry.dispose();selectionBox.material.dispose();selectionBox=null;}
  const bound=selectionBounds();
  if(selectedNodes.size && !bound.isEmpty()){
    selectionBox=new THREE.Box3Helper(bound,0x45e2dc);
    selectionBox.material.depthTest=false;selectionBox.material.transparent=true;selectionBox.material.opacity=.93;
    selectionBox.renderOrder=99;scene.add(selectionBox);
  }
  document.querySelectorAll('.tree-node').forEach(el=>el.classList.toggle('selected',selectedNodes.has(allNodes.find(n=>String(n.id)===el.dataset.id))));
  const count=selectedNodes.size;
  $('selectedName').textContent=count===0?'Gesamtes Modell':count===1?selected.obj.name:`${count} Elemente ausgewählt`;
  $('selectedInfo').textContent=count===0?'Kein einzelnes Bauteil ausgewählt':count>1?'Gemeinsame Material- und Kategorie-Einstellungen':selected.isPart?'Bauteil / Komponente':'Baugruppe';
  $('partCategory').value=count===1?(selected.category||'Sonstige'):'';
  updateMaterialControls();updateDimensions();
}
function selectedPartNodes(){return [...selectedNodes];}
function getTargetMeshes(){
  const nodes=selectedPartNodes();
  if(!nodes.length)return getMeshes(modelRoot);
  return [...new Set(nodes.flatMap(n=>getMeshes(n.obj)))];
}
function getFirstMaterial(){const mesh=getTargetMeshes()[0];if(!mesh)return null;return Array.isArray(mesh.material)?mesh.material[0]:mesh.material}
function updateMaterialControls(){const m=getFirstMaterial();if(!m)return;
  $('materialPreset').value='original';$('materialColor').value='#'+m.color.getHexString();
  $('metalnessRange').value=Math.round(m.metalness*100); $('roughnessRange').value=Math.round(m.roughness*100);
  $('opacityRange').value=Math.round(m.opacity*100);updateMaterialReadouts();
}
function updateMaterialReadouts(){['metalness','roughness','opacity'].forEach(k=>{$(k+'Value').textContent=$(k+'Range').value+' %'})}
function applyMaterialPatch(patch){
  if(!modelRoot)return; const meshes=getTargetMeshes();
  meshes.forEach(mesh=>{
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    mats.forEach(mat=>{
      if(patch.color!=null)mat.color.set(patch.color);
      if(patch.materialName!=null)mat.name=patch.materialName;
      if(patch.metalness!=null)mat.metalness=patch.metalness;
      if(patch.roughness!=null)mat.roughness=patch.roughness;
      if(patch.opacity!=null){mat.opacity=patch.opacity;mat.transparent=mat.opacity<.999;mat.depthWrite=mat.opacity>.96;}
      mat.needsUpdate=true;
    });
  });
}
function restoreMaterials(){
  if(!modelRoot)return;
  getTargetMeshes().forEach(mesh=>{
    const originals=originalsByMesh.get(mesh); if(!originals)return;
    (Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());
    const newM=originals.map(m=>m.clone());
    mesh.material=newM.length===1?newM[0]:newM;
    applyFlagsToMesh(mesh);
  });
  updateMaterialControls(); $('materialPreset').value='original';toast('Originalmaterialien wiederhergestellt.');
}
function updateDimensions(){
  const b=selectionBounds();
  const size=b.getSize(new THREE.Vector3());
  const formatter=n=>Number.isFinite(n)?n.toLocaleString('de-DE',{maximumFractionDigits:2})+' '+(currentUnit==='Einheiten'?'':currentUnit):'—';
  $('dimX').textContent=b.isEmpty()?'—':formatter(size.x);
  $('dimY').textContent=b.isEmpty()?'—':formatter(size.y);
  $('dimZ').textContent=b.isEmpty()?'—':formatter(size.z);
}
function nodeVisible(node){return isActuallyVisible(node.obj)}
function updateTree(){
  const root=$('assemblyTree');root.replaceChildren();
  const term=$('treeSearch').value.trim().toLocaleLowerCase('de');
  function matching(node){return node.obj.name.toLocaleLowerCase('de').includes(term) || node.children.some(matching)}
  const frag=document.createDocumentFragment();
  function render(node,depth){
    if(term&&!matching(node))return;
    const row=document.createElement('div');row.className='tree-node';row.dataset.id=node.id;
    if(selectedNodes.has(node))row.classList.add('selected');
    if(!nodeVisible(node))row.classList.add('dimmed');
    const indent=document.createElement('span');indent.className='tree-indent';indent.style.setProperty('--indent',Math.min(depth,15)*13+'px');row.append(indent);
    const arrow=document.createElement('button');arrow.className='tree-arrow'+(node.children.length?'':' empty');arrow.textContent=node.collapsed&&!term?'▸':'▾';arrow.title='Bauteile ein-/ausklappen';arrow.addEventListener('click',e=>{e.stopPropagation();node.collapsed=!node.collapsed;updateTree()});row.append(arrow);
    const eye=document.createElement('button');eye.className='tree-eye'+(nodeVisible(node)?'':' off');eye.textContent=nodeVisible(node)?'◉':'◌';eye.title=nodeVisible(node)?'Ausblenden':'Einblenden';eye.addEventListener('click',e=>{e.stopPropagation();node.obj.visible=!node.obj.visible;updateTree();updateDimensions()});row.append(eye);
    const icon=document.createElement('span');icon.className='tree-symbol'+(node.isPart?' mesh':'');icon.textContent=node.isPart?'⬡':'▤';row.append(icon);
    const name=document.createElement('span');name.className='tree-name';name.textContent=node.obj.name||'Unbenannt';name.title=node.obj.name;row.append(name);
    row.addEventListener('click',e=>{
      if(e.shiftKey&&lastTreeSelection){const a=allNodes.indexOf(lastTreeSelection),b=allNodes.indexOf(node);for(const n of allNodes.slice(Math.min(a,b),Math.max(a,b)+1))selectedNodes.add(n);selectedNodes.delete(node);selectNode(node,true);}
      else selectNode(node,e.ctrlKey||e.metaKey);
      lastTreeSelection=node;updateTree();if(!(e.ctrlKey||e.metaKey||e.shiftKey))closeMobilePanels();
    });
    row.addEventListener('dblclick',()=>fitToObject(node.obj));
    row.addEventListener('contextmenu',e=>{e.preventDefault();selectNode(node);isolateSelection()});
    frag.append(row);
    if(!node.collapsed||term)node.children.forEach(c=>render(c,depth+1));
  }
  allNodes.filter(n=>!n.parent).forEach(node=>render(node,0));
  root.append(frag);
  if(!root.children.length){const el=document.createElement('div');el.className='tree-no-results';el.textContent='Keine passenden Bauteile';root.append(el)}
}
function showAll(){if(!modelRoot)return;allNodes.forEach(n=>n.obj.visible=true);updateTree();updateDimensions()}
function hideAll(){if(!modelRoot)return;allNodes.forEach(n=>n.obj.visible=false);updateTree();updateDimensions()}
function isolateSelection(){if(!selectedNodes.size){toast('Bitte zuerst mindestens ein Bauteil auswählen.');return}
  allNodes.forEach(n=>n.obj.visible=false);
  for(const node of selectedNodes){
    node.obj.visible=true;node.obj.traverse(o=>o.visible=true);
    for(let p=node.parent;p;p=p.parent)p.obj.visible=true;
  }
  updateTree();updateDimensions();toast(`${selectedNodes.size} ausgewählte Elemente isoliert.`);
}
function applyFlagsToMesh(mesh){
  if(!mesh.isMesh)return;
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const m of mats){
    m.clippingPlanes=clipEnabled?[sectionPlane,...($('section2Toggle')?.checked?[sectionPlane2]:[])]:[];
    if($('xrayToggle').checked){if(m.userData.beforeXray===undefined)m.userData.beforeXray={opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite};m.opacity=Math.min(m.opacity,.24);m.transparent=true;m.depthWrite=false;}
    else if(m.userData.beforeXray){Object.assign(m,m.userData.beforeXray);delete m.userData.beforeXray;}
    m.needsUpdate=true;
  }
}
function showEdges(enabled){
  if(!modelRoot)return;
  const m=getMeshes(modelRoot);
  const totalTris=m.reduce((a,v)=>a+(v.geometry.index?v.geometry.index.count/3:v.geometry.attributes.position.count/3),0);
  if(enabled&&totalTris>1100000){toast('Kantendarstellung für sehr große Modelle deaktiviert (Performance).');edgesEnabled=false;$('wireframeButton').classList.remove('active');return}
  m.forEach(mesh=>{
    if(enabled&&!edgesByMesh.has(mesh)){
      try{
        const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,25),new THREE.LineBasicMaterial({color:lightBackground?0x2a4050:0x8dabb7,transparent:true,opacity:.46,depthWrite:false}));
        edge.renderOrder=2;mesh.add(edge);edgesByMesh.set(mesh,edge);
      }catch(err){console.warn('Kantengenerierung:',err)}
    }
    if(edgesByMesh.has(mesh))edgesByMesh.get(mesh).visible=enabled;
  });
}
function getNormal(axis,prefix){
  if(axis==='x')return new THREE.Vector3(-1,0,0);
  if(axis==='y')return new THREE.Vector3(0,-1,0);
  if(axis==='z')return new THREE.Vector3(0,0,-1);
  const nx=Number($(prefix+'Nx').value)||0,ny=Number($(prefix+'Ny').value)||0,nz=Number($(prefix+'Nz').value)||0;
  const v=new THREE.Vector3(nx,ny,nz);
  return v.lengthSq()>.000001?v.normalize().negate():new THREE.Vector3(0,0,-1);
}
function applySectionParameters(plane,axis,percentage,invert,prefix){
  const b=baseBounds();if(b.isEmpty())return;
  const n=getNormal(axis,prefix).multiplyScalar(invert?-1:1);
  const center=b.getCenter(new THREE.Vector3()),span=b.getSize(new THREE.Vector3());
  const halfExtent=(Math.abs(n.x)*span.x+Math.abs(n.y)*span.y+Math.abs(n.z)*span.z)/2;
  // n·x + constant >=0 is kept. At 0, the plane passes through the center.
  const offset=percentage/100*halfExtent;
  plane.normal.copy(n);plane.constant= -n.dot(center) + offset;
}
function updateSection(){
  applySectionParameters(sectionPlane,$('sectionAxis').value,Number($('sectionRange').value),$('sectionInvert').checked,'section');
  applySectionParameters(sectionPlane2,$('section2Axis').value,Number($('section2Range').value),$('section2Invert').checked,'section2');
  $('sectionValue').textContent=$('sectionRange').value+' %';
  $('customNormalFields').classList.toggle('hidden',$('sectionAxis').value!=='custom');
}
function updateExplode(){
  if(!modelRoot)return;
  const factor=Number($('explodeRange').value)/100;
  explodeFactor=factor;$('explodeValue').textContent=Math.round(factor*100)+' %';
  // Explode top-level parts along vectors from assembly center, without changing original geometry.
  const explodeNodes=partNodes.filter(n=>!n.parent?.isPart);
  explodeNodes.forEach(n=>n.obj.position.copy(basePositions.get(n.obj)||new THREE.Vector3()));
  modelRoot.updateWorldMatrix(true,true);
  const total=baseBounds();if(total.isEmpty())return;
  const center=total.getCenter(new THREE.Vector3());
  const scale=Math.max(total.getSize(new THREE.Vector3()).length(),1)*.42*factor;
  explodeNodes.forEach((n,i)=>{
    const box=baseBoundsForNode(n.obj);if(box.isEmpty())return;
    const partCenter=box.getCenter(new THREE.Vector3());
    const dir=partCenter.sub(center);
    if(dir.lengthSq()<1e-6){const a=2*Math.PI*i/Math.max(1,explodeNodes.length);dir.set(Math.cos(a),Math.sin(a),.22)}
    dir.normalize();
    // Transform world offset into local parent frame (CAD node rotations are typically identity).
    const parentQ=new THREE.Quaternion();n.obj.parent.getWorldQuaternion(parentQ);
    dir.applyQuaternion(parentQ.invert());
    n.obj.position.copy(basePositions.get(n.obj)||new THREE.Vector3()).add(dir.multiplyScalar(scale));
  });
  refreshSelectionBox();
  updateDimensions();
}
function refreshSelectionBox(){
  if(!selectionBox)return;
  const b=selectionBounds();selectionBox.box.copy(b);selectionBox.visible=selectedNodes.size>0&&!b.isEmpty();
}
function baseBoundsForNode(obj){const b=new THREE.Box3();obj.updateWorldMatrix(true,true);obj.traverse(o=>{if(o.isMesh)b.expandByObject(o,true)});return b}
function clearMeasure(){
  measurePoints.length=0;
  for(const m of measureMarkers){scene.remove(m);m.geometry.dispose();m.material.dispose()}
  measureMarkers=[];
  if(measureLine){scene.remove(measureLine);measureLine.geometry.dispose();measureLine.material.dispose();measureLine=null}
  $('measureLabel').classList.add('hidden');
}
function addMeasurePoint(pos){
  if(measurePoints.length===2)clearMeasure();
  measurePoints.push(pos.clone());
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.7,10,8),new THREE.MeshBasicMaterial({color:'#56ece1',depthTest:false}));
  const bb=baseBounds();marker.scale.setScalar(Math.max(bb.getSize(new THREE.Vector3()).length()*.005,.6));
  marker.position.copy(pos);marker.renderOrder=9;scene.add(marker);measureMarkers.push(marker);
  if(measurePoints.length===2){
    const dist=measurePoints[0].distanceTo(measurePoints[1]);
    addSavedMeasurement(measurePoints[0],measurePoints[1]);
    const geo=new THREE.BufferGeometry().setFromPoints(measurePoints);
    measureLine=new THREE.Line(geo,new THREE.LineBasicMaterial({color:'#62e8dd',linewidth:2,depthTest:false}));measureLine.renderOrder=10;scene.add(measureLine);
    $('measureLabel').textContent=`Gemessener Abstand: ${formatMeasured(dist)} · ΔX ${formatMeasured(Math.abs(measurePoints[1].x-measurePoints[0].x))} · ΔY ${formatMeasured(Math.abs(measurePoints[1].y-measurePoints[0].y))} · ΔZ ${formatMeasured(Math.abs(measurePoints[1].z-measurePoints[0].z))}`;
    $('measureLabel').classList.remove('hidden');
    toast(`Abstand gespeichert: ${formatMeasured(dist)}`);
  }else{
    $('measureLabel').textContent='Punkt 1 gesetzt – bitte Punkt 2 anklicken';$('measureLabel').classList.remove('hidden');
  }
}
function screenIntersections(evt){
  const rect=canvas.getBoundingClientRect();
  pointer.x=((evt.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((evt.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  return raycaster.intersectObjects(getMeshes(modelRoot).filter(isActuallyVisible),false).filter(hit=>!clipEnabled || sectionPlane.distanceToPoint(hit.point)>=-0.00001);
}
let pointerDown = null;
canvas.addEventListener('pointerdown',e=>{if(e.button===0)pointerDown={x:e.clientX,y:e.clientY}});
canvas.addEventListener('pointerup',e=>{
  if(e.button!==0||!pointerDown)return;
  const delta=Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y);
  pointerDown=null;if(delta>5||!modelRoot)return;
  const hits=screenIntersections(e);
  if(measuring){if(hits.length)addMeasurePoint(snapMeasurePoint(hits[0],e));else toast('Bitte direkt auf eine Modellfläche klicken.');return}
  selectNode(hits.length?closestNodeFromObject(hits[0].object):null,e.ctrlKey||e.metaKey);
  updateTree();
});

function openFileDialog(){$('fileInput').click()}
function getFileType(file){return file.name.split('.').pop().toLowerCase()}
async function loadFile(file){
  if(!file)return;
  const ext=getFileType(file);
  const allowed=['step','stp','iges','igs','brep','stl','obj','glb','gltf'];
  if(!allowed.includes(ext)){toast('Nicht unterstütztes Format. Nutze STEP, IGES, BREP, STL, OBJ oder GLB.',true);return}
  if(file.size>180*1024*1024){toast('Datei größer als 180 MB. Bitte kleinere Baugruppe oder vereinfachte Datei benutzen.',true);return}
  setLoading(true,`${file.name} wird eingelesen …`,'Die Verarbeitung erfolgt lokal auf deinem Gerät.');
  try{
    if(['step','stp','iges','igs','brep'].includes(ext)){
      const data=await parseWithWorker(file,ext);
      parseCadResult(data,file);
      fileIdentity=[file.name,file.size,file.lastModified].join(':');
      if(['step','stp'].includes(ext))sourceStepText=await file.text();
      restoreSavedProjectIfPresent();
    }else{
      await loadMeshFile(file,ext);
      fileIdentity=[file.name,file.size,file.lastModified].join(':');
      restoreSavedProjectIfPresent();
    }
  }catch(err){console.error(err);toast('Import fehlgeschlagen: '+(err?.message||String(err)),true);updateStatus('Importfehler – bisheriges Modell bleibt erhalten, wenn möglich.');}
  finally{setLoading(false);$('fileInput').value='';}
}
async function parseWithWorker(file,format){
  if(!worker){worker = new Worker('./occt-worker.js?v=1.2.0');worker.onerror = err=>{if(workerTask){workerTask.reject(new Error('CAD-Worker abgestürzt: '+(err.message||'Unbekannter Fehler')));workerTask=null}worker.terminate();worker=null};
    worker.onmessage = e=>{const d=e.data;const task=workerTask;if(!task||task.id!==d.id)return;
      if(d.phase==='engine')setLoading(true,'CAD-Engine wird geladen …','Der OpenCascade-Parser wird beim ersten STEP/IGES-Import aus dem Internet geladen.');
      if(d.phase==='parsing')setLoading(true,'STEP/IGES wird konvertiert …','Die Originaldatei bleibt auf deinem Computer.');
      if(d.phase==='done'){workerTask=null;task.resolve(d.result)}
      if(d.phase==='error'){workerTask=null;task.reject(new Error(d.error))}
    };
  }
  if(workerTask)throw new Error('Ein CAD-Import läuft bereits.');
  const buffer=await file.arrayBuffer();const id=Date.now()+'-'+Math.random();
  return new Promise((resolve,reject)=>{workerTask={id,resolve,reject};worker.postMessage({id,type:'parse',format,buffer},[buffer]);});
}
async function loadMeshFile(file,ext){
  let loaded;let objectUrl=null;
  try{
    if(ext==='stl'){
      const geom=new STLLoader().parse(await file.arrayBuffer());geom.computeVertexNormals();
      loaded=new THREE.Mesh(geom,simpleMaterial('#9babbd',.42,.4));loaded.name=file.name;
    }else if(ext==='obj'){
      const text=await file.text();loaded=new OBJLoader().parse(text);
    }else{
      objectUrl=URL.createObjectURL(file);
      const loader=new GLTFLoader();
      loaded=(await loader.loadAsync(objectUrl)).scene;
    }
    resetModel();currentFilename=file.name;currentUnit=['glb','gltf'].includes(ext)?'m':'Einheiten';
    // Z-up convention: glTF/OBJ usually Y-up, unlike CAD/STL. Display geometry in Z-up.
    if(ext==='glb'||ext==='gltf')loaded.rotation.x=Math.PI/2;
    if(ext==='obj')loaded.traverse(o=>{if(o.isMesh){const convert=m=>simpleMaterial(m.color||'#a9baca',.2,.58);o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);}});
    const root=new THREE.Group();root.name=file.name;modelRoot.add(root);const rn=registerNode(root,null,false);
    root.add(loaded);
    function gather(obj,parent){
      if(obj.isMesh){const p=registerNode(obj,parent,true);obj.name=obj.name||`Netz ${partNodes.length}`;return p}
      const n=obj===loaded?parent:registerNode(obj,parent,false);
      for(const child of obj.children){if(edgesByMesh.has(child))continue;gather(child,n)}
      return n;
    }
    gather(loaded,rn);
    captureOriginalMaterials(modelRoot);
    finalizeModel(file.name,`${partNodes.length} Komponenten · ${formatBytes(file.size)}`);
    updateStatus(`Import abgeschlossen: ${file.name}`);
    toast(`${file.name} erfolgreich geladen.`);
  }finally{if(objectUrl)URL.revokeObjectURL(objectUrl)}
}
function clonedForExport(){
  if(!modelRoot)throw new Error('Kein Modell geladen.');
  // Clone without axis helpers, measuring tools or edge overlays. Hidden parts stay hidden.
  const clone = modelRoot.clone(true);
  clone.traverse(o=>{if(o.isMesh){const mats=Array.isArray(o.material)?o.material:[o.material];const copies=mats.map(m=>{const c=m.clone();c.clippingPlanes=[];return c});o.material=copies.length===1?copies[0]:copies;}});
  clone.traverse(o=>{for(const child of [...o.children]){if(child.isLineSegments)child.removeFromParent()}});
  // STL/OBJ exporters handle visible objects inconsistently; remove invisible subtrees explicitly.
  clone.traverse(o=>{for(const c of [...o.children])if(!c.visible)c.removeFromParent()});
  return clone;
}
async function exportModel(format){
  if(!modelRoot||!getMeshes(modelRoot).some(isActuallyVisible)){toast('Keine sichtbaren Bauteile zum Exportieren vorhanden.',true);return}
  $('exportMenu').classList.add('hidden');
  setLoading(true,`Export als ${format.toUpperCase()} …`,'Sichtbare Bauteile und aktuelle Materialeinstellungen werden berücksichtigt.');
  try{
    if(format==='step'){exportRotatedStep();return;}
    if(format==='project'){saveProject(true);return;}
    const grouping=$('exportGrouping').value;
    const output=format==='glb'&&grouping!=='original'?groupedForExport(grouping):clonedForExport();
    if(format==='glb'){
      output.rotation.x=-Math.PI/2; // export a glTF-conformant Y-up model
      output.scale.setScalar(currentUnit==='mm'?0.001:1); // glTF specifies meters; STEP/IGES is imported in mm
      const result=await new GLTFExporter().parseAsync(output,{binary:true,onlyVisible:true,trs:false});
      download(new Blob([result],{type:'model/gltf-binary'}),filenameStem()+'.glb');
    }else if(format==='stl'){
      const result=new STLExporter().parse(output,{binary:true});
      download(new Blob([result],{type:'model/stl'}),filenameStem()+'.stl');
    }else if(format==='obj'){
      const result=new OBJExporter().parse(output);
      download(new Blob([result],{type:'text/plain;charset=utf-8'}),filenameStem()+'.obj');
      toast('OBJ exportiert. Hinweis: Dieser Export enthält keine MTL-Materialdatei.');
    }
    if(format!=='step'&&format!=='project')toast(format.toUpperCase()+' erfolgreich exportiert.');
  }catch(err){console.error(err);toast('Export fehlgeschlagen: '+(err.message||err),true)}
  finally{setLoading(false)}
}
function screenshot(){
  try{renderer.render(scene,camera);canvas.toBlob(b=>{if(b)download(b,filenameStem()+'-ansicht.png');else toast('Screenshot konnte nicht erzeugt werden.',true)},'image/png');}
  catch(err){toast('Screenshot fehlgeschlagen: '+err.message,true)}
}
function resize(){const r=viewport.getBoundingClientRect();if(r.width<=0||r.height<=0)return;
  renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport);
function animate(){requestAnimationFrame(animate);controls.update();refreshSelectionBox();renderer.render(scene,camera)}

// CADVIEW Studio v1.2: editing, materials, grouping, measurements and PWA
function applyCategory(){
  if(!modelRoot)return;
  const value=$('partCategory').value.trim().slice(0,80);
  if(!value){toast('Bitte eine Kategorie eingeben.',true);return}
  const target=selectedNodes.size?[...selectedNodes]:partNodes;
  const affected=new Set(target);
  target.forEach(n=>n.obj.traverse(o=>{const related=nodeByObject.get(o);if(related)affected.add(related)}));
  affected.forEach(n=>{n.category=value;n.obj.userData.category=value});
  updateTree();toast(`${affected.size} Komponenten zu „${value}“ zugeordnet.`);
}
function rotateActive(axis,angle){
  if(!modelRoot||!Number.isFinite(angle)||Math.abs(angle)>3600){toast('Ungültiger Drehwinkel.',true);return}
  if(!angle)return;
  if(explodeFactor){$('explodeRange').value=0;updateExplode();}
  const targets=selectedNodes.size?[...selectedNodes].filter(n=>![...selectedNodes].some(p=>p!==n&&nHasAncestor(n,p))).map(n=>n.obj):[modelRoot];
  const b=new THREE.Box3();targets.forEach(o=>b.union(contentBounds(o)));
  if(b.isEmpty()){toast('Keine sichtbaren Flächen zum Drehen.',true);return}
  const pivot=b.getCenter(new THREE.Vector3());
  const v=axis==='x'?new THREE.Vector3(1,0,0):axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
  const r=new THREE.Matrix4().makeRotationAxis(v,THREE.MathUtils.degToRad(angle));
  const worldTransform=new THREE.Matrix4().makeTranslation(pivot.x,pivot.y,pivot.z).multiply(r).multiply(new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
  modelRoot.updateWorldMatrix(true,true);
  targets.forEach(obj=>{
    const parentWorld=obj.parent?obj.parent.matrixWorld:new THREE.Matrix4();
    const localTransform=parentWorld.clone().invert().multiply(worldTransform).multiply(parentWorld);
    obj.applyMatrix4(localTransform);
    if(obj!==modelRoot)basePositions.set(obj,obj.position.clone());
  });
  if(selectedNodes.size)stepExportCompatible=false;
  else stepGlobalTransform.premultiply(worldTransform);
  modelRoot.updateWorldMatrix(true,true);
  refreshSelectionBox();updateDimensions();updateSection();repositionGrid();
  toast(`Rotation ${angle}° um ${axis.toUpperCase()} angewendet – Export berücksichtigt neue Ausrichtung.`);
}
function nHasAncestor(n,possibleParent){for(let p=n.parent;p;p=p.parent)if(p===possibleParent)return true;return false}
function readTransform(o){return {position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray()}}
function writeTransform(o,data){
  if(!data||data.position?.length!==3||data.quaternion?.length!==4||data.scale?.length!==3)return;
  if(![...data.position,...data.quaternion,...data.scale].every(Number.isFinite))return;
  o.position.fromArray(data.position);o.quaternion.fromArray(data.quaternion);o.scale.fromArray(data.scale);o.updateMatrix();
}
function saveRotationPreset(){
  const name=$('rotationPresetName').value.trim().slice(0,80);
  if(!name){toast('Bitte einen Namen für die Vorlage eingeben.');return}
  const presets=JSON.parse(localStorage.getItem('cadview-rotations')||'{}');
  presets[name]={root:readTransform(modelRoot),nodes:allNodes.map(n=>({id:n.id,transform:readTransform(n.obj)})),stepTransform:stepGlobalTransform.toArray(),stepCompatible:stepExportCompatible};
  localStorage.setItem('cadview-rotations',JSON.stringify(presets));loadRotationPresets();$('rotationPresetList').value=name;
  toast('Drehvorlage „'+name+'“ gespeichert.');
}
function loadRotationPresets(){
  const presets=JSON.parse(localStorage.getItem('cadview-rotations')||'{}');
  const select=$('rotationPresetList');select.replaceChildren(new Option('Vorlage auswählen …',''));
  for(const name of Object.keys(presets))select.add(new Option(name,name));
}
function applyRotationPreset(){
  const name=$('rotationPresetList').value;
  const d=JSON.parse(localStorage.getItem('cadview-rotations')||'{}')[name];
  if(!d){toast('Vorlage auswählen.',true);return}
  if(d.nodes.length!==allNodes.length){toast('Vorlage gehört zu einer anderen Bauteilstruktur.',true);return}
  if(explodeFactor){$('explodeRange').value=0;updateExplode()}
  writeTransform(modelRoot,d.root);
  d.nodes.forEach((record,i)=>{writeTransform(allNodes[i].obj,record.transform);basePositions.set(allNodes[i].obj,allNodes[i].obj.position.clone())});
  if(d.stepTransform?.length===16)stepGlobalTransform.fromArray(d.stepTransform);
  stepExportCompatible=Boolean(d.stepCompatible);
  modelRoot.updateWorldMatrix(true,true);refreshSelectionBox();updateDimensions();updateSection();fitToObject(modelRoot);
  toast('Drehvorlage „'+name+'“ angewendet.');
}
function serialMaterial(m){return {name:m.name||'',color:'#'+m.color.getHexString(),metalness:m.metalness??0,roughness:m.roughness??1,opacity:m.opacity??1}}
function projectData(){
  return {schema:'cadview-studio-project',version:2,source:currentFilename,fileIdentity,unit:currentUnit,
    root:readTransform(modelRoot),stepTransform:stepGlobalTransform.toArray(),stepCompatible:stepExportCompatible,
    nodes:allNodes.map(n=>({id:n.id,name:n.obj.name,category:n.category,visible:n.obj.visible,transform:readTransform(n.obj),materials:getMeshes(n.obj).filter(mesh=>closestNodeFromObject(mesh)===n).map(mesh=>({name:mesh.name,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(serialMaterial)}))})),
    lightTheme,measurements:savedMeasurements.map(m=>({a:m.a.toArray(),b:m.b.toArray(),label:m.label})),
    section:{enabled:clipEnabled,axis:$('sectionAxis').value,value:$('sectionRange').value,invert:$('sectionInvert').checked,secondary:$('section2Toggle').checked,axis2:$('section2Axis').value,value2:$('section2Range').value,invert2:$('section2Invert').checked}};
}
function saveProject(downloadFile=false){
  if(!modelRoot)return;
  const state=projectData();
  try{localStorage.setItem('cadview-project:'+fileIdentity,JSON.stringify(state));}
  catch(err){toast('Lokaler Speicher ist voll; JSON wird trotzdem exportiert.');}
  if(downloadFile)download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),filenameStem()+'.cadview.json');
  toast('Projektkonfiguration gespeichert'+(downloadFile?' und als JSON exportiert.':'.'));
}
function restoreSavedProjectIfPresent(){
  const saved=localStorage.getItem('cadview-project:'+fileIdentity);
  if(!saved)return;
  try{applyProject(JSON.parse(saved),true);toast('Gespeicherte Ausrichtung und Materialien wiederhergestellt.')}
  catch(err){console.warn('Projektwiederherstellung:',err)}
}
function applyProject(data,auto=false){
  if(!data||data.schema!=='cadview-studio-project'||!Array.isArray(data.nodes))throw new Error('Keine CADVIEW-Projektdatei.');
  if(data.nodes.length!==allNodes.length)throw new Error(`Bauteilstruktur passt nicht (${data.nodes.length} statt ${allNodes.length} Elemente). Bitte zuerst das zugehörige CAD-Modell laden.`);
  if(!auto&&data.source!==currentFilename&&!confirm(`Die Konfiguration stammt von „${data.source}“. Trotzdem auf „${currentFilename}“ anwenden?`))return;
  if(explodeFactor){$('explodeRange').value=0;updateExplode();}
  writeTransform(modelRoot,data.root);
  for(let i=0;i<data.nodes.length;i++){
    const row=data.nodes[i],node=allNodes[i];
    if(row.name!==node.obj.name)throw new Error('Projektteil-Namen stimmen nicht überein.');
    node.category=row.category||'Sonstige';node.obj.userData.category=node.category;
    node.obj.visible=row.visible!==false;
    writeTransform(node.obj,row.transform);
    basePositions.set(node.obj,node.obj.position.clone());
    const meshes=getMeshes(node.obj).filter(mesh=>closestNodeFromObject(mesh)===node);
    for(let j=0;j<meshes.length;j++){
      const m=meshes[j],saved=row.materials?.[j]?.materials;
      if(!saved)continue;
      const mats=Array.isArray(m.material)?m.material:[m.material];
      saved.forEach((v,k)=>{const mat=mats[k];if(!mat)return;mat.name=v.name;mat.color.set(v.color);mat.metalness=v.metalness;mat.roughness=v.roughness;mat.opacity=v.opacity;mat.transparent=v.opacity<1;mat.depthWrite=v.opacity>.96;mat.needsUpdate=true});
    }
  }
  if(data.stepTransform?.length===16)stepGlobalTransform.fromArray(data.stepTransform);
  stepExportCompatible=Boolean(data.stepCompatible);
  clearSavedMeasurements();clearAutoDimensions();
  for(const m of data.measurements||[])if(m.a?.length===3&&m.b?.length===3)addSavedMeasurement(new THREE.Vector3(...m.a),new THREE.Vector3(...m.b),m.label||'Abstand',false);
  if(data.section){
    const sec=data.section;clipEnabled=!!sec.enabled;
    $('sectionAxis').value=sec.axis||'z';$('sectionRange').value=sec.value||0;$('sectionInvert').checked=!!sec.invert;
    $('section2Toggle').checked=!!sec.secondary;$('section2Axis').value=sec.axis2||'x';$('section2Range').value=sec.value2||0;$('section2Invert').checked=!!sec.invert2;
    $('sectionRange').disabled=!clipEnabled;$('section2Range').disabled=!clipEnabled||!sec.secondary;
    $('sectionButton').classList.toggle('active',clipEnabled);$('sectionButton').setAttribute('aria-pressed',String(clipEnabled));
  }
  modelRoot.updateWorldMatrix(true,true);modelRoot.traverse(applyFlagsToMesh);updateTree();selectNode(null);updateSection();fitToObject(modelRoot);refreshMeasurementDisplays();
  if(data.lightTheme!==undefined)setLightTheme(data.lightTheme);
}
function materialDisplayName(mat){
  const generic=mat.name&&mat.name!=='Material'?mat.name:null;
  return generic||`Material ${'#'+mat.color.getHexString()}`;
}
function groupMeshesByMaterial(){
  // Split a mesh into independent surfaces per material index; required for true GLB hierarchy.
  modelRoot.updateWorldMatrix(true,true);
  return getMeshes(modelRoot).filter(isActuallyVisible).flatMap(mesh=>{
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const groups=mesh.geometry.groups.length?mesh.geometry.groups:[{start:0,count:mesh.geometry.index?.count||mesh.geometry.getAttribute('position').count,materialIndex:0}];
    const byIndex=new Map();
    for(const g of groups){if(!g.count)continue;const mi=g.materialIndex||0;
      if(!byIndex.has(mi))byIndex.set(mi,[]);byIndex.get(mi).push(g);
    }
    return [...byIndex].map(([materialIndex,ranges])=>{
      const sourceMat=mats[materialIndex]||mats[0];
      const srcIndex=mesh.geometry.index?.array;
      const geom=mesh.geometry.clone();
      if(srcIndex){
        const combined=[];for(const range of ranges){for(let k=range.start;k<Math.min(srcIndex.length,range.start+range.count);k++)combined.push(srcIndex[k]);}
        geom.setIndex(combined);
      }else if(ranges.length===1)geom.setDrawRange(ranges[0].start,ranges[0].count);
      geom.clearGroups();
      const copy=new THREE.Mesh(geom,sourceMat.clone());
      copy.name=mesh.name||'Teil';copy.matrix.copy(mesh.matrixWorld);copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);
      const node=closestNodeFromObject(mesh);
      return {copy,category:node?.category||'Sonstige',material:materialDisplayName(sourceMat),part:node?.obj.name||mesh.name};
    });
  });
}
function groupedForExport(mode){
  const result=new THREE.Group();result.name='CADVIEW Studio';
  const cache=new Map();
  const group=(parent,key)=>{
    const id=parent.uuid+'::'+key;
    if(!cache.has(id)){const g=new THREE.Group();g.name=key;parent.add(g);cache.set(id,g);}
    return cache.get(id);
  };
  for(const m of groupMeshesByMaterial()){
    let parent=result;
    if(mode==='category'||mode==='category-material')parent=group(parent,m.category);
    if(mode==='material'||mode==='category-material')parent=group(parent,m.material);
    m.copy.name=m.part+' / '+m.material;
    parent.add(m.copy);
  }
  return result;
}
function exportRotatedStep(){
  if(!sourceStepText)throw new Error('STEP-Originalexport nur bei einer geladenen .stp/.step-Datei.');
  if(!stepExportCompatible || !stepGlobalTransform.equals(new THREE.Matrix4())){
    throw new Error('STEP nach Drehung ist noch nicht verfügbar: Exakter CAD-Export erfordert einen OpenCascade-WASM-Schreibkernel. Verwende GLB/STL/OBJ für die gedrehte Geometrie oder exportiere die ursprüngliche STEP-Datei vor der Drehung.');
  }
  download(new Blob([sourceStepText],{type:'application/step'}),filenameStem()+'-original.step');
  toast('Original-STEP unverändert gespeichert (exakte CAD-Geometrie).');
}

function formatMeasured(raw){
  let original=currentUnit==='mm'?'mm':currentUnit==='m'?'m':'Einheiten';
  const choice=$('measureUnits').value;
  if(choice==='original'||original==='Einheiten')return raw.toLocaleString('de-DE',{maximumFractionDigits:3})+' '+original;
  const mm=original==='mm'?raw:raw*1000;
  const unit=choice;
  const value=unit==='mm'?mm:unit==='cm'?mm/10:unit==='m'?mm/1000:mm/25.4;
  return value.toLocaleString('de-DE',{maximumFractionDigits:3})+' '+(unit==='inch'?'in':unit);
}
function createDimensionSprite(label){
  const cv=document.createElement('canvas');cv.width=512;cv.height=128;
  const c=cv.getContext('2d');c.fillStyle=lightTheme?'#ffffff':'#0d1c2d';c.strokeStyle='#49c6c2';c.lineWidth=4;
  c.beginPath();c.roundRect(4,4,504,120,18);c.fill();c.stroke();
  c.fillStyle=lightTheme?'#1b293a':'#e8ffff';c.font='bold 37px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(label.slice(0,24),256,67);
  const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,transparent:true}));
  const size=Math.max(baseBounds().getSize(new THREE.Vector3()).length()*.095,2);
  sprite.scale.set(size*3,size*.75,1);sprite.renderOrder=99;return sprite;
}
function makeMeasureGraphic(a,b,label){
  const g=new THREE.Group();g.name='Bemaßung · '+label;
  const col=0x32d2cb;
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:col,depthTest:false}));line.renderOrder=80;g.add(line);
  const radius=Math.max(baseBounds().getSize(new THREE.Vector3()).length()*.0028,.18);
  for(const p of [a,b]){
    const dot=new THREE.Mesh(new THREE.SphereGeometry(radius,10,8),new THREE.MeshBasicMaterial({color:col,depthTest:false}));dot.position.copy(p);dot.renderOrder=81;g.add(dot);
  }
  const labelSprite=createDimensionSprite(label);labelSprite.position.copy(a).add(b).multiplyScalar(.5);g.add(labelSprite);
  scene.add(g);return g;
}
function disposeDimensionGroup(g){
  scene.remove(g);g.traverse(o=>{o.geometry?.dispose();const arr=Array.isArray(o.material)?o.material:[o.material];for(const m of arr)if(m){m.map?.dispose();m.dispose?.()}});
}
function addSavedMeasurement(a,b,label='Abstand',refresh=true){
  const entry={a:a.clone(),b:b.clone(),label,graphic:null};
  entry.graphic=makeMeasureGraphic(a,b,formatMeasured(a.distanceTo(b)));
  savedMeasurements.push(entry);
  if(refresh)refreshMeasurementDisplays();
}
function clearSavedMeasurements(){savedMeasurements.splice(0).forEach(m=>disposeDimensionGroup(m.graphic));refreshMeasurementDisplays()}
function clearAutoDimensions(){dimensionGraphics.forEach(disposeDimensionGroup);dimensionGraphics=[]}
function refreshMeasurementDisplays(){
  for(const m of savedMeasurements){disposeDimensionGroup(m.graphic);m.graphic=makeMeasureGraphic(m.a,m.b,formatMeasured(m.a.distanceTo(m.b)))}
  const list=$('measurementList');list.replaceChildren();
  if(!savedMeasurements.length){const p=document.createElement('p');p.className='dimension-note';p.textContent='Noch keine Punktmessungen. Im 3D-Modell zwei Punkte anklicken.';list.append(p)}
  savedMeasurements.forEach((m,i)=>{
    const row=document.createElement('div');row.className='measurement-entry';
    const label=document.createElement('span');label.textContent=`${i+1}. ${m.label}: ${formatMeasured(m.a.distanceTo(m.b))}`;
    const button=document.createElement('button');button.textContent='×';button.title='Messung löschen';button.addEventListener('click',()=>{disposeDimensionGroup(m.graphic);savedMeasurements.splice(i,1);refreshMeasurementDisplays()});
    row.append(label,button);list.append(row);
  });
}
function addAutoDimensions(){
  clearAutoDimensions();const b=selectionBounds();if(b.isEmpty())return toast('Keine sichtbare Geometrie zum Bemaßen.',true);
  const s=b.getSize(new THREE.Vector3());const offset=Math.max(s.length()*.04,.3);
  const data=[
    [new THREE.Vector3(b.min.x,b.min.y-offset,b.min.z-offset),new THREE.Vector3(b.max.x,b.min.y-offset,b.min.z-offset),'X'],
    [new THREE.Vector3(b.max.x+offset,b.min.y,b.min.z-offset),new THREE.Vector3(b.max.x+offset,b.max.y,b.min.z-offset),'Y'],
    [new THREE.Vector3(b.max.x+offset,b.max.y+offset,b.min.z),new THREE.Vector3(b.max.x+offset,b.max.y+offset,b.max.z),'Z']
  ];
  for(const [a,c,axis] of data)dimensionGraphics.push(makeMeasureGraphic(a,c,axis+' = '+formatMeasured(a.distanceTo(c))));
  toast('Breite (X), Tiefe (Y) und Höhe (Z) als Bemaßung eingeblendet.');
}
function snapMeasurePoint(hit,event){
  const mode=$('measureSnap').value;
  if(mode==='surface'||!hit.face)return hit.point.clone();
  const position=hit.object.geometry.getAttribute('position');
  const vertices=[hit.face.a,hit.face.b,hit.face.c].map(i=>hit.object.localToWorld(new THREE.Vector3().fromBufferAttribute(position,i)));
  const xy=p=>{const v=p.clone().project(camera),rect=canvas.getBoundingClientRect();return {x:rect.left+(v.x+1)/2*rect.width,y:rect.top+(1-v.y)/2*rect.height}};
  const mouse={x:event.clientX,y:event.clientY};
  let best=hit.point.clone(),bestDist=15;
  if(mode==='vertex')for(const v of vertices){const s=xy(v),d=Math.hypot(s.x-mouse.x,s.y-mouse.y);if(d<bestDist){best=v;bestDist=d}}
  if(mode==='edge')for(const [a,b] of [[vertices[0],vertices[1]],[vertices[1],vertices[2]],[vertices[2],vertices[0]]]){
    const pa=xy(a),pb=xy(b),dx=pb.x-pa.x,dy=pb.y;
    const t=Math.max(0,Math.min(1,((mouse.x-pa.x)*dx+(mouse.y-pa.y)*dy)/Math.max(dx*dx+dy*dy,1e-12)));
    const sx=pa.x+t*dx,sy=pa.y+t*dy,d=Math.hypot(sx-mouse.x,sy-mouse.y);
    if(d<bestDist){best=a.clone().lerp(b,t);bestDist=d}
  }
  return best;
}
function setLightTheme(light){
  lightTheme=Boolean(light);lightBackground=lightTheme;
  document.documentElement.dataset.theme=lightTheme?'light':'dark';
  $('lightBackgroundToggle').checked=lightTheme;
  $('themeButton').textContent=lightTheme?'☾ Dunkel':'☀ Hell';
  $('appThemeColor').content=lightTheme?'#f5f8fb':'#0b121e';
  scene.background=lightTheme?lightColor:darkColor;
  grid.material.opacity=lightTheme?.3:1;
  getMeshes(modelRoot).forEach(m=>{if(edgesByMesh.has(m))edgesByMesh.get(m).material.color.set(lightTheme?'#294658':'#8dabb7')});
  localStorage.setItem('cadview-theme',lightTheme?'light':'dark');
}
async function setStudio(enabled){
  $('studioToggle').checked=!!enabled;$('renderButton').classList.toggle('active',!!enabled);
  try{
    if(enabled&&!studioEnvironment){
      const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
      const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();
      studioEnvironment=pmrem.fromScene(room).texture;room.dispose();pmrem.dispose();
    }
    scene.environment=enabled?studioEnvironment:null;
    renderer.toneMappingExposure=enabled?1.3:1.36;
    toast(enabled?'Studio-Rendering aktiv: Reflexionen und Materiallicht.':'Technische Materialansicht aktiv.');
  }catch(err){$('studioToggle').checked=false;toast('Studio-Umgebung konnte nicht geladen werden: '+err.message,true)}
}
function screenshotHighRes(){
  const rect=viewport.getBoundingClientRect();const old=renderer.getPixelRatio();
  const ratio=Math.min(Math.max(old*2,2),Math.min(4096/rect.width,4096/rect.height));
  if(!Number.isFinite(ratio)||ratio<=0)return;
  try{
    renderer.setPixelRatio(ratio);renderer.setSize(rect.width,rect.height,false);renderer.render(scene,camera);
    canvas.toBlob(blob=>{
      renderer.setPixelRatio(old);resize();
      if(blob)download(blob,filenameStem()+'-render.png');else toast('Bildexport fehlgeschlagen.',true);
    },'image/png');
    toast(`Renderbild ${Math.round(rect.width*ratio)} × ${Math.round(rect.height*ratio)} Pixel.`);
  }catch(err){renderer.setPixelRatio(old);resize();toast('Bildexport: '+err.message,true)}
}
function initializePWA(){
  if('serviceWorker' in navigator&&location.protocol==='https:'){
    navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline-Service-Worker:',e));
  }
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installButton').title='Als Desktop- oder Mobil-App installieren'});
  window.addEventListener('appinstalled',()=>{deferredInstall=null;$('installButton').textContent='✓ Installiert';toast('CADVIEW Studio wurde installiert.')});
  if(window.matchMedia('(display-mode: standalone)').matches)$('installButton').textContent='✓ App';
}
async function promptInstallation(){
  if(deferredInstall){const event=deferredInstall;deferredInstall=null;event.prompt();await event.userChoice;return}
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  toast(isIOS?'Auf iOS: Teilen → Zum Home-Bildschirm.':'In Edge/Chrome: Menü → Apps → Diese Website als App installieren.');
}
// UI wiring
$('openButton').addEventListener('click',openFileDialog);
$('emptyOpen').addEventListener('click',openFileDialog);
$('mobileOpen').addEventListener('click',openFileDialog);
$('demoButton').addEventListener('click',()=>{createDemo();toast('Beispielbaugruppe geladen.')});
$('fileInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadFile(f)});
$('treeSearch').addEventListener('input',updateTree);
$('showAllButton').addEventListener('click',showAll);
$('hideAllButton').addEventListener('click',hideAll);
$('fitButton').addEventListener('click',()=>fitToObject(modelRoot));
$('isolateButton').addEventListener('click',isolateSelection);
$('resetVisibilityButton').addEventListener('click',showAll);
$('clearSelectionButton').addEventListener('click',()=>{selectNode(null);updateTree()});
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.view)));
$('gridButton').addEventListener('click',()=>{const next=!grid.visible;grid.visible=next;axes.visible=next;$('gridButton').classList.toggle('active',next);$('gridButton').setAttribute('aria-pressed',String(next))});
$('wireframeButton').addEventListener('click',()=>{edgesEnabled=!edgesEnabled;showEdges(edgesEnabled);$('wireframeButton').classList.toggle('active',edgesEnabled);$('wireframeButton').setAttribute('aria-pressed',String(edgesEnabled))});
$('measureButton').addEventListener('click',()=>{measuring=!measuring;clearMeasure();canvas.style.cursor=measuring?'crosshair':'grab';$('measureButton').classList.toggle('active',measuring);$('measureButton').setAttribute('aria-pressed',String(measuring));if(measuring)toast('Messmodus: zwei Punkte auf dem Modell anklicken.')});
$('sectionButton').addEventListener('click',()=>{clipEnabled=!clipEnabled;$('sectionRange').disabled=!clipEnabled;$('section2Range').disabled=!clipEnabled||!$('section2Toggle').checked;modelRoot?.traverse(applyFlagsToMesh);updateSection();$('sectionButton').classList.toggle('active',clipEnabled);$('sectionButton').setAttribute('aria-pressed',String(clipEnabled))});
$('sectionRange').addEventListener('input',updateSection);
for(const id of ['sectionAxis','sectionInvert','sectionNx','sectionNy','sectionNz','section2Axis','section2Range','section2Invert']) $(id).addEventListener('input',updateSection);
$('section2Toggle').addEventListener('change',()=>{ $('section2Range').disabled=!clipEnabled||!$('section2Toggle').checked;modelRoot?.traverse(applyFlagsToMesh);updateSection() });
$('explodeRange').addEventListener('input',updateExplode);
$('xrayToggle').addEventListener('change',()=>modelRoot?.traverse(applyFlagsToMesh));
$('lightBackgroundToggle').addEventListener('change',e=>setLightTheme(e.target.checked));
$('materialPreset').addEventListener('change',e=>{
  const name=e.target.value;
  if(name==='original'){restoreMaterials();return}
  if(name==='custom')return;
  const p=presets[name];if(!p)return;
  applyMaterialPatch({...p,materialName:$('materialPreset')?.selectedOptions?.[0]?.textContent||name});
  $('materialColor').value=p.color;$('metalnessRange').value=p.metalness*100;$('roughnessRange').value=p.roughness*100;$('opacityRange').value=p.opacity*100;updateMaterialReadouts();
});
$('materialColor').addEventListener('input',e=>{applyMaterialPatch({color:e.target.value});$('materialPreset').value='custom'});
for(const field of ['metalness','roughness','opacity']){
  $(field+'Range').addEventListener('input',e=>{applyMaterialPatch({[field]:Number(e.target.value)/100});$('materialPreset').value='custom';updateMaterialReadouts()});
}
$('resetMaterialButton').addEventListener('click',restoreMaterials);
$('screenshotButton').addEventListener('click',screenshot);
$('exportButton').addEventListener('click',e=>{e.stopPropagation();const m=$('exportMenu');m.classList.toggle('hidden');$('exportButton').setAttribute('aria-expanded',String(!m.classList.contains('hidden')))});
document.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click',()=>exportModel(b.dataset.export)));
document.addEventListener('click',e=>{if(!e.target.closest('.dropdown-anchor')){$('exportMenu').classList.add('hidden');$('exportButton').setAttribute('aria-expanded','false')}});
function closeMobilePanels(){$('leftSidebar').classList.remove('open');$('rightSidebar').classList.remove('open')}
$('mobileTree').addEventListener('click',()=>{$('leftSidebar').classList.toggle('open');$('rightSidebar').classList.remove('open')});
$('mobileProperties').addEventListener('click',()=>{$('rightSidebar').classList.toggle('open');$('leftSidebar').classList.remove('open')});
$('closeLeft').addEventListener('click',closeMobilePanels);$('closeRight').addEventListener('click',closeMobilePanels);
$('viewportShell').addEventListener('click',e=>{if(window.innerWidth<671&&e.target.closest('.canvas-area'))closeMobilePanels()});
for(const eventType of ['dragenter','dragover'])window.addEventListener(eventType,e=>{if(e.dataTransfer?.types?.includes('Files')){e.preventDefault();$('dropOverlay').classList.remove('hidden')}});
window.addEventListener('dragleave',e=>{if(e.relatedTarget===null||!document.elementFromPoint(e.clientX,e.clientY))$('dropOverlay').classList.add('hidden')});
window.addEventListener('drop',e=>{e.preventDefault();$('dropOverlay').classList.add('hidden');const f=e.dataTransfer?.files?.[0];if(f)loadFile(f)});
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();openFileDialog()}
  if(e.key==='Escape'){if(measuring){measuring=false;$('measureButton').classList.remove('active');clearMeasure();canvas.style.cursor='grab'}else{selectNode(null);updateTree()}closeMobilePanels()}
  if(e.key.toLowerCase()==='f')fitToObject(selected?.obj||modelRoot);
});

$('applyCategoryButton').addEventListener('click',applyCategory);
for(const id of ['rotatePositive','rotateNegative','rotate180'])$(id).addEventListener('click',()=>{
  const d=id==='rotate180'?180:Number($('rotationAngle').value)*(id==='rotateNegative'?-1:1);
  rotateActive($('rotationAxis').value,d);
});
$('saveRotationPreset').addEventListener('click',saveRotationPreset);
$('applyRotationPreset').addEventListener('click',applyRotationPreset);
$('saveProjectButton').addEventListener('click',()=>saveProject(true));
$('loadProjectButton').addEventListener('click',()=>$('projectInput').click());
$('projectInput').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{applyProject(JSON.parse(await file.text()));toast('Projektkonfiguration geladen.')}catch(err){toast('Projektdatei: '+err.message,true)}finally{e.target.value=''}});
$('themeButton').addEventListener('click',()=>setLightTheme(!lightTheme));
$('renderButton').addEventListener('click',()=>{ $('studioToggle').checked=!$('studioToggle').checked;setStudio($('studioToggle').checked) });
$('studioToggle').addEventListener('change',e=>setStudio(e.target.checked));
$('highResScreenshot').addEventListener('click',screenshotHighRes);
$('dimensionButton').addEventListener('click',addAutoDimensions);
$('measureBoundsButton').addEventListener('click',addAutoDimensions);
$('clearAllMeasurements').addEventListener('click',()=>{clearSavedMeasurements();clearAutoDimensions();toast('Alle Bemaßungen entfernt.')});
$('measureUnits').addEventListener('change',refreshMeasurementDisplays);
$('installButton').addEventListener('click',promptInstallation);
initializePWA();
loadRotationPresets();
setLightTheme(localStorage.getItem('cadview-theme')==='light');
createDemo();resize();animate();