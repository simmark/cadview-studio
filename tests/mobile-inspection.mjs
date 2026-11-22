import assert from 'node:assert/strict';
import {basename} from 'node:path';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin = process.env.CADVIEW_URL || 'http://127.0.0.1:8765/';
const browser = await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
  const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(origin).origin});
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror',err=>errors.push(String(err)));
  context.on('request',req=>requests.push([req.method(),req.url()]));
  await page.addInitScript(()=>{
    window.permissionCalls = 0;
    Object.defineProperty(window.DeviceOrientationEvent,'requestPermission',{configurable:true,value:async()=>{
      window.permissionCalls++;
      return window.denyGyro ? 'denied' : 'granted';
    }});
  });
  await page.goto(origin);
  await page.waitForFunction(()=>document.querySelector('#fileName').textContent.includes('Demo'));
  const el = id=>page.locator('#'+id);
  const click = id=>el(id).click();
  const diag = async()=>{
    // Read the product's diagnostic snapshot without opening a modal over the gesture under test.
    return page.evaluate(async()=>{
      await navigator.clipboard.writeText('');
      document.getElementById('inputDiagnosticsButton').click();
      for(let i=0;i<40;i++){
        const value=await navigator.clipboard.readText();
        if(value)return JSON.parse(value);
        await new Promise(r=>setTimeout(r,25));
      }
      throw Error('Missing diagnostics');
    });
  };
  const box = async()=>el('cadInteractionLayer').boundingBox();
  const radius = d => Math.hypot(...d.camera.map((x,i)=>x-d.target[i]));
  const cdp = await context.newCDPSession(page);
  const gesture = (type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y}))});
  const tilt = (beta,alpha=0)=>page.evaluate(([b,a])=>{
    dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:a,beta:b,gamma:0}));
  },[beta,alpha]);

  for(const [width,height] of [[360,800],[430,932],[844,390],[820,1180],[390,844]]){
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>document.body.classList.contains('inspection'));
    assert.equal(await el('rightSidebar').isVisible(),false);
    assert.equal(await el('leftSidebar').isVisible(),false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const area=await box();
    assert.ok(area.width>=width-2 && area.height>height*.6,'Free stage at '+width);
    assert.ok((await el('mobileFullscreen').boundingBox()).height>=44);
  }
  await click('mobileTree');
  await click('touchMulti');
  const rows=page.locator('#assemblyTree .tree-name');
  await rows.nth(1).click();
  await rows.nth(2).click();
  assert.equal(await page.locator('#assemblyTree .selected').count(),2);
  await click('isolateButton');
  assert.ok(await page.locator('#assemblyTree .dimmed').count()>0);
  await click('touchUndo');
  assert.equal(await page.locator('#assemblyTree .dimmed').count(),0);
  await click('touchHide');
  assert.ok(await page.locator('#assemblyTree .dimmed').count()>0);
  await click('showAllButton');
  await click('touchMulti');
  await click('closeLeft');
  console.log('PASS layouts, multi-select, isolate, hide, undo and show all');

  const area=await box(), x=Math.round(area.x+area.width*.5),y=Math.round(area.y+area.height*.5);
  await click('mobileProperties'); await click('touchFit'); 
  await click('mobileProperties'); await click('touchMeasure');
  const before=await diag();
  await gesture('touchStart',[[1,x,y]]);
  await gesture('touchMove',[[1,x+65,y+20]]);
  await gesture('touchMove',[[1,x,y]]);
  await gesture('touchEnd',[]);
  const drag=await diag();
  assert.ok(drag.events.orbits>before.events.orbits);
  assert.equal(drag.pendingMeasurePoints,0);
  assert.equal(await page.locator('.measurement-entry').count(),0);
  await click('mobileProperties'); await click('touchMeasure');
  await el('languageSelect').selectOption('en');
  assert.equal(await el('mobileProperties').innerText(),'Tools');
  await click('mobileProperties'); await click('touchTheme'); await click('closeRight');
  assert.equal(await page.evaluate(()=>window.permissionCalls),0);

  // Browser-native fullscreen and browser-driven exit.
  await click('mobileFullscreen');
  await page.waitForFunction(()=>Boolean(document.fullscreenElement));
  await page.evaluate(()=>document.exitFullscreen());
  await page.waitForFunction(()=>!document.body.classList.contains('immersive'));
  // Deny native fullscreen to exercise the CSS route in the same browser.
  await page.evaluate(()=>{document.documentElement.requestFullscreen=()=>Promise.reject(new Error('unavailable'));});
  await click('mobileFullscreen');
  assert.equal(await el('exitInspection').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.fullscreenElement),null);
  const baseline=await diag();
  await click('gyroToggle'); await tilt(45);
  assert.equal(await el('gyroStatus').innerText(),'Gyro active');
  assert.deepEqual((await diag()).camera,baseline.camera);
  await tilt(60); await page.waitForTimeout(550);
  const rotated=await diag();
  assert.notDeepEqual(rotated.camera,baseline.camera);
  assert.ok(Math.abs(radius(rotated)-radius(baseline))<0.02);
  assert.deepEqual(rotated.target,baseline.target);
  await click('gyroCenter');
  const recentered=await diag(); await tilt(80);
  assert.deepEqual((await diag()).camera,recentered.camera);

  const g=await box(), cx=Math.round(g.x+g.width/2), cy=Math.round(g.y+g.height/2);
  await gesture('touchStart',[[1,cx-35,cy],[2,cx+35,cy]]);
  await gesture('touchMove',[[1,cx-65,cy+17],[2,cx+65,cy+17]]);
  await gesture('touchEnd',[]);
  const zoomed=await diag();
  assert.ok(radius(zoomed)<radius(recentered)*.8);
  assert.notDeepEqual(zoomed.target,recentered.target);
  assert.equal(await el('gyroToggle').getAttribute('aria-pressed'),'true');
  await tilt(82); assert.deepEqual((await diag()).camera,zoomed.camera);
  await page.setViewportSize({width:844,height:390});
  await click('exitInspection');
  assert.deepEqual((await diag()).camera,zoomed.camera);
  console.log('PASS measure drag, native/CSS fullscreen, gyro calibration, tilt, recenter, pinch/pan and exit');

  await click('mobileFullscreen');
  await page.evaluate(()=>window.denyGyro=true);
  await click('gyroToggle');
  assert.equal(await el('gyroStatus').innerText(),'Permission denied · touch available');
  await page.evaluate(()=>window.denyGyro=false);
  await click('gyroToggle');
  await page.waitForFunction(()=>document.querySelector('#gyroStatus').textContent==='No sensor data · touch available');
  await click('exitInspection');
  console.log('PASS denied permission and silent sensor');

  if(process.env.CADVIEW_STEP){
    const file=process.env.CADVIEW_STEP;
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    async function importStep(){
      await el('fileInput').setInputFiles(file);
      await page.waitForFunction(name=>document.querySelector('#fileName').textContent===name,basename(file));
      const n=Number(await el('partCount').textContent());
      assert.ok(n>1);
      assert.ok((await diag()).renderTriangles>0);
      return n;
    }
    const count=await importStep();
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#fileName').textContent.includes('Demo'));
    assert.equal(await importStep(),count);
    await page.setViewportSize({width:390,height:844});
    await click('exportButton');
    const glb=page.waitForEvent('download');
    await page.locator('[data-export="glb"]').click();
    const glbBytes=await readFile(await (await glb).path());
    assert.equal(glbBytes.toString('ascii',0,4),'glTF');
    await click('mobileProperties');
    const png=page.waitForEvent('download'); await click('touchPng');
    assert.equal((await readFile(await (await png).path())).toString('hex',0,8),'89504e470d0a1a0a');
    console.log('PASS local STEP, warm offline reload and reimport, GLB and PNG downloads:',count,'parts');
  }
  assert.deepEqual(requests.filter(([method,url])=>method!=='GET'||(/^https?:/.test(url)&&new URL(url).origin!==new URL(origin).origin)),[]);
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
