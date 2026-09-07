import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MACHINES, RigViewer, clamp } from '../utils/rig3d';

const TEAL = '#20bea5';
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const css = String.raw`  :root{
    --bg:#070c16; --navy:#0d1b2e; --teal:#20bea5;
    --ink:#f2f5f7; --dim:rgba(255,255,255,.55); --faint:rgba(255,255,255,.34);
    --panel:rgba(255,255,255,.045); --line:rgba(255,255,255,.10);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{min-height:100%}
  body{
    background:linear-gradient(155deg,#070c16 0%,var(--navy) 55%,#0a1e19 100%);
    color:var(--ink); font-family:'Chakra Petch','Segoe UI',sans-serif;
    overflow-x:hidden; -webkit-tap-highlight-color:transparent;
  }
  button{font-family:inherit}

  .bg-grid{
    position:fixed; inset:0; z-index:0; pointer-events:none;
    background-image:
      linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
    background-size:46px 46px;
    -webkit-mask-image:radial-gradient(ellipse at 50% 38%,#000 0%,transparent 74%);
    mask-image:radial-gradient(ellipse at 50% 38%,#000 0%,transparent 74%);
  }
  .page{position:relative;z-index:1;display:none}
  .page.active{display:block;animation:pageIn .55s cubic-bezier(.2,.7,.3,1) backwards}
  @keyframes pageIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}

  /* ============ selection page ============ */
  .sel-inner{
    min-height:100vh; max-width:1080px; margin:0 auto;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:56px 20px;
  }
  .sel-head{text-align:center;margin-bottom:44px}
  .chip{
    display:inline-flex;align-items:center;gap:8px;
    font:700 .58rem 'IBM Plex Mono',monospace;letter-spacing:.24em;
    padding:7px 13px;border-radius:99px;
    border:1px solid rgba(32,190,165,.35);background:rgba(32,190,165,.10);color:var(--teal);
  }
  .sel-head h1{
    margin-top:16px;font:700 clamp(1.5rem,4.5vw,2.5rem)/1.15 'Chakra Petch';
    letter-spacing:.1em;
  }
  .head-rule{display:block;width:58px;height:3px;border-radius:3px;background:var(--teal);margin:18px auto 14px}
  .sel-head p{color:var(--dim);font-size:.92rem;font-weight:500;letter-spacing:.02em}

  .cards{display:grid;grid-template-columns:1fr 1fr;gap:26px;width:100%}
  @media(max-width:900px){.cards{grid-template-columns:1fr;max-width:480px}}

  .mcard{
    background:var(--panel);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    border:1px solid var(--line);border-radius:24px;overflow:hidden;cursor:pointer;
    position:relative;user-select:none;
    transition:transform .35s cubic-bezier(.22,1,.36,1),border-color .35s,box-shadow .35s;
    animation:cardIn .7s cubic-bezier(.2,.7,.25,1) backwards;
  }
  .mcard:nth-child(2){animation-delay:.12s}
  @keyframes cardIn{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
  .mcard:hover{transform:translateY(-7px);border-color:var(--cb);box-shadow:0 24px 50px rgba(0,0,0,.5),0 0 34px var(--csh)}
  .mcard:active{transform:translateY(-3px) scale(.995)}

  .stage{position:relative;height:clamp(240px,34vw,330px);background:#0a1120;border-bottom:1px solid var(--line)}
  .stage canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}
  .stage canvas:active{cursor:grabbing}
  .stage::after{
    content:'';position:absolute;left:0;right:0;bottom:0;height:46%;pointer-events:none;
    background:linear-gradient(to top,rgba(5,9,16,.55),rgba(5,9,16,0));
  }
  .idx{position:absolute;top:12px;right:18px;font:700 1.9rem 'Chakra Petch';color:rgba(255,255,255,.20);letter-spacing:.05em;pointer-events:none}
  .hint{
    position:absolute;top:13px;left:15px;display:inline-flex;gap:7px;align-items:center;
    font:600 .52rem 'IBM Plex Mono',monospace;letter-spacing:.2em;color:rgba(255,255,255,.42);
    pointer-events:none;transition:opacity .7s;
  }
  .hint.fade{opacity:0}
  .pill{
    position:absolute;left:18px;bottom:18px;display:inline-flex;align-items:center;gap:9px;
    background:var(--c);color:#fff;font:700 .78rem 'Chakra Petch';letter-spacing:.06em;
    padding:9px 14px;border-radius:11px;pointer-events:none;box-shadow:0 8px 22px rgba(0,0,0,.35);
  }
  .pill i{width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.25)}
  .last-used{
    position:absolute;bottom:18px;right:16px;
    font:600 .52rem 'IBM Plex Mono',monospace;letter-spacing:.2em;color:var(--cl);
    border:1px solid var(--cb);background:rgba(0,0,0,.4);padding:5px 9px;border-radius:7px;pointer-events:none;
  }

  .mbody{padding:20px 22px 24px}
  .tagrow{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}
  .tag{font:700 .62rem 'Chakra Petch';letter-spacing:.18em;color:var(--cl)}
  .tdot{width:8px;height:8px;border-radius:50%;background:var(--c);box-shadow:0 0 0 4px var(--csh)}
  .mbody .desc{color:var(--dim);font-size:.86rem;font-weight:500;line-height:1.6}
  .cta{
    display:flex;justify-content:space-between;align-items:center;
    margin-top:18px;padding-top:16px;border-top:1px dashed rgba(255,255,255,.14);
  }
  .cta span{font:600 .62rem 'IBM Plex Mono',monospace;letter-spacing:.2em;color:rgba(255,255,255,.42)}
  .cta svg{color:var(--c);transition:transform .3s}
  .mcard:hover .cta svg{transform:translateX(7px)}

  .sel-foot{
    margin-top:42px;text-align:center;
    font:600 .62rem 'IBM Plex Mono',monospace;letter-spacing:.22em;color:rgba(255,255,255,.30);
  }

  /* part-inspection tooltip */
  .tip{
    position:absolute;z-index:6;pointer-events:none;padding:6px 10px;border-radius:7px;
    background:rgba(6,10,17,.92);border:1px solid #20bea5;color:#e8f0ee;
    font:600 .56rem 'IBM Plex Mono',monospace;letter-spacing:.16em;white-space:nowrap;
    opacity:0;transform:translateY(5px);transition:opacity .16s,transform .16s;
  }
  .tip.on{opacity:1;transform:none}

  /* ============ machine page ============ */
  .mp-inner{max-width:1240px;margin:0 auto;padding:24px clamp(16px,4vw,44px) 56px}
  .mhead{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:24px}
  .ghost{
    display:inline-flex;align-items:center;gap:8px;background:transparent;
    border:1px solid rgba(255,255,255,.16);color:var(--dim);
    padding:9px 16px;border-radius:10px;cursor:pointer;
    font:600 .66rem 'Chakra Petch';letter-spacing:.18em;
    transition:color .2s,border-color .2s;
  }
  .ghost:hover{color:#fff;border-color:rgba(255,255,255,.42)}
  .ghost:focus-visible,.drill-btn:focus-visible,.zero:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
  .mhead-brand{font:700 .72rem 'Chakra Petch';letter-spacing:.3em;color:rgba(255,255,255,.38)}
  .mchip{border-color:var(--cb);background:var(--csh);color:var(--cl)}
  .mchip .live{width:7px;height:7px;border-radius:50%;background:var(--cl)}
  .page.active .mchip .live{animation:pulse 1.8s infinite}
  @keyframes pulse{
    0%,100%{opacity:1;box-shadow:0 0 0 0 var(--csh)}
    50%{opacity:.55;box-shadow:0 0 0 6px transparent}
  }

  .mgrid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(310px,1fr);gap:22px;align-items:start}
  @media(max-width:980px){.mgrid{grid-template-columns:1fr}}

  .viewport{
    position:relative;height:clamp(380px,58vh,600px);user-select:none;
    background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:20px;overflow:hidden;
  }
  @media(max-width:980px){.viewport{height:clamp(300px,46vh,520px)}}
  .viewport canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}
  .viewport canvas:active{cursor:grabbing}
  .corner{position:absolute;width:20px;height:20px;border:0 solid var(--c);pointer-events:none}
  .c-tl{top:10px;left:10px;border-top-width:2px;border-left-width:2px}
  .c-tr{top:10px;right:10px;border-top-width:2px;border-right-width:2px}
  .c-bl{bottom:10px;left:10px;border-bottom-width:2px;border-left-width:2px}
  .c-br{bottom:10px;right:10px;border-bottom-width:2px;border-right-width:2px}
  .vp-tag{position:absolute;top:16px;left:22px;font:600 .58rem 'IBM Plex Mono',monospace;letter-spacing:.26em;color:rgba(255,255,255,.4);pointer-events:none}
  .vp-hud{position:absolute;left:22px;right:22px;bottom:14px;display:flex;justify-content:space-between;pointer-events:none;gap:10px}
  .vp-az{font:600 .62rem 'IBM Plex Mono',monospace;letter-spacing:.18em;color:var(--cl)}
  .vp-hint{font:500 .56rem 'IBM Plex Mono',monospace;letter-spacing:.18em;color:rgba(255,255,255,.35);transition:opacity .7s}
  .vp-hint.fade{opacity:0}

  .mtitle h2{font:700 clamp(1.4rem,3vw,1.9rem) 'Chakra Petch';letter-spacing:.06em}
  .mtitle .mtag{display:block;font:700 .6rem 'Chakra Petch';letter-spacing:.2em;color:var(--cl);margin:7px 0 10px}
  .mtitle p{color:var(--dim);font-size:.88rem;line-height:1.6}
  .mtitle{margin-bottom:18px}

  .panel{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px 20px}
  .specs{margin-bottom:16px}
  .ptitle{
    font:700 .58rem 'IBM Plex Mono',monospace;letter-spacing:.24em;color:rgba(255,255,255,.45);
    display:flex;align-items:center;gap:9px;margin-bottom:14px;
  }
  .mstate{margin-left:auto;color:var(--cl);letter-spacing:.2em}
  .sdot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25)}
  .monitor.on .sdot{background:var(--cl);animation:pulse 1.2s infinite}

  .spec-row{display:flex;align-items:flex-end;gap:10px;padding:7px 0}
  .spec-row .k{font:600 .58rem 'IBM Plex Mono',monospace;letter-spacing:.16em;color:var(--faint);padding-bottom:2px}
  .spec-row .leader{flex:1;border-bottom:1px dotted rgba(255,255,255,.18);margin-bottom:5px}
  .spec-row .v{font:600 .84rem 'IBM Plex Mono',monospace;color:var(--ink)}

  .depth{
    display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:14px 16px;
    background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.07);border-radius:12px;
  }
  .dnum{display:flex;align-items:baseline;gap:9px}
  .dnum b{font:600 2rem 'IBM Plex Mono',monospace;color:#fff;font-variant-numeric:tabular-nums}
  .dnum span{font:600 .56rem 'IBM Plex Mono',monospace;letter-spacing:.22em;color:var(--faint)}
  .zero{
    margin-left:auto;background:none;border:1px solid rgba(255,255,255,.14);color:var(--faint);
    font:600 .52rem 'IBM Plex Mono',monospace;letter-spacing:.2em;padding:5px 9px;border-radius:6px;cursor:pointer;
    transition:color .2s,border-color .2s;
  }
  .zero:hover{color:#fff;border-color:rgba(255,255,255,.35)}

  .grow{display:grid;grid-template-columns:64px 1fr 44px 42px;gap:10px;align-items:center;margin:9px 0}
  .gk{font:600 .55rem 'IBM Plex Mono',monospace;letter-spacing:.14em;color:var(--faint)}
  .bar{height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden}
  .bar i{display:block;height:100%;width:0;background:var(--c)}
  .gv{font:600 .72rem 'IBM Plex Mono',monospace;color:var(--ink);text-align:right;font-variant-numeric:tabular-nums}
  .gu{font:500 .56rem 'IBM Plex Mono',monospace;color:var(--faint)}

  .spark{width:100%;height:56px;display:block;margin:16px 0 6px;border-radius:8px;background:rgba(0,0,0,.25)}
  .spark-cap{display:flex;justify-content:space-between;font:600 .5rem 'IBM Plex Mono',monospace;letter-spacing:.2em;color:var(--faint);margin-bottom:14px}

  .drill-btn{
    width:100%;display:flex;align-items:center;justify-content:center;gap:9px;
    padding:13px;border:1px solid transparent;border-radius:11px;cursor:pointer;
    background:var(--c);color:#04140a;
    font:700 .7rem 'Chakra Petch';letter-spacing:.18em;
    transition:filter .2s,background .25s,color .25s,border-color .25s;
  }
  .drill-btn:hover:not(:disabled){filter:brightness(1.12)}
  .drill-btn:active:not(:disabled){transform:translateY(1px)}
  .drill-btn:disabled{opacity:.5;cursor:not-allowed;filter:saturate(.35)}
  .drill-btn.stop{background:rgba(0,0,0,.35);color:var(--cl);border-color:var(--cb)}
  .drill-btn .i-stop{display:none}
  .drill-btn.stop .i-stop{display:inline}
  .drill-btn.stop .i-play{display:none}

  .log{margin-top:14px;display:flex;flex-direction:column;gap:6px;max-height:122px;overflow:hidden}
  .log div{display:flex;gap:10px;font:500 .58rem 'IBM Plex Mono',monospace;letter-spacing:.05em;color:var(--dim)}
  .log div:first-child{color:var(--cl)}
  .log .lt{color:var(--faint)}

  #shutter{position:fixed;inset:0;z-index:60;background:#050a12;transform:translateX(-102%);pointer-events:none}
  #shutter::before{content:'';position:absolute;top:0;bottom:0;right:0;width:3px;background:var(--sc,var(--teal))}
  #shutter.in{transform:none;transition:transform .34s cubic-bezier(.72,0,.26,1)}
  #shutter.out{transform:translateX(102%);transition:transform .42s cubic-bezier(.72,0,.26,1)}

  @media (prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
  }`;

