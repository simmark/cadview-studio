/**
 * CADVIEW on-demand headless WebGL smoke test.
 * Run on GitHub Actions with a local static server and Playwright Chromium.
 * Deliberately uses built-in demo only — no confidential STEP files are uploaded.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.CADVIEW_URL || 'http://127.0.0.1:8765/';
const issues = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
});
try {
  const context = await browser.newContext({viewport:{width:1600,height:940}, deviceScaleFactor:1});
  await context.grantPermissions(['clipboard-read','clipboard-write'], {origin:new URL(origin).origin});
  const page = await context.newPage();
  page.on('pageerror',e => issues.push(String(e)));
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(() => document.querySelector('#fileName')?.textContent?.includes('Demo'),null,{timeout:60000});
  await page.waitForTimeout(1200);
  const getDiag = async () => {
    await page.locator('#inputDiagnosticsButton').click();
    const report = await page.evaluate(() => navigator.clipboard.readText());
    return JSON.parse(report);
  };
  const initial = await getDiag();
  assert.ok(initial.renderFrames > 0,'Renderer must have drawn at least one frame');
  assert.ok(initial.renderTriangles > 0,'Demo must render triangles');
  console.log('PASS: demo rendered',initial.renderFrames,initial.renderTriangles);
  assert.equal(initial.loopStarted,true,'Render loop not started');
  const tickStart=initial.animationTicks;
  await page.waitForTimeout(350);
  const idle=await getDiag();
  assert.ok(idle.animationTicks>tickStart,'Animation loop must advance even without any pointer input');
  assert.ok(idle.renderFrames>initial.renderFrames,'Canvas must repaint autonomously when idle');
  console.log('PASS: autonomous animation loop is alive',idle.animationTicks);

  const screenshot=()=>page.locator('#cadCanvas').screenshot();
  const area=await page.locator('#cadInteractionLayer').boundingBox();
  assert.ok(area?.width>100&&area?.height>100);
  const x=area.x+area.width*.5, y=area.y+area.height*.50;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+140,y+40,{steps:12});
  await page.mouse.up();
  const moved=await getDiag();
  assert.ok(moved.events.orbits>initial.events.orbits,'Orbit pointer events missing');
  assert.notDeepEqual(moved.camera,initial.camera,'Camera did not move');
  assert.ok(moved.renderFrames>initial.renderFrames,'Canvas not updated after drag');
  console.log('PASS: camera orbit and frame update');

  // Selection must be highlighted without any mouse orbit; H must hide immediately.
  const beforeSelection=await screenshot();
  await page.locator('#assemblyTree .tree-node').nth(1).click();
  const selectedName=await page.locator('#selectedName').innerText();
  assert.notEqual(selectedName,'Gesamtes Modell','Tree selection did not activate');
  await page.waitForTimeout(60);
  const afterSelection=await screenshot();
  assert.ok(!beforeSelection.equals(afterSelection),'Selection highlight not rendered after tree click');
  const beforeH=await getDiag();
  await page.keyboard.press('h');
  await page.waitForTimeout(60);
  const afterH=await getDiag();
  assert.ok(afterH.renderTriangles<beforeH.renderTriangles,'H shortcut must hide selected part immediately');
  await page.locator('#showAllButton').click();
  console.log('PASS: immediate selection highlight and H hide');

  await page.locator('#hideAllButton').click();
  const hidden=await getDiag();
  assert.equal(hidden.renderTriangles,0,'Hide all must immediately hide demo triangles');
  await page.locator('#showAllButton').click();
  const restored=await getDiag();
  assert.ok(restored.renderTriangles>0,'Show all must immediately restore demo geometry');
  console.log('PASS: hide/show without camera movement');

  const beforeExplode=await screenshot();
  await page.locator('#explodeRange').evaluate(el => {
    el.value='70';
    el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(100);
  const afterExplode=await screenshot();
  assert.ok(!beforeExplode.equals(afterExplode),'Explosion must change pixels without camera movement');
  await page.locator('#explodeRange').evaluate(el => {
    el.value='0';
    el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  console.log('PASS: live explosion');

  const beforeSection=await screenshot();
  await page.locator('#sectionButton').click();
  await page.locator('#sectionRange').evaluate(el => {
    el.value='70';
    el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(100);
  const afterSection=await screenshot();
  assert.ok(!beforeSection.equals(afterSection),'Clip plane must change pixels without camera movement');
  await page.locator('#sectionButton').click();
  console.log('PASS: live section plane');

  await page.locator('[data-panel="measure"]').click();
  const beforeDimensions=await screenshot();
  await page.locator('#measureBoundsButton').click();
  await page.waitForTimeout(100);
  const afterDimensions=await screenshot();
  assert.ok(!beforeDimensions.equals(afterDimensions),'Auto dimensions must become visible immediately');
  await page.locator('#toggleMeasurementVisibility').click();
  const afterHiddenDimensions=await screenshot();
  assert.ok(!afterDimensions.equals(afterHiddenDimensions),'Dimension visibility must redraw immediately');
  console.log('PASS: dimension toggle and redraw');

  // Dimension label and snap marker scale/contrast are live and independent.
  await page.locator('#toggleMeasurementVisibility').click();
  const labelBeforeSize=await screenshot();
  await page.locator('#measureLabelSize').evaluate(el=>{
    el.value='170';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal(await page.locator('#measureLabelSizeValue').innerText(),'170 %');
  const labelAfterSize=await screenshot();
  assert.ok(!labelBeforeSize.equals(labelAfterSize),'Dimension label size must update live');
  await page.locator('#measureSnapSize').evaluate(el=>{
    el.value='18';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal(await page.locator('#measureSnapSizeValue').innerText(),'18 px');
  const measuredStyle=await page.locator('#snapMarker').evaluate(el=>getComputedStyle(el).width);
  assert.equal(measuredStyle,'18px','Snap marker must follow chosen pixel size');
  const preferences=await page.evaluate(()=>JSON.parse(localStorage.getItem('cadview-measure-appearance-v1')));
  assert.equal(preferences.snapPx,18);
  assert.equal(preferences.labelPercent,170);
  console.log('PASS: scalable, persistent dimension labels and snap symbols');

  // In measurement mode: a left drag still rotates the camera, and must NOT place a point.
  await page.locator('#measureButton').click();
  const beforeMeasureOrbit=await getDiag();
  assert.equal(beforeMeasureOrbit.measuring,true,'Measure mode not enabled');
  const beforeCount=await page.locator('#measurementList .measurement-entry').count();
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+105,y+30,{steps:12});
  await page.mouse.up();
  const afterMeasureOrbit=await getDiag();
  const afterCount=await page.locator('#measurementList .measurement-entry').count();
  assert.ok(afterMeasureOrbit.events.orbits>beforeMeasureOrbit.events.orbits,
    'Left mouse drag must still orbit the camera in measurement mode');
  assert.equal(afterCount,beforeCount,'Drag released unexpectedly created a measurement');
  await page.locator('#measureButton').click();
  console.log('PASS: measure-mode left drag orbits without creating points');

  const exportButton=page.locator('#exportButton');
  await exportButton.click();
  const info=await page.locator('#exportMenu').evaluate(el => {
    const r=el.getBoundingClientRect();
    return {parent:el.parentElement?.tagName,position:getComputedStyle(el).position,
      z:getComputedStyle(el).zIndex,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
      hidden:el.classList.contains('hidden')};
  });
  assert.equal(info.parent,'BODY','Export menu must escape header stacking context');
  assert.equal(info.position,'fixed');
  assert.ok(info.left>=0&&info.right<=1600&&info.top>=0&&info.bottom<=940,'Export menu off-screen');
  assert.ok(!info.hidden);
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#exportMenu').evaluate(el=>el.classList.contains('hidden')));
  assert.equal((await page.locator('#helpButton').innerText()).trim(),'?');
  console.log('PASS: export portal and compact help control');

  assert.deepEqual(issues,[],'Uncaught browser errors occurred');
  console.log('PASS: CADVIEW browser smoke completed. Still run manual STEP and Edge PWA checklist.');
} finally {
  await browser.close();
}
