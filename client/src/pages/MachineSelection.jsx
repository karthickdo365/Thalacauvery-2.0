import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Chip, Stack, Typography } from '@mui/material';

import { useMachine } from '../context/MachineContext';
import { MACHINES, RigViewer } from '../utils/rig3d';
import { NAVY } from '../utils/constants';

const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

const MachineSelection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setMachine } = useMachine();

  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const selectRef = useRef(() => {});
  const navigatingRef = useRef(false);

  const [hovered, setHovered] = useState(null);
  const [lastUsed, setLastUsed] = useState(null);
  const [sceneError, setSceneError] = useState(false);

  /* ---- EXACT existing selection behavior (preserved) ---- */
  const handleSelect = useCallback(
    (machine) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      setMachine(machine);
      try {
        localStorage.setItem('thalacauvery_machine', machine);
      } catch (e) {
        /* storage unavailable — selection still proceeds */
      }
      const requested = location.state?.from;
      const target = requested
        ? `${requested.pathname || '/dashboard'}${requested.search || ''}${requested.hash || ''}`
        : '/dashboard';
      // brief beat so the clicked rig's power-flash is visible
      setTimeout(() => navigate(target), 220);
    },
    [location.state, navigate, setMachine]
  );
  selectRef.current = handleSelect;

  /* ---- 3D forest scene lifecycle (created once, fully disposed) ----
     If WebGL fails, the page and the clickable labels still work. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    try {
      const viewer = new RigViewer({
        canvas,
        onHover: (key) => setHovered(key),
        onSelect: (key) => selectRef.current(key),
      });
      viewerRef.current = viewer;
    } catch (e) {
      viewerRef.current = null;
      setSceneError(true);
    }
    return () => {
      try {
        if (viewerRef.current) viewerRef.current.dispose();
      } catch (e) {
        /* ignore disposal errors */
      }
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      setLastUsed(localStorage.getItem('thalacauvery_machine'));
    } catch (e) {
      /* ignore */
    }
  }, []);

  /* minimal floating site tag (no card/box) — always clickable,
     guarantees navigation even if the 3D scene failed */
  const renderTag = (key) => {
    const m = MACHINES[key];
    const active = hovered === key;
    return (
      <Stack
        key={key}
        direction="row"
        alignItems="center"
        spacing={0.9}
        role="button"
        tabIndex={0}
        aria-label={`Select ${m.title}`}
        onClick={() => handleSelect(key)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(key); }}
        onMouseEnter={() => { try { viewerRef.current?.setHover(key); } catch (e) { /* ignore */ } }}
        onMouseLeave={() => { try { viewerRef.current?.setHover(null); } catch (e) { /* ignore */ } }}
        sx={{
          position: 'absolute',
          top: { xs: 12, md: 18 },
          [key === 'big' ? 'left' : 'right']: { xs: 12, md: 22 },
          zIndex: 4,
          cursor: 'pointer',
          userSelect: 'none',
          opacity: active || hovered === null ? 1 : 0.45,
          transition: 'opacity .3s',
        }}
      >
        <Box
          sx={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            bgcolor: m.color,
            boxShadow: active ? `0 0 0 4px ${m.csh}` : 'none',
          }}
        />
        <Typography
          sx={{
            fontFamily: MONO, fontWeight: 600,
            fontSize: { xs: '.52rem', md: '.58rem' },
            letterSpacing: '.22em',
            color: active ? m.lt : 'rgba(255,255,255,.62)',
          }}
        >
          {`${m.idx} · ${m.title}${lastUsed === key ? ' · LAST USED' : ''}`}
        </Typography>
      </Stack>
    );
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(155deg, #070c16 0%, ${NAVY} 55%, #0a1e19 100%)`,
        color: '#f2f5f7',
      }}
    >
      {/* ============ company header ============ */}
      <Box
        component="header"
        sx={{
          px: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 }, pb: 1.5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8,
          borderBottom: '1px solid rgba(255,255,255,.07)',
          bgcolor: 'rgba(5,9,14,.6)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Chip
          label="BOREWELL DRILLING · MACHINE CONTROL"
          sx={{
            fontFamily: MONO, fontWeight: 700, fontSize: '.52rem', letterSpacing: '.22em',
            color: '#20bea5', bgcolor: 'rgba(32,190,165,.10)',
            border: '1px solid rgba(32,190,165,.35)', height: 22,
          }}
        />
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1.3rem', md: '1.8rem' },
            letterSpacing: { xs: '.1em', md: '.14em' },
            lineHeight: 1.15,
          }}
        >
          THALACUVERY BOREWELL
        </Typography>
        <Box sx={{ width: 58, height: 3, borderRadius: 2, bgcolor: '#20bea5' }} />
      </Box>

      {/* ============ the forest drilling site (full bleed) ============ */}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: { xs: 440, md: 540 },
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            display: 'block',
            cursor: 'grab',
            touchAction: 'none',
          }}
        />

        {/* corner site tags (always clickable — navigation fallback) */}
        {renderTag('big')}
        {renderTag('small')}

        {sceneError && (
          <Typography
            sx={{
              position: 'absolute', top: 64, left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 5, pointerEvents: 'none',
              fontFamily: MONO, fontSize: '.58rem', letterSpacing: '.18em',
              color: 'rgba(255,255,255,.6)', whiteSpace: 'nowrap',
            }}
          >
            3D VIEW UNAVAILABLE — USE THE LABELS ABOVE TO SELECT A MACHINE
          </Typography>
        )}

        {/* usage hint */}
        <Typography
          sx={{
            position: 'absolute', bottom: 14, left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 4, pointerEvents: 'none',
            fontFamily: MONO, fontSize: '.54rem', letterSpacing: '.18em',
            color: 'rgba(255,255,255,.38)', whiteSpace: 'nowrap',
            display: { xs: 'none', md: 'block' },
          }}
        >
          DRAG TO LOOK · HOVER A RIG TO DRILL · CLICK TO SELECT
        </Typography>
        <Typography
          sx={{
            position: 'absolute', bottom: 12, left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 4, pointerEvents: 'none',
            fontFamily: MONO, fontSize: '.5rem', letterSpacing: '.18em',
            color: 'rgba(255,255,255,.38)', whiteSpace: 'nowrap',
            display: { xs: 'block', md: 'none' },
          }}
        >
          TAP A MACHINE TO SELECT
        </Typography>
      </Box>
    </Box>
  );
};

export default MachineSelection;