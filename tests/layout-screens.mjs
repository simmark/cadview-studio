import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const directory = process.argv[2] || 'artifacts/layout';
await mkdir(directory, {recursive: true});
const browser = await chromium.launch({args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']});
try {
  for (const [name, width, height] of [
    ['desktop',1600,940], ['portrait',390,844], ['landscape',844,390], ['tablet',820,1180]
  ]) {
    const context = await browser.newContext({viewport:{width,height}, hasTouch:name !== 'desktop', isMobile:name !== 'desktop'});
    const page = await context.newPage();
    await page.goto(process.env.CADVIEW_URL || 'http://127.0.0.1:8765/');
    await page.waitForFunction(() => document.querySelector('#fileName')?.textContent.includes('Demo'));
    await page.screenshot({path: directory + '/' + name + '.png'});
    await context.close();
  }
} finally {
  await browser.close();
}
