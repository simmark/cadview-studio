// DeviceOrientation uses intrinsic Z-X'-Y'' angles. Express the screen's rotation
// relative to its initial frame, then map that local delta into the CAD camera frame.
import {Euler, Quaternion, Vector3, MathUtils} from 'three';

const screenNormal = new Vector3(0,0,1);
export function screenPose({alpha,beta,gamma}, angle) {
  if (![alpha,beta,gamma].every(Number.isFinite)) return null;
  const rad = MathUtils.degToRad;
  const device = new Quaternion().setFromEuler(new Euler(rad(beta),rad(gamma),rad(alpha),'ZXY'));
  return device.multiply(new Quaternion().setFromAxisAngle(screenNormal,-rad(angle)));
}

export function createGyro({camera, target, update, status, touching}) {
  let generation = 0, requested = false, listening = false, timer, frame;
  let mode = 'orbit';
  let reference, baseCamera, filtered, latest, lastAngle;
  function recenter() { reference = null; latest = null; filtered = null; }
  function detach() {
    window.removeEventListener('deviceorientation', sample);
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    frame = 0;
    listening = false;
    recenter();
  }
  function stop(reason='off') {
    generation++;
    requested = false;
    detach();
    status(reason);
  }
  function draw() {
    frame = 0;
    if (!latest || !reference || touching()) return;
    filtered.slerp(latest,0.45);
    const rotation = reference.clone().invert().multiply(filtered);
    const direction = screenNormal.clone().applyQuaternion(rotation).applyQuaternion(baseCamera);
    const azimuth = Math.atan2(direction.y,direction.x);
    const z = MathUtils.clamp(direction.z,-0.997,0.997);
    const horizontal = Math.sqrt(1-z*z);
    direction.set(horizontal*Math.cos(azimuth),horizontal*Math.sin(azimuth),z);
    const radius = camera.position.distanceTo(target);
    if (mode === 'look') target.copy(camera.position).addScaledVector(direction,-radius);
    else camera.position.copy(target).addScaledVector(direction,radius);
    camera.up.set(0,0,1);
    camera.lookAt(target);
    update();
    if (filtered.angleTo(latest) > 0.0005) frame = requestAnimationFrame(draw);
  }
  function sample(event) {
    const angle = window.screen.orientation?.angle ?? window.orientation ?? 0;
    const pose = screenPose(event,angle);
    if (!pose) return;
    clearTimeout(timer);
    if (touching()) { recenter(); return; }
    if (!reference || lastAngle !== angle) {
      reference = pose;
      baseCamera = camera.quaternion.clone();
      filtered = pose.clone();
      latest = null;
      lastAngle = angle;
      status('active');
      return;
    }
    latest = pose;
    if (!frame && filtered.angleTo(latest) > 0.0005) frame = requestAnimationFrame(draw);
  }
  function listen() {
    detach();
    if (document.hidden) { status('paused'); return; }
    listening = true;
    status('waiting');
    window.addEventListener('deviceorientation',sample);
    timer = setTimeout(()=>stop('silent'),3500);
  }
  async function start() {
    const token = ++generation;
    const api = window.DeviceOrientationEvent;
    if (!window.isSecureContext || !api) { stop('unsupported'); return; }
    status('requesting');
    try {
      if (typeof api.requestPermission === 'function') {
        const answer = await api.requestPermission();
        if (token !== generation) return;
        if (answer !== 'granted') { stop('denied'); return; }
      }
      requested = true;
      listen();
    } catch { if (token === generation) stop('denied'); }
  }
  document.addEventListener('visibilitychange', () => {
    if (!requested) return;
    if (document.hidden) { detach(); status('paused'); }
    else listen();
  });
  window.addEventListener('pagehide',()=>stop());
  return {start,stop,recenter,setMode(value){mode=value;recenter();},isListening:()=>listening};
}
