// 4.8, diffused light (Dan's request Nov 20: a new design language, the background a very slow moving diffused light
// gradient). One WebGL shader behind everything, calm on purpose:
//  - the field: a deep green gradient, lighter at the top
//  - light: four very wide, soft pools of light (mint, teal, a warm lime-gold and a cool sky) drifting on long, slow paths
//    (one lap takes one and a half to three minutes), blended in so they diffuse into each other with no edges; a soft
//    glow from the top keeps the upper screen lit
// No curtains, beams, stripes or noise: just light moving slowly through colour. A mood per page shifts the colours a
// little and crossfades over a few seconds; a tab change no longer surges. The pointer leans on it a touch on desktop.
// The colour at the top of the screen is read back twice a second into --aurora-top: <html>'s background, the sky's own
// background colour (iPhone Safari tints its bar from a fixed element at the top) and the theme colour.
// Costs: drawn at about a third of the screen's resolution (the light is soft, so nobody sees it), at most 24 fps (the
// motion is slow, so more frames buy nothing), paused while the tab is hidden, an overlay locks the page or the headline
// desk is open. Reduced motion or Save-Data draw one still frame.

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision mediump float;
uniform vec2 uRes;uniform float uT;uniform vec2 uPtr;uniform float uScroll;
uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;
uniform vec3 uTop;uniform vec3 uBot;uniform float uAmt;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float pool(vec2 p,vec2 c,float s){vec2 d=p-c;return exp(-dot(d,d)*s);}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;
  vec2 p=vec2(uv.x*asp,uv.y+uScroll)+uPtr*.04;
  float t=uT;
  /* the field: deep at the foot, a touch lighter at the top */
  vec3 c=mix(uBot,uTop,smoothstep(-.1,1.1,uv.y));
  /* four wide pools of light on slow paths: periods of about 90 to 180 seconds */
  float a0=pool(p,vec2((.22+.2*sin(t*.041))*asp,.78+.12*cos(t*.035)),1.6);
  float a1=pool(p,vec2((.8+.16*cos(t*.033+1.))*asp,.5+.2*sin(t*.045+2.)),1.9);
  float a2=pool(p,vec2((.5+.3*sin(t*.027+4.))*asp,.16+.12*cos(t*.038)),1.4);
  float a3=pool(p,vec2((.3+.24*cos(t*.049+3.))*asp,.42+.18*sin(t*.03+1.)),2.2);
  /* screened on, so where they meet they diffuse into a brighter light rather than a muddy mix */
  vec3 L=uC0*a0*.75+uC1*a1*.6+uC2*a2*.5+uC3*a3*.45;
  /* a soft glow from the top keeps the upper screen lit */
  L+=mix(uC0,uC3,.5)*pow(uv.y,3.)*.18;
  c=1.-(1.-c)*(1.-clamp(L*uAmt,0.,1.));
  /* dither, so the gradient never bands */
  c+=(h(gl_FragCoord.xy+fract(t))-.5)/96.;
  gl_FragColor=vec4(c,1.);
}`;

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
// the moods: four lights (mint, teal, warm, cool) shifted a little per page, and the pace
const MOODS = {
  rankings: { c: ['#5FD39A', '#3FB7A8', '#C9E27A', '#7CC8E8'], speed: 1 },
  live: { c: ['#7EDC8A', '#3FC4A0', '#F2D477', '#8FD6C8'], speed: 1.25 },
  wire: { c: ['#58D0B4', '#3AA8C8', '#B8E6A0', '#86C4F0'], speed: 1 },
  matchups: { c: ['#5FD39A', '#5AA8E0', '#EBCB78', '#7CC8E8'], speed: 1 },
  lab: { c: ['#7AD8A0', '#48BFA8', '#D2E68A', '#A0D8E0'], speed: 0.9 },
};
// the themes: the field's top and bottom and how strong the light is
const THEMES = {
  light: { top: '#0E5638', bot: '#042C1C', amt: 0.2 },
  dark: { top: '#0A2E1F', bot: '#020C07', amt: 0.26 },
};

export function initSilk() {
  const sky = document.querySelector('.sky');
  if (!sky) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'silk';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const k of ['uRes', 'uT', 'uPtr', 'uScroll', 'uC0', 'uC1', 'uC2', 'uC3', 'uTop', 'uBot', 'uAmt']) U[k] = gl.getUniformLocation(prog, k);

  sky.prepend(canvas);
  const root = document.documentElement;
  root.classList.add('silk-on');
  const meta = document.querySelector('meta[name="theme-color"]');

  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true;
  const small = () => matchMedia('(max-width: 760px)').matches;
  const theme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

  // a mood in a theme
  const target = (mood, th, live) => {
    const m = MOODS[mood] || MOODS.rankings, T = THEMES[th];
    return { c: m.c.map(hex), top: hex(T.top), bot: hex(T.bot), amt: T.amt, speed: m.speed * (live ? 1.2 : 1) };
  };
  const clone = (o) => ({ ...o, c: o.c.map((x) => [...x]), top: [...o.top], bot: [...o.bot] });
  let mood = 'rankings', live = false, t = Math.random() * 400, ptr = [0, 0], ptrGoal = [0, 0];
  let goal = target(mood, theme(), live);
  const cur = clone(goal);
  let raf = 0, last = 0, paused = false, lastRead = -1e9, lastTop = '';

  const size = () => {
    const scale = small() ? 0.4 : 0.34;
    const w = Math.max(1, Math.round(canvas.clientWidth || innerWidth) * scale), hgt = Math.max(1, Math.round((canvas.clientHeight || innerHeight) * scale));
    if (canvas.width !== Math.round(w) || canvas.height !== Math.round(hgt)) { canvas.width = Math.round(w); canvas.height = Math.round(hgt); gl.viewport(0, 0, canvas.width, canvas.height); }
  };
  const setGoal = () => { goal = target(mood, theme(), live); };
  const ease = (a, b, k) => a + (b - a) * k;
  const easeV = (a, b, k) => a.forEach((v, j) => (a[j] = ease(v, b[j], k)));
  const px = new Uint8Array(4 * 8);
  // the colour along the top of the screen goes to <html> and the theme colour, so the status bar is the aurora
  const readTop = () => {
    const y = canvas.height - 1 - Math.round(((sky.getBoundingClientRect().top * -1) / Math.max(1, canvas.clientHeight)) * canvas.height);
    const step = Math.max(1, Math.floor(canvas.width / 8));
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < 8; i++) { gl.readPixels(Math.min(canvas.width - 1, i * step), Math.max(0, y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); r += px[0]; g += px[1]; b += px[2]; }
    const c = `#${[r, g, b].map((v) => Math.round(v / 8).toString(16).padStart(2, '0')).join('')}`;
    if (c === lastTop) return;
    lastTop = c;
    root.style.setProperty('--aurora-top', c);
    meta?.setAttribute('content', c);
  };
  const draw = (now = performance.now()) => {
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uT, t);
    gl.uniform2f(U.uPtr, ptr[0], ptr[1]);
    gl.uniform1f(U.uScroll, (scrollY / Math.max(1, innerHeight)) * 0.03);
    cur.c.forEach((c, i) => gl.uniform3fv(U[`uC${i}`], c));
    gl.uniform3fv(U.uTop, cur.top);
    gl.uniform3fv(U.uBot, cur.bot);
    gl.uniform1f(U.uAmt, cur.amt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (now - lastRead > 500) { lastRead = now; readTop(); }
  };
  const step = (now) => {
    raf = 0;
    if (paused) return;
    const gap = 1000 / 24;
    if (now - last < gap - 2) { raf = requestAnimationFrame(step); return; }
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    const k = 1 - Math.exp(-dt * 0.7); // a mood crossfades over three or four seconds
    cur.c.forEach((c, i) => easeV(c, goal.c[i], k));
    easeV(cur.top, goal.top, k * 2); easeV(cur.bot, goal.bot, k * 2);
    cur.amt = ease(cur.amt, goal.amt, k * 2);
    cur.speed = ease(cur.speed, goal.speed, k);
    ptr = [ease(ptr[0], ptrGoal[0], 1 - Math.exp(-dt * 0.8)), ease(ptr[1], ptrGoal[1], 1 - Math.exp(-dt * 0.8))];
    t += dt * cur.speed;
    draw(now);
    raf = requestAnimationFrame(step);
  };
  const run = () => {
    const stop = document.hidden || root.classList.contains('locked') || root.classList.contains('admin-mode');
    if (still() || stop) {
      paused = true;
      cancelAnimationFrame(raf); raf = 0;
      if (still() && !stop) { Object.assign(cur, clone(goal)); lastRead = -1e9; draw(); } // one settled frame for the mood
      return;
    }
    paused = false;
    if (!raf) { last = 0; raf = requestAnimationFrame(step); }
  };

  let w0 = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== w0) { w0 = innerWidth; size(); if (paused) draw(); } }, { passive: true });
  document.addEventListener('visibilitychange', run);
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') ptrGoal = [e.clientX / innerWidth - 0.5, 0.5 - e.clientY / innerHeight]; }, { passive: true });
  // the theme switch, the page lock and the desk all show up as changes on <html>
  new MutationObserver(() => { setGoal(); lastRead = -1e9; run(); }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); paused = true; root.classList.remove('silk-on'); root.style.removeProperty('--aurora-top'); canvas.remove(); });

  size();
  draw();
  run();

  return {
    // route() calls this on every page change: the new page's mood and whether games are on
    mood(view, opts = {}) {
      mood = MOODS[view] ? view : mood;
      live = !!opts.live;
      setGoal();
      run();
    },
  };
}
