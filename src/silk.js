// 4.4, the aurora (Dan's request Nov 19: back to aurora glass, flowing, a lot of diffused light, green with
// complementary colours, luxurious). One WebGL shader behind everything, drawn in three layers of light:
//  - the sky: a pearl-to-emerald wash, lit from the top
//  - pools: five wide, soft clouds of colour (emerald, jade, deep teal, mint, and a breath of rose gold, green's
//    complement) on domain-warped paths, so they swell, merge and part like light through frosted glass
//  - curtains: two aurora ribbons of champagne and mint light rolling across the upper half, with soft rays, screened on
//    so they only ever add light
// Everything is a wide gaussian; nothing draws a line. It has a mood per page, all in the same family:
//  - rankings: emerald, jade and champagne, the trophy table
//  - live: warmer, more gold, and it flows faster while games are on
//  - wire: cooler, teal and aqua, drifting sideways
//  - matchups: emerald and sky with gold, the two sides of every game
//  - lab: sage and mint, the greenhouse
// Switching tabs crossfades the mood and sends a surge through it (it speeds up and settles), on the same beat as the
// tab pill's glide. The pointer leans on it a little, scrolling slides it like a slow parallax.
// The colour at the top of the screen is read back now and then and handed to <html>'s background and the theme
// colour, so the phone's status bar and the overscroll are the aurora itself, edge to edge.
// Costs: drawn at a fraction of the screen's resolution (it is all soft, so nobody sees it), at most 30 frames a second
// on phones and 45 elsewhere, paused while the tab is hidden, an overlay locks the page or the headline desk is open.
// Reduced motion or Save-Data draws one still frame per mood. Without WebGL the CSS aurora stays.

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision mediump float;
uniform vec2 uRes;uniform float uT;uniform vec2 uPtr;uniform float uScroll;
uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;uniform vec3 uWarm;uniform vec3 uRose;
uniform vec3 uTop;uniform vec3 uBot;uniform float uPool;uniform float uGlow;uniform float uDrift;uniform float uNight;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float pool(vec2 p,vec2 c,float s){vec2 d=p-c;return exp(-dot(d,d)*s);}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;
  vec2 p=vec2(uv.x*asp,uv.y+uScroll)+uPtr*.05;
  float t=uT;
  /* the sky: lit from the top */
  vec3 c=mix(uBot,uTop,smoothstep(.0,1.,uv.y));
  /* a slow warp, so the pools bend and merge instead of sliding as circles */
  vec2 w=vec2(fbm(p*1.2+vec2(t*.035*uDrift,t*.02)),fbm(p*1.2+vec2(5.2,1.3)-t*.03))-.5;
  vec2 q=p+w*.55;
  /* the pools of colour, on long lissajous paths */
  float a0=pool(q,vec2((.16+.14*sin(t*.07))*asp,.26+.16*cos(t*.05)),4.6);
  float a1=pool(q,vec2((.84+.12*cos(t*.06))*asp,.60+.16*sin(t*.08+1.)),4.2);
  float a2=pool(q,vec2((.52+.30*sin(t*.04+2.))*asp,.02+.10*sin(t*.06)),3.6);
  float a3=pool(q,vec2((.30+.22*cos(t*.05+4.))*asp,.84+.08*sin(t*.09)),5.4);
  float a4=pool(q,vec2((.68+.20*sin(t*.045+3.))*asp,.30+.14*cos(t*.07+2.)),7.);
  float a5=pool(q,vec2((.05+.10*cos(t*.05+1.))*asp,.62+.12*sin(t*.06+3.)),5.);
  c=mix(c,uC2,a2*uPool*.9);
  c=mix(c,uC0,a0*uPool);
  c=mix(c,uC1,a1*uPool*.9);
  c=mix(c,uC3,a3*uPool*.85);
  c=mix(c,uWarm*(1.-.62*uNight),a5*uPool*.42);
  c=mix(c,uRose,a4*uPool*.3);
  c=1.-(1.-c)*(1.-uRose*a4*uPool*.32);
  /* jewel tones: the mixed colour pushed away from its own grey, so overlaps glow instead of going muddy */
  float g=dot(c,vec3(.299,.587,.114));c=clamp(mix(vec3(g),c,1.38),0.,1.);
  /* the curtains: two ribbons of light rolling across the upper half, soft below, softer above, with slow rays */
  float x=p.x;
  float y1=.66+.09*sin(x*1.1+t*.11)+.16*(fbm(vec2(x*.8+t*.045,t*.03))-.5);
  float y2=.44+.08*sin(x*1.6-t*.09+2.)+.14*(fbm(vec2(x*.7-t*.04,9.+t*.025))-.5);
  float d1=q.y-y1,d2=q.y-y2;
  float r1=.6+.4*fbm(vec2(x*2.6+t*.05,q.y*.9-t*.04));
  float r2=.6+.4*fbm(vec2(x*2.2-t*.05,q.y*.8+t*.035+4.));
  float k1=exp(-d1*d1/(d1>0.?.05:.012))*r1;
  float k2=exp(-d2*d2/(d2>0.?.035:.01))*r2*.7;
  /* the light from above, swaying a little, and a soft glow where the pools are brightest */
  float top=pow(uv.y,2.6)*.26+exp(-pow((uv.x-.5-.15*sin(t*.06))*1.5,2.))*pow(uv.y,3.)*.2;
  vec3 L=uWarm*k1*.42+mix(uC3,vec3(1.),.35)*k2*.5+vec3(1.,.97,.88)*top+vec3(1.)*(a0+a1+a3)*.05
    +vec3(1.,.99,.94)*(a1*a1*.32+a3*a3*.26)+uWarm*a5*a5*.3;
  /* ^ the cores: where a pool is thickest it turns to light, soft white at the jade and mint, gold at the warm one */
  /* at night the white light turns to the aurora's own green and the sky's glow drops away */
  L=mix(L,(L.r+L.g+L.b)/3.*mix(uC1,uC3,.5)*1.6,uNight*.75)*uGlow;
  c=1.-(1.-c)*(1.-clamp(L,0.,1.));
  /* depth: the corners fall away a touch, so the light reads as coming from inside */
  c*=1.-.09*smoothstep(.45,1.15,length((uv-vec2(.5,.62))*vec2(1.,1.3)));
  /* grain, a hair, so the soft gradients never band */
  c+=(h(gl_FragCoord.xy+fract(t))-.5)/96.;
  gl_FragColor=vec4(c,1.);
}`;

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
// the moods: four colours for the pools (c0 the big emerald, c1 and c3 the light ones, c2 the deep one), the warm light
// of the curtains, the rose-gold breath, how fast it moves and which way it drifts
const MOODS = {
  rankings: { c: ['#14B26A', '#2FCBAE', '#1FA39A', '#5DD68F'], warm: '#F5D676', rose: '#F6B1A6', speed: 1, drift: 1 },
  live: { c: ['#17B26A', '#8FD85A', '#1F9E7A', '#F4D35E'], warm: '#FFC94A', rose: '#F7B28C', speed: 1.9, drift: 1.4 },
  wire: { c: ['#12A884', '#38C9C2', '#1E8FAE', '#9EE6CF'], warm: '#E9E39A', rose: '#C9B8EE', speed: 1.25, drift: 2.4 },
  matchups: { c: ['#17B26A', '#5BBCEB', '#2A8FC4', '#C6EA7A'], warm: '#F7C94E', rose: '#F6B1A6', speed: 1.1, drift: -1 },
  lab: { c: ['#2BAA5E', '#74D49A', '#2A9C84', '#D2EA86'], warm: '#F1DB7A', rose: '#E8B8CC', speed: 0.85, drift: 0.6 },
};
// the themes: the sky's top and bottom, how much of each pool shows, how bright the light is
const THEMES = {
  light: { top: '#E4F4E8', bot: '#8FD0A4', pool: 1, glow: 0.7, dim: 1 },
  dark: { top: '#0A2419', bot: '#020C07', pool: 0.85, glow: 0.4, dim: 0.3 },
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
  for (const k of ['uRes', 'uT', 'uPtr', 'uScroll', 'uC0', 'uC1', 'uC2', 'uC3', 'uWarm', 'uRose', 'uTop', 'uBot', 'uPool', 'uGlow', 'uDrift', 'uNight']) U[k] = gl.getUniformLocation(prog, k);

  sky.prepend(canvas);
  const root = document.documentElement;
  root.classList.add('silk-on');
  const meta = document.querySelector('meta[name="theme-color"]');

  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true;
  const small = () => matchMedia('(max-width: 760px)').matches;
  const theme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

  // a mood in a theme: night dims the pools (the curtains stay lit, like a real aurora)
  const target = (mood, th, live) => {
    const m = MOODS[mood] || MOODS.rankings, T = THEMES[th];
    const dim = (c) => hex(c).map((v) => v * T.dim);
    return { c: m.c.map(dim), warm: hex(m.warm), rose: dim(m.rose), top: hex(T.top), bot: hex(T.bot), pool: T.pool, glow: T.glow, night: th === 'dark' ? 1 : 0,
      speed: m.speed * (live ? 1.5 : 1), drift: m.drift };
  };
  const clone = (o) => ({ ...o, c: o.c.map((x) => [...x]), warm: [...o.warm], rose: [...o.rose], top: [...o.top], bot: [...o.bot] });
  let mood = 'rankings', live = false, surge = 0, t = Math.random() * 60, ptr = [0, 0], ptrGoal = [0, 0];
  let goal = target(mood, theme(), live);
  const cur = clone(goal);
  let raf = 0, last = 0, paused = false, lastRead = -1e9;

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
    gl.uniform1f(U.uNight, cur.night);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (now - lastRead > 1500) { lastRead = now; readTop(); }
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
    cur.night = ease(cur.night, goal.night, k * 2);
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
