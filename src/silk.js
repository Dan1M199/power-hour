// 5.0, Aura (Dan's request Nov 20: copy the calm wellness dashboard he sent, its colours exactly). One WebGL shader
// behind everything, a soft morning haze rather than an aurora:
//  - the sky: cool pearl blue-grey at the top of the screen, a warm linen through the middle, sand at the foot
//  - the sunrise: a wide golden glow low on the right, breathing and drifting very slowly, with a peach halo around it
//  - haze: three soft pools (a cool one up top, cream, and a pale gold) on slow domain-warped paths, so the light never
//    sits still but never draws the eye either
//  - a pale bloom of daylight from the top, and a whisper of grain so the gradient never bands
// It has a mood per page (the pools' colours and pace), crossfades on a tab change, leans toward the pointer and slides
// with the scroll. The colour at the top of the screen is read back twice a second into --aurora-top (the status bar).
// Costs: drawn at about a third of the screen's resolution, at most 30 fps on phones and 45 elsewhere, paused while the tab
// is hidden, an overlay locks the page or the headline desk is open. Reduced motion or Save-Data draw one still frame.

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision mediump float;
uniform vec2 uRes;uniform float uT;uniform vec2 uPtr;uniform float uScroll;
uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;uniform vec3 uWarm;uniform vec3 uRose;
uniform vec3 uTop;uniform vec3 uBot;uniform float uPool;uniform float uGlow;uniform float uDrift;uniform float uFlood;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float pool(vec2 p,vec2 c,float s){vec2 d=p-c;return exp(-dot(d,d)*s);}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;
  vec2 p=vec2(uv.x*asp,uv.y+uScroll)+uPtr*.04;
  float t=uT;
  /* the sky: pearl above, linen through the middle (c1), sand below */
  float y=uv.y;
  vec3 c=mix(uBot,uC1,smoothstep(.0,.55,y));
  c=mix(c,uTop,smoothstep(.45,1.,y));
  /* a slow warp, so the haze breathes */
  vec2 w=vec2(fbm(p*1.1+vec2(t*.05*uDrift,t*.03)),fbm(p*1.1+vec2(5.2,1.3)-t*.04))-.5;
  vec2 q=p+w*.5;
  /* haze pools: cool up top (c0), cream (c3), pale gold (c2), each on a lap of a minute or more */
  float a0=pool(q,vec2((.22+.2*sin(t*.07))*asp,.86+.08*cos(t*.06)),3.);
  float a3=pool(q,vec2((.55+.25*cos(t*.05+2.))*asp,.55+.12*sin(t*.08)),3.6);
  float a2=pool(q,vec2((.2+.22*sin(t*.06+4.))*asp,.12+.1*sin(t*.07)),3.2);
  c=mix(c,uC0,a0*uPool*.75);
  c=mix(c,uC3,a3*uPool*.45);
  c=mix(c,uC2,a2*uPool*.55);
  /* the sunrise: a wide golden glow low on the right, a peach halo round it, breathing */
  vec2 sp=vec2((.8+.06*sin(t*.045))*asp,.1+.05*sin(t*.06));
  float br=1.+.08*sin(t*.23);
  float sun=pool(q,sp,1.6/br);
  float core=pool(p,sp+vec2(.02,.06),7.);
  c=mix(c,uRose,sun*uGlow*.55);
  c=1.-(1.-c)*(1.-uWarm*(sun*.38+core*.42)*uGlow);
  /* daylight from the top */
  c=1.-(1.-c)*(1.-vec3(1.,.99,.97)*pool(vec2(uv.x*asp,uv.y),vec2(.5*asp,1.18),1.4)*uFlood);
  c+=(h(gl_FragCoord.xy+fract(t))-.5)/120.;
  gl_FragColor=vec4(c,1.);
}`;

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
// the moods: c0 the cool haze up top, c1 the linen middle, c2 the pale gold pool low left, c3 the cream pool, warm the
// sun's light, rose its peach halo, then pace and drift. Each page leans a little: the rankings a plain morning, Live
// warmer and quicker, the Wire cooler, Games peach, the Lab a lilac pearl
const MOODS = {
  rankings: { c: ['#C7D0DC', '#DFDDD8', '#EFDDB5', '#F1ECE3'], warm: '#F6C978', rose: '#EFC08C', speed: 1, drift: 1 },
  live: { c: ['#CDD2D9', '#E3DCD0', '#F2D9A6', '#F4EADA'], warm: '#F8C468', rose: '#F0B880', speed: 1.5, drift: 1.3 },
  wire: { c: ['#C2CEDC', '#DCDEDF', '#E9DCC0', '#EEF0F0'], warm: '#F2CE8C', rose: '#E8C9A6', speed: 1.1, drift: 1.8 },
  matchups: { c: ['#CAD0DA', '#E1DBD3', '#F0D8B4', '#F3E9DE'], warm: '#F6C37A', rose: '#F0B394', speed: 1.1, drift: -1 },
  lab: { c: ['#CCCCDA', '#DEDBDB', '#EBDDC0', '#EFEAE6'], warm: '#F2CC88', rose: '#E8C0B0', speed: 0.85, drift: 0.6 },
};
// the themes: the sky's top and foot, how much the pools show, the sun's strength, the daylight, and how far the moods'
// colours sink (night: the same room with the lights down, warm charcoal with an amber glow low on the right)
const THEMES = {
  light: { top: '#CBD2DC', bot: '#E6D2A8', pool: 1, glow: 0.85, flood: 0.35, dim: 1 },
  dark: { top: '#1B1C1F', bot: '#2A2219', pool: 0.9, glow: 0.7, flood: 0.04, dim: 0.16 },
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
  for (const k of ['uRes', 'uT', 'uPtr', 'uScroll', 'uC0', 'uC1', 'uC2', 'uC3', 'uWarm', 'uRose', 'uTop', 'uBot', 'uPool', 'uGlow', 'uDrift', 'uFlood']) U[k] = gl.getUniformLocation(prog, k);

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
    const dim = (c) => hex(c).map((v) => v * T.dim);
    // at night the haze sinks into the dark and the sun burns low
    return { c: m.c.map((c) => dim(c)), warm: hex(m.warm).map((v) => v * (th === 'dark' ? 0.42 : 1)), rose: hex(m.rose).map((v) => v * (th === 'dark' ? 0.34 : 1)), top: hex(T.top), bot: hex(T.bot), pool: T.pool, glow: T.glow, flood: T.flood,
      speed: m.speed * (live ? 1.5 : 1), drift: m.drift };
  };
  const clone = (o) => ({ ...o, c: o.c.map((x) => [...x]), warm: [...o.warm], rose: [...o.rose], top: [...o.top], bot: [...o.bot] });
  let mood = 'rankings', live = false, surge = 0, t = Math.random() * 60, ptr = [0, 0], ptrGoal = [0, 0];
  let goal = target(mood, theme(), live);
  const cur = clone(goal);
  let raf = 0, last = 0, paused = false, lastRead = -1e9, lastTop = '';

  const size = () => {
    const scale = small() ? 0.34 : 0.28; // the haze is soft, so it can be drawn smaller
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
    gl.uniform1f(U.uScroll, (scrollY / Math.max(1, innerHeight)) * 0.06);
    cur.c.forEach((c, i) => gl.uniform3fv(U[`uC${i}`], c));
    gl.uniform3fv(U.uWarm, cur.warm);
    gl.uniform3fv(U.uRose, cur.rose);
    gl.uniform3fv(U.uTop, cur.top);
    gl.uniform3fv(U.uBot, cur.bot);
    gl.uniform1f(U.uPool, cur.pool);
    gl.uniform1f(U.uGlow, cur.glow);
    gl.uniform1f(U.uDrift, cur.drift);
    gl.uniform1f(U.uFlood, cur.flood);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (now - lastRead > 500) { lastRead = now; readTop(); }
  };
  const step = (now) => {
    raf = 0;
    if (paused) return;
    const gap = small() ? 1000 / 30 : 1000 / 45;
    if (now - last < gap - 2) { raf = requestAnimationFrame(step); return; }
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    const k = 1 - Math.exp(-dt * 2.2); // colours settle in about a second and a half
    cur.c.forEach((c, i) => easeV(c, goal.c[i], k));
    easeV(cur.warm, goal.warm, k); easeV(cur.rose, goal.rose, k);
    easeV(cur.top, goal.top, k * 2); easeV(cur.bot, goal.bot, k * 2);
    cur.pool = ease(cur.pool, goal.pool, k * 2);
    cur.glow = ease(cur.glow, goal.glow, k * 2);
    cur.flood = ease(cur.flood, goal.flood, k * 2);
    cur.speed = ease(cur.speed, goal.speed, k);
    cur.drift = ease(cur.drift, goal.drift, k);
    surge *= Math.exp(-dt * 2.4);
    ptr = [ease(ptr[0], ptrGoal[0], 1 - Math.exp(-dt * 1.5)), ease(ptr[1], ptrGoal[1], 1 - Math.exp(-dt * 1.5))];
    t += dt * (cur.speed + surge * 6);
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
    // route() calls this on every page change: the new page's mood, whether games are on, and a surge if the tab changed
    mood(view, opts = {}) {
      const next = MOODS[view] ? view : mood;
      if (next !== mood && !still()) surge = 1;
      mood = next;
      live = !!opts.live;
      setGoal();
      run();
    },
  };
}
