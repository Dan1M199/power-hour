// 4.1, the living silk (Dan's request Nov 19: give the background personality, make it lively).
// The aurora used to be five soft blobs drifting the same way on every page. Now it's one sheet of silk, drawn by a
// small WebGL shader behind everything: bands of colour folding over each other like the ribbons in the brief's
// reference, with a sheen running along the folds and one warm streak of yellow into amber.
// It has moods, one per page, all in the league's colours:
//  - rankings: gold and spring green, the trophy table
//  - live: hot yellow and amber, and it flows twice as fast while games are on
//  - wire: cool cyan and mint drifting sideways, the news ticking past
//  - matchups: sky blue folding into amber, the two sides of every game (the --a and --b of the matchup cards)
//  - lab: mint, lime and cyan, the spreadsheet people's greenhouse
// Switching tabs crossfades the mood and sends a surge through the silk (it speeds up and settles), on the same beat as
// the tab pill's glide. The pointer leans on it a little, scrolling slides it like a slow parallax.
// Costs: drawn at a fraction of the screen's resolution (the silk is soft, so nobody sees it), at most 30 frames a
// second on phones and 45 elsewhere, paused while the tab is hidden, an overlay locks the page or the headline desk is
// open. Reduced motion or Save-Data draws one still frame per mood. Without WebGL the CSS aurora stays as it was.

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision mediump float;
uniform vec2 uRes;uniform float uT;uniform vec2 uPtr;uniform float uScroll;
uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;uniform vec3 uWarm;uniform vec3 uBase;
uniform float uAmt;uniform float uSheen;uniform float uDrift;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;vec2 p=uv;p.x*=uRes.x/uRes.y;
  p.y+=uScroll;p+=uPtr*.06;
  float t=uT;
  vec2 q=vec2(fbm(p*1.1+vec2(t*.05*uDrift,t*.03)),fbm(p*1.1+vec2(5.2,1.3)-t*.04));
  vec2 r=vec2(fbm(p*1.5+2.2*q+vec2(1.7,9.2)+t*.06),fbm(p*1.5+2.2*q+vec2(8.3,2.8)-t*.05));
  float f=fbm(p+2.6*r);
  vec3 c=mix(uC0,uC1,smoothstep(.15,.85,q.x));
  c=mix(c,uC2,smoothstep(.25,.95,r.y));
  c=mix(c,uC3,smoothstep(.45,.95,f));
  /* the folds: bands along the warped field, with a sharper sheen on each crest */
  float b=sin((p.y*2.4+p.x*.9+r.x*3.6+q.y*1.8-t*.22)*3.14159);
  float sheen=pow(max(b,0.),14.)*.9+smoothstep(.6,1.,b)*.25;
  float shade=smoothstep(-.2,-1.,b)*.1;
  /* the warm streak, sweeping in from the left */
  float d=dot(p-vec2(-.1,.62),normalize(vec2(.5,1.)))+.18*(r.x-.5);
  c=mix(c,uWarm,exp(-d*d*38.)*.42);
  c+=sheen*uSheen;c-=shade;
  c=mix(c,vec3(1.),.1*uAmt);
  c=mix(uBase,c,uAmt);
  c+=(h(gl_FragCoord.xy+t)-.5)/128.;
  gl_FragColor=vec4(c,1.);
}`;

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
// the moods: four colours for the silk, the warm streak, how fast it moves and which way it drifts
const MOODS = {
  rankings: { c: ['#9FD3F6', '#B4E4AE', '#DDEB95', '#FFE48A'], warm: '#F9B000', speed: 1, drift: 1 },
  live: { c: ['#A8E3EE', '#FFE48A', '#FFD27A', '#DDEB95'], warm: '#FF9F1A', speed: 2.1, drift: 1.4 },
  wire: { c: ['#A8E3EE', '#B4E4AE', '#9FD3F6', '#E6F3C8'], warm: '#FFE01A', speed: 1.3, drift: 2.6 },
  matchups: { c: ['#9FD3F6', '#B9E2FA', '#FFD889', '#FFC65C'], warm: '#F9B000', speed: 1.15, drift: -1 },
  lab: { c: ['#B4E4AE', '#A8E3EE', '#DDEB95', '#CDEFD9'], warm: '#FFE01A', speed: 0.85, drift: 0.6 },
};
const THEMES = {
  light: { base: '#EEF3F0', amt: 0.92, sheen: 0.2 },
  dark: { base: '#0B1322', amt: 0.34, sheen: 0.05 },
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
  for (const k of ['uRes', 'uT', 'uPtr', 'uScroll', 'uC0', 'uC1', 'uC2', 'uC3', 'uWarm', 'uBase', 'uAmt', 'uSheen', 'uDrift']) U[k] = gl.getUniformLocation(prog, k);

  sky.prepend(canvas);
  const root = document.documentElement;
  root.classList.add('silk-on');

  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true;
  const small = () => matchMedia('(max-width: 760px)').matches;
  const theme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

  // the live state of the silk: colours ease toward the mood's, the clock runs at the mood's speed plus any surge
  const cur = { c: MOODS.rankings.c.map(hex), warm: hex(MOODS.rankings.warm), base: hex(THEMES[theme()].base), amt: THEMES[theme()].amt, sheen: THEMES[theme()].sheen, speed: 1, drift: 1 };
  let goal = { ...cur, c: cur.c.map((x) => [...x]) };
  let mood = 'rankings', live = false, surge = 0, t = Math.random() * 40, ptr = [0, 0], ptrGoal = [0, 0];
  let raf = 0, last = 0, paused = false;

  const size = () => {
    const scale = small() ? 0.45 : 0.38;
    const w = Math.max(1, Math.round(innerWidth * scale)), hgt = Math.max(1, Math.round(Math.max(innerHeight, screen.height || 0) * scale));
    if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; gl.viewport(0, 0, w, hgt); }
  };
  const setGoal = () => {
    const m = MOODS[mood] || MOODS.rankings, th = THEMES[theme()];
    goal = { c: m.c.map(hex), warm: hex(m.warm), base: hex(th.base), amt: th.amt, sheen: th.sheen, speed: m.speed * (live ? 1.5 : 1), drift: m.drift };
  };
  const ease = (a, b, k) => a + (b - a) * k;
  const draw = () => {
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uT, t);
    gl.uniform2f(U.uPtr, ptr[0], ptr[1]);
    gl.uniform1f(U.uScroll, (scrollY / Math.max(1, innerHeight)) * 0.08);
    cur.c.forEach((c, i) => gl.uniform3fv(U[`uC${i}`], c));
    gl.uniform3fv(U.uWarm, cur.warm);
    gl.uniform3fv(U.uBase, cur.base);
    gl.uniform1f(U.uAmt, cur.amt);
    gl.uniform1f(U.uSheen, cur.sheen);
    gl.uniform1f(U.uDrift, cur.drift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const step = (now) => {
    raf = 0;
    if (paused) return;
    const gap = small() ? 1000 / 30 : 1000 / 45;
    if (now - last < gap - 2) { raf = requestAnimationFrame(step); return; }
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    const k = 1 - Math.exp(-dt * 2.2); // colours settle in about a second and a half
    cur.c.forEach((c, i) => c.forEach((v, j) => (c[j] = ease(v, goal.c[i][j], k))));
    cur.warm.forEach((v, j) => (cur.warm[j] = ease(v, goal.warm[j], k)));
    cur.base.forEach((v, j) => (cur.base[j] = ease(v, goal.base[j], k * 2)));
    cur.amt = ease(cur.amt, goal.amt, k * 2);
    cur.sheen = ease(cur.sheen, goal.sheen, k * 2);
    cur.speed = ease(cur.speed, goal.speed, k);
    cur.drift = ease(cur.drift, goal.drift, k);
    surge *= Math.exp(-dt * 2.4);
    ptr = [ease(ptr[0], ptrGoal[0], 1 - Math.exp(-dt * 1.5)), ease(ptr[1], ptrGoal[1], 1 - Math.exp(-dt * 1.5))];
    t += dt * (cur.speed + surge * 7);
    draw();
    raf = requestAnimationFrame(step);
  };
  const run = () => {
    const stop = document.hidden || root.classList.contains('locked') || root.classList.contains('admin-mode');
    if (still() || stop) {
      paused = true;
      cancelAnimationFrame(raf); raf = 0;
      if (still() && !stop) { // one settled frame for the mood, no motion
        cur.c = goal.c.map((x) => [...x]); Object.assign(cur, { warm: [...goal.warm], base: [...goal.base], amt: goal.amt, sheen: goal.sheen, drift: goal.drift });
        draw();
      }
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
  new MutationObserver(() => { setGoal(); run(); }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); paused = true; root.classList.remove('silk-on'); canvas.remove(); });

  size();
  setGoal();
  cur.base = [...goal.base]; cur.amt = goal.amt; cur.sheen = goal.sheen;
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
