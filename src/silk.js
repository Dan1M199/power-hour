// 4.5, floodlit aurora (Dan's request Nov 20: the 4.4 sky barely moved and read as a pale mint wash; make it aurora
// glass again, lively, with personality, in an eye-catching green). One WebGL shader behind everything:
//  - the pitch: a vivid emerald (#14D77F, "floodlight green") falling to deep turf at the foot of the screen
//  - pools: four wide clouds of colour on domain-warped paths, plus a screened breath of rose (green's complement and
//    the site's --pop), so overlaps glow instead of going muddy
//  - curtains: three aurora ribbons hanging over the upper half, each with a crisp lower hem, a long glow rising off it
//    and streaming rays, their colour sliding lime to aqua along their length; they wave on a 10 to 20 second beat,
//    quick enough to see
//  - floodlights: two soft stadium beams from the top corners, sweeping slowly, the game-day touch
// It has a mood per page (the ribbons' colours and pace), crossfades on a tab change with a surge on the tab pill's beat,
// leans toward the pointer and slides with the scroll.
// The colour at the top of the screen is read back twice a second into --aurora-top: <html>'s background, the sky's own
// background colour (iPhone Safari tints its bar from a fixed element at the top) and the theme colour.
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
float beam(vec2 v,float ctr){float a=atan(v.x,-v.y);float d=(a-ctr)/.13;return exp(-d*d)*smoothstep(1.9,.1,length(v));}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;
  vec2 p=vec2(uv.x*asp,uv.y+uScroll)+uPtr*.06;
  float t=uT;
  /* the pitch: bright up top, deep turf at the foot */
  vec3 c=mix(uBot,uTop,smoothstep(.0,1.,uv.y));
  /* the warp, so everything bends and merges */
  vec2 w=vec2(fbm(p*1.3+vec2(t*.09*uDrift,t*.05)),fbm(p*1.3+vec2(5.2,1.3)-t*.07))-.5;
  vec2 q=p+w*.6;
  /* pools of colour on lissajous paths, about half a minute a lap */
  float a0=pool(q,vec2((.18+.26*sin(t*.16))*asp,.24+.18*cos(t*.13)),3.4);
  float a1=pool(q,vec2((.82+.18*cos(t*.14))*asp,.52+.22*sin(t*.17+1.)),4.2);
  float a2=pool(q,vec2((.5+.36*sin(t*.11+2.))*asp,.04+.12*sin(t*.15)),2.6);
  float a3=pool(q,vec2((.34+.3*cos(t*.12+4.))*asp,.86+.1*sin(t*.19)),4.6);
  c=mix(c,uC2,a2*uPool*.8);
  c=mix(c,uC0,a0*uPool*.7);
  c=mix(c,uC3,a3*uPool*.5);
  c=1.-(1.-c)*(1.-uRose*a1*a1*uPool*.22);
  /* the curtains */
  float x=q.x;vec3 L=vec3(0.);
  for(int i=0;i<3;i++){float fi=float(i);
    float y=.8-fi*.17+.07*sin(x*(2.2+fi*.7)+t*(.5-fi*.1)+fi*2.1)+.035*sin(x*(5.3-fi)-t*.7+fi)
      +.14*(fbm(vec2(x*1.1+t*.12+fi*3.7,t*.08+fi))-.5);
    float d=q.y-y;
    float band=d>0.?exp(-d/(.11+fi*.04)):exp(-d*d/.0016);
    float rays=pow(fbm(vec2(x*11.+t*.25*(fi+1.),q.y*.8-t*.3)),1.6)*2.2;
    vec3 col=mix(uC0,uC1,.5+.5*sin(x*1.6+t*.27+fi*1.9));
    col=mix(col,uC3,fi*.28);
    L+=col*band*(.25+rays)*(1.-fi*.22);
  }
  /* floodlights from the top corners, sweeping */
  vec2 f=vec2(uv.x*asp,uv.y);
  float fl=beam(f-vec2(-.04*asp,1.1),.55+.16*sin(t*.21))+beam(f-vec2(1.04*asp,1.1),-.55-.16*sin(t*.19+1.3));
  L+=uWarm*fl*uFlood;
  /* where a pool is thickest it turns to light */
  L+=vec3(1.,1.,.94)*(a0*a0*.14+a3*a3*.2);
  c=1.-(1.-c)*(1.-clamp(L*uGlow,0.,1.));
  /* jewel tones: pushed away from grey so the green rings out */
  float g=dot(c,vec3(.299,.587,.114));c=clamp(mix(vec3(g),c,1.35),0.,1.);
  /* depth: the corners fall away a touch */
  c*=1.-.12*smoothstep(.5,1.2,length((uv-vec2(.5,.6))*vec2(1.,1.25)));
  c+=(h(gl_FragCoord.xy+fract(t))-.5)/80.;
  gl_FragColor=vec4(c,1.);
}`;

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
// the moods: c0 and c1 are the ribbons' two ends (and c0 a pool), c2 the deep pool, c3 the high ribbon and a light pool,
// warm the floodlights, rose the complement's breath, then pace and drift
const MOODS = {
  rankings: { c: ['#A8F55A', '#3DE6C4', '#047A4C', '#8CF5B4'], warm: '#FFF1C2', rose: '#FF9CC8', speed: 1, drift: 1 },
  live: { c: ['#D2F54A', '#5CF08A', '#08804A', '#FFE066'], warm: '#FFE29A', rose: '#FFA98A', speed: 1.6, drift: 1.4 },
  wire: { c: ['#7DF5C8', '#38D6F0', '#056E66', '#B6F7E6'], warm: '#E8FBFF', rose: '#C7A8FF', speed: 1.15, drift: 2.2 },
  matchups: { c: ['#A8F55A', '#4FC8FF', '#05704E', '#FFE066'], warm: '#FFF1C2', rose: '#FF9CC8', speed: 1.1, drift: -1 },
  lab: { c: ['#B4F07A', '#5EE8B0', '#0A7A50', '#E2F59A'], warm: '#F6FFD8', rose: '#F2A8E0', speed: 0.85, drift: 0.6 },
};
// the themes: the pitch's top and bottom, how much the pools show, how bright the light is, the floodlights, and how much
// the pools dim (night keeps the ribbons vivid, like a real aurora, and sinks the rest)
const THEMES = {
  // 4.7 (Dan's request Nov 20): a deeper turf, so the cards and the words stand off it
  light: { top: '#0F6B3E', bot: '#02341F', pool: 0.62, glow: 0.34, flood: 0.16, dim: 0.66 },
  dark: { top: '#042818', bot: '#010805', pool: 0.6, glow: 0.5, flood: 0.1, dim: 0.26 },
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
    // at night the ribbons stay bright and everything else sinks into the dark
    return { c: m.c.map((c, i) => (i === 2 ? dim(c) : hex(c))), warm: hex(m.warm), rose: dim(m.rose), top: hex(T.top), bot: hex(T.bot), pool: T.pool, glow: T.glow, flood: T.flood,
      speed: m.speed * (live ? 1.5 : 1), drift: m.drift };
  };
  const clone = (o) => ({ ...o, c: o.c.map((x) => [...x]), warm: [...o.warm], rose: [...o.rose], top: [...o.top], bot: [...o.bot] });
  let mood = 'rankings', live = false, surge = 0, t = Math.random() * 60, ptr = [0, 0], ptrGoal = [0, 0];
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
