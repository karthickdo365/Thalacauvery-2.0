import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMachine } from '../context/MachineContext';
import { MACHINES, RigViewer } from '../utils/rig3d';

const css = String.raw`
:root {
  --bg: #070c16;
  --navy: #0d1b2e;
  --teal: #20bea5;
  --ink: #f2f5f7;
  --dim: rgba(255,255,255,.55);
  --faint: rgba(255,255,255,.34);
  --panel: rgba(255,255,255,.045);
  --line: rgba(255,255,255,.10);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  min-height: 100%;
}

body {
  margin: 0;
  background: linear-gradient(155deg,#070c16 0%,var(--navy) 55%,#0a1e19 100%);
  color: var(--ink);
  font-family: 'Chakra Petch','Segoe UI',sans-serif;
  overflow-x: hidden;
  -webkit-tap-highlight-color: transparent;
}

button { font-family: inherit; }

.machine-selection-page {
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
  background: linear-gradient(155deg,#070c16 0%,var(--navy) 55%,#0a1e19 100%);
}

.bg-grid {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
  background-size: 46px 46px;
  -webkit-mask-image: radial-gradient(ellipse at 50% 38%,#000 0%,transparent 74%);
  mask-image: radial-gradient(ellipse at 50% 38%,#000 0%,transparent 74%);
}

.sel-inner {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 20px;
}

.sel-head {
  text-align: center;
  margin-bottom: 44px;
  animation: fadeSlideUp .6s ease both;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: 700 .58rem 'IBM Plex Mono',monospace;
  letter-spacing: .24em;
  padding: 7px 13px;
  border-radius: 99px;
  border: 1px solid rgba(32,190,165,.35);
  background: rgba(32,190,165,.10);
  color: var(--teal);
}

.sel-head h1 {
  margin-top: 16px;
  font: 700 clamp(1.5rem,4.5vw,2.5rem)/1.15 'Chakra Petch',sans-serif;
  letter-spacing: .1em;
}

.head-rule {
  display: block;
  width: 58px;
  height: 3px;
  border-radius: 3px;
  background: var(--teal);
  margin: 18px auto 14px;
}

.sel-head p {
  color: var(--dim);
  font-size: .92rem;
  font-weight: 500;
  letter-spacing: .02em;
}

.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 26px;
  width: 100%;
}

.mcard {
  background: var(--panel);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--line);
  border-radius: 24px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  user-select: none;
  transition: transform .35s cubic-bezier(.22,1,.36,1), border-color .35s, box-shadow .35s;
  animation: cardIn .7s cubic-bezier(.2,.7,.25,1) backwards;
  outline: none;
}

.mcard:nth-child(2) { animation-delay: .12s; }

.mcard:hover {
  transform: translateY(-7px);
  border-color: var(--cb);
  box-shadow: 0 24px 50px rgba(0,0,0,.5),0 0 34px var(--csh);
}

.mcard:active {
  transform: translateY(-3px) scale(.995);
}

.mcard:focus-visible {
  outline: 2px solid var(--c);
  outline-offset: 4px;
}

.stage {
  position: relative;
  height: clamp(240px,34vw,330px);
  background: #0a1120;
  border-bottom: 1px solid var(--line);
}

.stage canvas {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
  cursor: grab;
}

.stage canvas:active { cursor: grabbing; }

.stage::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 46%;
  pointer-events: none;
  background: linear-gradient(to top,rgba(5,9,16,.55),rgba(5,9,16,0));
}

.idx {
  position: absolute;
  top: 12px;
  right: 18px;
  font: 700 1.9rem 'Chakra Petch',sans-serif;
  color: rgba(255,255,255,.20);
  letter-spacing: .05em;
  pointer-events: none;
}

.hint {
  position: absolute;
  top: 13px;
  left: 15px;
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font: 600 .52rem 'IBM Plex Mono',monospace;
  letter-spacing: .2em;
  color: rgba(255,255,255,.42);
  pointer-events: none;
  transition: opacity .7s;
}

.hint.fade { opacity: 0; }

.pill {
  position: absolute;
  left: 18px;
  bottom: 18px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  background: var(--c);
  color: #fff;
  font: 700 .78rem 'Chakra Petch',sans-serif;
  letter-spacing: .06em;
  padding: 9px 14px;
  border-radius: 11px;
  pointer-events: none;
  box-shadow: 0 8px 22px rgba(0,0,0,.35);
}

.pill i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(255,255,255,.25);
}

.last-used {
  position: absolute;
  bottom: 18px;
  right: 16px;
  font: 600 .52rem 'IBM Plex Mono',monospace;
  letter-spacing: .2em;
  color: var(--cl);
  border: 1px solid var(--cb);
  background: rgba(0,0,0,.4);
  padding: 5px 9px;
  border-radius: 7px;
  pointer-events: none;
}

.mbody { padding: 20px 22px 24px; }

.tagrow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 7px;
}

.tag {
  font: 700 .62rem 'Chakra Petch',sans-serif;
  letter-spacing: .18em;
  color: var(--cl);
}

.tdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
  box-shadow: 0 0 0 4px var(--csh);
}

.mbody .desc {
  color: var(--dim);
  font-size: .86rem;
  font-weight: 500;
  line-height: 1.6;
}

.cta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px dashed rgba(255,255,255,.14);
}

.cta span {
  font: 600 .62rem 'IBM Plex Mono',monospace;
  letter-spacing: .2em;
  color: rgba(255,255,255,.42);
}

.cta svg {
  color: var(--c);
  transition: transform .3s;
}

.mcard:hover .cta svg { transform: translateX(7px); }

.sel-foot {
  margin-top: 42px;
  text-align: center;
  font: 600 .62rem 'IBM Plex Mono',monospace;
  letter-spacing: .22em;
  color: rgba(255,255,255,.30);
  animation: fadeSlideUp .6s .45s ease both;
}

.selection-error {
  margin-top: 20px;
  padding: 10px 14px;
  border: 1px solid rgba(239,68,68,.35);
  border-radius: 10px;
  background: rgba(239,68,68,.08);
  color: #fca5a5;
  font: 600 .7rem 'IBM Plex Mono',monospace;
  text-align: center;
}

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(28px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: none; }
}

@media (max-width: 900px) {
  .cards {
    grid-template-columns: 1fr;
    max-width: 480px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,*::before,*::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
`;

