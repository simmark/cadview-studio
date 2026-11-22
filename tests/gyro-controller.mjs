// Exercise the same Three.js build as the viewer without a DOM or physical sensor.
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

const threeUrl = new URL('../vendor/three/build/three.module.min.js',import.meta.url).href;
registerHooks({resolve(specifier,context,next){
  return specifier === 'three' ? {url:threeUrl,shortCircuit:true} : next(specifier,context);
}});
const {createGyro,screenPose} = await import('../mobile/gyro.js');
const {Vector3,PerspectiveCamera} = await import('three');
const sample={alpha:0,beta:0,gamma:0};
assert.equal(screenPose({...sample,beta:null},0),null);
assert.equal(screenPose({...sample,alpha:Infinity},0),null);
assert.ok(screenPose({...sample,alpha:90},90).angleTo(screenPose(sample,0))<1e-6);
const axis = new Vector3(0,0,1).applyQuaternion(screenPose({...sample,beta:90},0));
assert.ok(axis.distanceTo(new Vector3(0,-1,0))<1e-6);

globalThis.window = Object.assign(new EventTarget(),{screen:{orientation:{angle:0}},isSecureContext:true});
globalThis.document = Object.assign(new EventTarget(),{hidden:false});
let tick;
globalThis.requestAnimationFrame=fn=>{tick=fn;return 1;};
globalThis.cancelAnimationFrame=()=>{tick=null;};
const target=new Vector3(5,0,0);
const camera=new PerspectiveCamera();
camera.up.set(0,0,1);camera.position.set(5,-10,0);camera.lookAt(target);
let state;
const gyro=createGyro({camera,target,touching:()=>false,update:()=>{},status:value=>{state=value;}});
const emit = beta=>window.dispatchEvent(Object.assign(new Event('deviceorientation'),{...sample,beta}));
const hidden = value=>{document.hidden=value;document.dispatchEvent(new Event('visibilitychange'));};
const drain = ()=>{for(let i=0;tick && i<40;i++){const fn=tick;tick=null;fn();}};
await gyro.start();
assert.equal(state,'unsupported');

let resolvePermission;
window.DeviceOrientationEvent={requestPermission:()=>new Promise(resolve=>{resolvePermission=resolve;})};
const request=gyro.start();
gyro.stop();
resolvePermission('granted');
await request;
assert.equal(gyro.isListening(),false,'Late permission after exit must be ignored');

window.DeviceOrientationEvent={};
await gyro.start();
emit(null);
assert.equal(state,'waiting');
emit(0);emit(15);drain();
const current=camera.position.clone();
assert.ok(Math.abs(current.distanceTo(target)-10)<1e-8);
hidden(true);assert.equal(state,'paused');assert.equal(gyro.isListening(),false);
emit(80);drain();assert.ok(camera.position.equals(current));
hidden(false);assert.equal(state,'waiting');
emit(90);drain();assert.equal(state,'active');assert.ok(camera.position.equals(current));
window.screen.orientation.angle=90;
emit(100);drain();assert.ok(camera.position.equals(current));
gyro.stop();
emit(0);drain();assert.ok(camera.position.equals(current));
console.log('PASS gyro coordinate axes, invalid samples, late permission, hidden/resume calibration, screen rotation and teardown.');
