import sys, asyncio
from playwright.async_api import async_playwright

BASE = 'http://localhost:8765/index.html?demo=1'
OUT = '/tmp/claude-0/shots'

async def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    views = sys.argv[1:] or ['rankings']
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        for spec in views:
            name, _, size = spec.partition('@')
            w, h = (390, 844) if size == 'mobile' else (1366, 900)
            pg = await b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
            errs = []
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errs.append(str(e)))
            hash_, _, action = name.partition(':')
            await pg.goto(BASE + '#' + hash_)
            await pg.wait_for_timeout(1500)
            if action == 'open':
                await pg.evaluate("localStorage.setItem('ph-my-team','6')")
                await pg.reload(); await pg.wait_for_timeout(1500)
                await pg.click('.rank[data-rid="6"] .rank-btn')
                await pg.wait_for_timeout(700)
                await pg.evaluate("document.querySelector('.rank[data-rid=\"6\"]').scrollIntoView()")
                await pg.wait_for_timeout(300)
            full = action == 'full'
            path = f"{OUT}/{name.replace(':','_')}{'_m' if size=='mobile' else ''}.png"
            await pg.screenshot(path=path, full_page=full)
            print(path, 'errors:', [e for e in errs if 'sleepercdn' not in e and 'fonts.' not in e and 'ERR_' not in e][:5])
        await b.close()

asyncio.run(main())
