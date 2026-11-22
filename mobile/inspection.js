import {createGyro} from './gyro.js?v=m1';

const messages = {
  off:['Gyro aus','Gyro off'], requesting:['Freigabe ausstehend','Awaiting permission'],
  waiting:['Warte auf Sensor …','Waiting for sensor …'], active:['Gyro aktiv','Gyro active'],
  paused:['Gyro pausiert','Gyro paused'], denied:['Freigabe verweigert · Touch aktiv','Permission denied · touch available'],
  silent:['Keine Sensordaten · Touch aktiv','No sensor data · touch available'],
  unsupported:['Sensor nicht verfügbar · Touch aktiv','Sensor unavailable · touch available']
};

export function installInspection({camera,target,update,touch,closePanels}) {
  const byId = id => document.getElementById(id);
  const body = document.body;
  const compact = matchMedia('(max-width:760px), (pointer:coarse) and (max-width:1160px)');
  let immersive = false, entryButton, sensor = 'off', hasNative = false;
  function labels() {
    const english = byId('languageSelect').value === 'en';
    for (const item of document.querySelectorAll('[data-inspect-en]')) {
      item.textContent = english ? item.dataset.inspectEn : item.dataset.inspectDe;
    }
    byId('gyroStatus').textContent = messages[sensor][english ? 1 : 0];
    const enabled = ['active','waiting','requesting','paused'].includes(sensor);
    byId('gyroToggle').setAttribute('aria-pressed',String(enabled));
    byId('gyroCenter').disabled = sensor !== 'active';
  }
  const gyro = createGyro({camera,target,update,touching:touch.touching,status(value){
    sensor=value; labels();
  }});
  function layout() {
    body.classList.toggle('inspection',compact.matches || immersive);
    body.classList.toggle('immersive',immersive);
  }
  function leave(restoreHistory=true) {
    if (!immersive) return;
    immersive = false;
    gyro.stop();
    touch.reset();
    closePanels();
    layout();
    if (document.fullscreenElement === document.documentElement) document.exitFullscreen().catch(()=>{});
    entryButton?.focus();
    if (restoreHistory && history.state?.cadviewImmersive) history.back();
  }
  function enter(event) {
    entryButton = event.currentTarget;
    immersive = true;
    if (!history.state?.cadviewImmersive) history.pushState({...history.state,cadviewImmersive:true},'');
    closePanels();
    touch.reset();
    layout();
    byId('exitInspection').focus();
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(()=>{}); // CSS view already occupies the window.
    }
  }
  window.addEventListener('popstate',()=>{
    if (immersive && !history.state?.cadviewImmersive) leave(false);
  });
  // A reload/forward navigation may land on an old inspection entry.
  if (history.state?.cadviewImmersive) {
    const state = {...history.state};
    delete state.cadviewImmersive;
    history.replaceState(state,'');
  }
  document.addEventListener('fullscreenchange',()=>{
    if (hasNative && !document.fullscreenElement) leave();
    hasNative = document.fullscreenElement === document.documentElement;
    if (hasNative && !immersive) document.exitFullscreen().catch(()=>{});
  });
  byId('mobileFullscreen').addEventListener('click',enter);
  byId('desktopFullscreen').addEventListener('click',enter);
  byId('exitInspection').addEventListener('click',leave);
  byId('gyroToggle').addEventListener('click',()=>{
    if (byId('gyroToggle').getAttribute('aria-pressed') === 'true') gyro.stop();
    else gyro.start();
  });
  byId('gyroCenter').addEventListener('click',gyro.recenter);
  document.addEventListener('keydown',event=>{
    if (event.key !== 'Escape' || byId('helpDialog').open || !byId('exportMenu').classList.contains('hidden')) return;
    if (body.classList.contains('inspection') && document.querySelector('.sidebar.open')) {
      closePanels();
    } else if (immersive) leave();
    else return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
  compact.addEventListener('change',()=>{closePanels();layout();});
  byId('languageSelect').addEventListener('change',labels);
  layout();
  labels();
  return gyro;
}