function SelectionCard({ machineKey, machine, onSelect }) {
  const cardRef = useRef(null);
  const viewerRef = useRef(null);
  const downRef = useRef(null);
  const [lastUsed, setLastUsed] = useState(false);
  const [hintFade, setHintFade] = useState(false);

  useEffect(() => {
    try {
      setLastUsed(localStorage.getItem('thalacauvery_machine') === machineKey);
    } catch {}
  }, [machineKey]);

  useEffect(() => {
    const canvas = cardRef.current?.querySelector('canvas');
    if (!canvas) return;

    const viewer = new RigViewer({
      canvas,
      machine: machineKey,
      mode: 'card',
      scale: machine.scaleCard,
    });
    viewerRef.current = viewer;

    let frame = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (viewer.active && viewer.w) viewer.update(dt, now / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      viewer.dispose?.();
      viewerRef.current = null;
    };
  }, [machineKey, machine.scaleCard]);

  const handlePointerDown = (event) => {
    downRef.current = { x: event.clientX, y: event.clientY };
    setHintFade(true);
  };

  const handleClick = (event) => {
    const start = downRef.current;
    downRef.current = null;
    if (!start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8;
    if (!moved) onSelect(machineKey, viewerRef.current);
  };

  return (
    <article
      ref={cardRef}
      className="mcard"
      data-key={machineKey}
      style={{
        '--c': machine.color,
        '--cl': machine.lt,
        '--cb': machine.cb,
        '--csh': machine.csh,
      }}
      onPointerEnter={() => viewerRef.current?.hoverCard(true)}
      onPointerLeave={() => viewerRef.current?.hoverCard(false)}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <div className="stage">
        <canvas />
        <span className="idx">{machine.idx}</span>
        <span className={`hint${hintFade ? ' fade' : ''}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M21 12a9 9 0 1 1-3.2-6.9M21 3v5.5h-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          DRAG ROTATE · HOVER TO RIG UP
        </span>
        <span className="last-used" hidden={!lastUsed}>LAST USED</span>
        <span className="pill"><i />{machine.title}</span>
      </div>
      <div className="mbody">
        <div className="tagrow"><span className="tag">{machine.tag}</span><i className="tdot" /></div>
        <p className="desc">{machine.desc}</p>
        <div className="cta">
          <span>TAP TO CONTINUE</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </article>
  );
}

function SelectionPage({ onSelect }) {
  return (
    <section id="page-select" className="page active">
      <div className="sel-inner">
        <header className="sel-head">
          <span className="chip">MACHINE CONTROL</span>
          <h1>THALACUVERY BOREWELL</h1>
          <span className="head-rule" />
          <p>Which machine are you operating today?</p>
        </header>

        <div className="cards">
          {Object.entries(MACHINES).map(([key, machine]) => (
            <SelectionCard key={key} machineKey={key} machine={machine} onSelect={onSelect} />
          ))}
        </div>

        <p className="sel-foot">SELECT A MACHINE TO CONTINUE</p>
      </div>
    </section>
  );
}

function useViewerLoop(viewerRef, onFrame) {
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const viewer = viewerRef.current;
      if (viewer?.active && viewer.w) viewer.update(dt, now / 1000);
      onFrame?.(dt, now / 1000, viewer);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onFrame, viewerRef]);
}

function Sparkline({ history, max, accent, light }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = rect.width;
    const h = rect.height;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1;
    for (const f of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(0, h * f);
      ctx.lineTo(w, h * f);
      ctx.stroke();
    }

    if (history.length < 2) {
      ctx.strokeStyle = 'rgba(255,255,255,.15)';
      ctx.beginPath();
      ctx.moveTo(0, h - 3);
      ctx.lineTo(w, h - 3);
      ctx.stroke();
      return;
    }

    const n = 140;
    const px = (i) => i / (n - 1) * w;
    const py = (v) => h - 4 - (v / max) * (h - 12);
    ctx.beginPath();
    history.forEach((v, i) => {
      if (i) ctx.lineTo(px(i), py(v));
      else ctx.moveTo(px(i), py(v));
    });
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.lineTo(px(history.length - 1), h);
    ctx.lineTo(px(0), h);
    ctx.closePath();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(px(history.length - 1), py(history[history.length - 1]), 2.4, 0, Math.PI * 2);
    ctx.fillStyle = light;
    ctx.fill();
  }, [history, max, accent, light]);

  return <canvas ref={ref} className="spark" />;
}

function MachinePage({ machineKey, onBack }) {
  const machine = MACHINES[machineKey];
  const viewportRef = useRef(null);
  const viewerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [depth, setDepth] = useState(0);
  const [metrics, setMetrics] = useState({ rpm: 0, torque: 0, psi: 0 });
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [hintFade, setHintFade] = useState(false);
  const telemetryTime = useRef(Math.random() * 10);
  const sampleAcc = useRef(0);

  const addLog = useCallback((message) => {
    const time = new Date().toTimeString().slice(0, 8);
    setLogs((prev) => [{ time, message }, ...prev].slice(0, 5));
  }, []);

  useEffect(() => {
    const canvas = viewportRef.current?.querySelector('canvas');
    if (!canvas) return;

    const viewer = new RigViewer({
      canvas,
      machine: machineKey,
      mode: 'page',
      scale: 1,
    });
    viewerRef.current = viewer;

    viewer.onRigStart = () => addLog('HYDRAULICS ENGAGED · MAST RAISING');
    viewer.onMastUp = () => addLog('MAST VERTICAL · CROWN SECURE');
    viewer.onReady = () => {
      setReady(true);
      addLog('DRILL STRING RUN-IN COMPLETE');
      addLog('SYSTEM READY · AWAITING COMMAND');
    };
    viewer.onStroke = () => addLog(`STROKE COMPLETE · +${machine.drill.strokeFt.toFixed(1)} FT`);

    addLog('RIG SELF-TEST COMPLETE');

    const vp = viewportRef.current;
    const handleEnter = () => viewer.setHover(true);
    const handleLeave = () => viewer.setHover(false);
    const handleDown = () => setHintFade(true);
    vp.addEventListener('pointerenter', handleEnter);
    vp.addEventListener('pointerleave', handleLeave);
    vp.addEventListener('pointerdown', handleDown, { once: true });

    return () => {
      vp.removeEventListener('pointerenter', handleEnter);
      vp.removeEventListener('pointerleave', handleLeave);
      viewer.dispose?.();
      viewerRef.current = null;
    };
  }, [machineKey, machine.drill.strokeFt, addLog]);

  const handleFrame = useCallback((dt, _t, viewer) => {
    if (!viewer) return;
    const isRunning = viewer.drill.on;
    telemetryTime.current += dt;
    const p = isRunning ? 1 : 0;
    const c = machine.drill;
    const t = telemetryTime.current;
    const rpm = c.rpm * p * (0.95 + 0.05 * Math.sin(t * 3.1) + 0.02 * Math.sin(t * 8.7));
    const torque = c.torque * p * (0.92 + 0.08 * Math.sin(t * 2.3 + 1.2));
    const psi = c.psi * p * (0.9 + 0.1 * Math.sin(t * 1.7 + 0.5));

    sampleAcc.current += dt;
    if (sampleAcc.current > 0.1) {
      sampleAcc.current = 0;
      setDepth(viewer.drillDepth());
      setMetrics({ rpm, torque, psi });
      setHistory((prev) => [...prev, rpm].slice(-140));
    }
  }, [machine]);

  useViewerLoop(viewerRef, handleFrame);

  const startDrill = () => {
    const viewer = viewerRef.current;
    if (!viewer || !ready || running) return;
    viewer.startDrill();
    setRunning(true);
    addLog('DRILL CYCLE STARTED');
  };

  const stopDrill = () => {
    const viewer = viewerRef.current;
    if (!viewer || !running) return;
    const stoppedDepth = viewer.drillDepth();
    viewer.stopDrill();
    setRunning(false);
    setDepth(stoppedDepth);
    addLog(`DRILLING HALTED · ${stoppedDepth.toFixed(1)} FT`);
  };

  const zeroDepth = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.drill.depth = 0;
    setDepth(0);
    addLog('DEPTH COUNTER ZEROED');
  };

  const angle = Math.round((((viewerRef.current?.orbit.yaw || 0) * 57.2958) % 360 + 360) % 360) % 360;
  const state = !ready ? 'RIGGING UP' : running ? 'DRILLING' : 'STANDBY';
  const buttonLabel = !ready ? 'RIGGING UP…' : running ? 'STOP DRILLING' : 'START DRILLING';

  return (
    <section id={`page-${machineKey}`} className="page active">
      <div
        className="mp-inner"
        style={{
          '--c': machine.color,
          '--cl': machine.lt,
          '--cb': machine.cb,
          '--csh': machine.csh,
        }}
      >
        <header className="mhead">
          <button className="ghost" onClick={onBack}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            MACHINE SELECT
          </button>
          <span className="mhead-brand">THALACUVERY BOREWELL</span>
          <span className="chip mchip"><i className="live" />{machine.title} · ONLINE</span>
        </header>

        <div className="mgrid">
          <div ref={viewportRef} className="viewport">
            <canvas />
            <span className="corner c-tl" /><span className="corner c-tr" />
            <span className="corner c-bl" /><span className="corner c-br" />
            <span className="vp-tag">{machine.idx} · {machine.title}</span>
            <div className="vp-hud">
              <span className="vp-az">AZ {String(angle).padStart(3, '0')}°</span>
              <span className={`vp-hint${hintFade ? ' fade' : ''}`}>DRAG · SCROLL · HOVER PARTS</span>
            </div>
          </div>

          <aside className="mside">
            <div className="mtitle">
              <h2>{machine.title}</h2>
              <span className="mtag">{machine.tag}</span>
              <p>{machine.desc}</p>
            </div>

            <div className="panel specs">
              <h3 className="ptitle">SPECIFICATION</h3>
              {machine.specs.map(([k, v]) => (
                <div className="spec-row" key={k}>
                  <span className="k">{k}</span><span className="leader" /><span className="v">{v}</span>
                </div>
              ))}
            </div>

            <div className={`panel monitor${running ? ' on' : ''}`}>
              <h3 className="ptitle">
                <i className="sdot" />DRILL MONITOR<span className="mstate">{state}</span>
              </h3>
              <div className="depth">
                <div className="dnum"><b>{depth.toFixed(1)}</b><span>FT DRILLED</span></div>
                <button className="zero" title="Reset depth counter" onClick={zeroDepth}>ZERO</button>
              </div>

              <MetricRow label="RPM" value={metrics.rpm} max={machine.drill.rpm} unit="rpm" integer accent={machine.color} />
              <MetricRow label="TORQUE" value={metrics.torque} max={machine.drill.torque} unit="kN·m" accent={machine.color} />
              <MetricRow label="PRESSURE" value={metrics.psi} max={machine.drill.psi} unit="psi" integer accent={machine.color} />

              <Sparkline history={history} max={machine.drill.rpm * 1.18} accent={machine.color} light={machine.lt} />
              <div className="spark-cap"><span>ROTARY RPM</span><span>LIVE · 14 s</span></div>

              <button
                className={`drill-btn${running ? ' stop' : ''}`}
                disabled={!ready}
                onClick={running ? stopDrill : startDrill}
              >
                {running ? (
                  <svg className="i-stop" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5.5" y="5.5" width="13" height="13" rx="2.5" /></svg>
                ) : (
                  <svg className="i-play" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
                )}
                <span>{buttonLabel}</span>
              </button>

              <div className="log">
                {logs.map((entry, index) => (
                  <div key={`${entry.time}-${index}`}><span className="lt">{entry.time}</span><span>{entry.message}</span></div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function MetricRow({ label, value, max, unit, integer = false, accent }) {
  const pct = clamp((value / max) * 100, 0, 100);
  return (
    <div className="grow">
      <span className="gk">{label}</span>
      <div className="bar"><i style={{ width: `${pct}%`, background: accent }} /></div>
      <span className="gv">{integer ? Math.round(value) : value.toFixed(1)}</span>
      <span className="gu">{unit}</span>
    </div>
  );
}

export default function BorewellMachineControl() {
  const [route, setRoute] = useState(() => window.location.hash || '#/select');
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    const handleHash = () => setRoute(window.location.hash || '#/select');
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const machineKey = useMemo(() => {
    const match = route.match(/^#\/machine\/(big|small)$/);
    return match ? match[1] : null;
  }, [route]);

  const shutterTo = useCallback((hash, color, done) => {
    const sh = document.getElementById('shutter');
    if (!sh) {
      window.location.hash = hash;
      done?.();
      return;
    }
    sh.style.setProperty('--sc', color);
    sh.classList.remove('out');
    requestAnimationFrame(() => sh.classList.add('in'));
    window.setTimeout(() => {
      if (window.location.hash !== hash) window.location.hash = hash;
      else setRoute(hash);
      window.setTimeout(() => {
        sh.classList.add('out');
        window.setTimeout(() => {
          sh.classList.remove('in', 'out');
          done?.();
        }, 430);
      }, 140);
    }, 370);
  }, []);

  const selectMachine = useCallback((key, viewer) => {
    if (navigating) return;
    setNavigating(true);
    try { localStorage.setItem('thalacauvery_machine', key); } catch {}
    viewer?.powerFlash();
    shutterTo(`#/machine/${key}`, MACHINES[key].color, () => setNavigating(false));
  }, [navigating, shutterTo]);

  const backToSelect = useCallback(() => {
    if (navigating) return;
    setNavigating(true);
    shutterTo('#/select', TEAL, () => setNavigating(false));
  }, [navigating, shutterTo]);

  useEffect(() => window.scrollTo(0, 0), [route]);

  return (
    <>
      <style>{css}</style>
      <div className="bg-grid" aria-hidden="true" />
      {machineKey ? (
        <MachinePage key={machineKey} machineKey={machineKey} onBack={backToSelect} />
      ) : (
        <SelectionPage onSelect={selectMachine} />
      )}
      <div id="shutter" aria-hidden="true" />
    </>
  );
}