function SelectionCard({ machineKey, machine, onSelect }) {
  const cardRef = useRef(null);
  const viewerRef = useRef(null);
  const pointerDownRef = useRef(null);
  const [lastUsed, setLastUsed] = useState(false);
  const [hintFade, setHintFade] = useState(false);

  useEffect(() => {
    try {
      setLastUsed(localStorage.getItem('thalacauvery_machine') === machineKey);
    } catch {
      setLastUsed(false);
    }
  }, [machineKey]);

  useEffect(() => {
    const canvas = cardRef.current?.querySelector('canvas');
    if (!canvas) return undefined;

    let viewer;

    try {
      viewer = new RigViewer({
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

        if (viewer?.active && viewer?.w) {
          viewer.update(dt, now / 1000);
        }

        frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(frame);
        viewer?.dispose?.();
        viewerRef.current = null;
      };
    } catch (error) {
      console.error(`Failed to initialize ${machineKey} machine preview:`, error);
      viewerRef.current = null;
      return undefined;
    }
  }, [machineKey, machine.scaleCard]);

  const handlePointerDown = (event) => {
    pointerDownRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    setHintFade(true);
  };

  const handleClick = (event) => {
    const start = pointerDownRef.current;
    pointerDownRef.current = null;

    if (!start) return;

    const moved = Math.hypot(
      event.clientX - start.x,
      event.clientY - start.y,
    ) > 8;

    if (!moved) {
      onSelect(machineKey, viewerRef.current);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(machineKey, viewerRef.current);
    }
  };

  return (
    <article
      ref={cardRef}
      className="mcard"
      data-key={machineKey}
      role="button"
      tabIndex={0}
      aria-label={`Select ${machine.title}`}
      style={{
        '--c': machine.color,
        '--cl': machine.lt,
        '--cb': machine.cb,
        '--csh': machine.csh,
      }}
      onPointerEnter={() => viewerRef.current?.hoverCard?.(true)}
      onPointerLeave={() => viewerRef.current?.hoverCard?.(false)}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="stage">
        <canvas />

        <span className="idx">{machine.idx}</span>

        <span className={`hint${hintFade ? ' fade' : ''}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 12a9 9 0 1 1-3.2-6.9M21 3v5.5h-5.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          DRAG ROTATE · HOVER TO RIG UP
        </span>

        {lastUsed && <span className="last-used">LAST USED</span>}

        <span className="pill">
          <i />
          {machine.title}
        </span>
      </div>

      <div className="mbody">
        <div className="tagrow">
          <span className="tag">{machine.tag}</span>
          <i className="tdot" />
        </div>

        <p className="desc">{machine.desc}</p>

        <div className="cta">
          <span>TAP TO CONTINUE</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12h13M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </article>
  );
}

function SelectionPage({ onSelect }) {
  return (
    <section className="sel-inner">
      <header className="sel-head">
        <span className="chip">MACHINE CONTROL</span>
        <h1>THALACUVERY BOREWELL</h1>
        <span className="head-rule" />
        <p>Which machine are you operating today?</p>
      </header>

      <div className="cards">
        {Object.entries(MACHINES).map(([key, machine]) => (
          <SelectionCard
            key={key}
            machineKey={key}
            machine={machine}
            onSelect={onSelect}
          />
        ))}
      </div>

      <p className="sel-foot">SELECT A MACHINE TO CONTINUE</p>
    </section>
  );
}

export default function MachineSelection() {
  const navigate = useNavigate();
  const { setMachine } = useMachine();
  const [navigating, setNavigating] = useState(false);
  const [navigationError, setNavigationError] = useState('');

  const selectMachine = (machineKey, viewer) => {
    if (navigating) return;

    const machine = MACHINES[machineKey];
    if (!machine) {
      console.error(`Unknown machine key: ${machineKey}`);
      return;
    }

    setNavigationError('');
    setNavigating(true);

    try {
      // Preserve the old application's machine-selection state.
      setMachine(machineKey);
      localStorage.setItem('thalacauvery_machine', machineKey);
    } catch (error) {
      console.error('Failed to save selected machine:', error);
    }

    // Preserve the old working dashboard route.
    try {
      viewer?.powerFlash?.();
    } catch (error) {
      console.warn('Machine selection flash failed:', error);
    }

    try {
      navigate('/dashboard');
    } catch (error) {
      console.error('Dashboard navigation failed:', error);
      setNavigationError('Unable to open the machine dashboard.');
      setNavigating(false);
    }
  };

  useEffect(() => {
    // If the component remains mounted briefly after navigation,
    // do not leave the selection UI in a permanently locked state.
    const timer = window.setTimeout(() => setNavigating(false), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="machine-selection-page">
      <style>{css}</style>
      <div className="bg-grid" aria-hidden="true" />

      <SelectionPage onSelect={selectMachine} />

      {navigationError && (
        <div className="selection-error" role="alert">
          {navigationError}
        </div>
      )}
    </main>
  );
}
