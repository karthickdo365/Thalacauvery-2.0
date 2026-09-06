import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  GlobalStyles,
  Stack,
  Typography,
} from '@mui/material';

import { useMachine } from '../context/MachineContext';
import { NAVY } from '../utils/constants';
import { MACHINES, RigViewer } from '../utils/rig3d';
const MACHINE_CARDS = [
  {
    key: 'big',
    index: '01',
    title: 'BIG MACHINE',
    tagline: 'Heavy-Duty Rig',
    desc: 'Built for deep bores, high-volume output and large-diameter drilling.',
    color: '#16a34a',
  },
  {
    key: 'small',
    index: '02',
    title: 'SMALL MACHINE',
    tagline: 'Compact Rig',
    desc: 'Perfect for narrow sites, quick jobs and tight-access drilling.',
    color: '#d97706',
  },
];

const STORAGE_KEY = 'thalacauvery_machine';

const MachineSelection = () => {
  const navigate = useNavigate();
  const { setMachine } = useMachine();

  const canvasRefs = useRef({});
  const viewers = useRef({});
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const navigatingRef = useRef(false);

  const [hintVisible, setHintVisible] = useState({ big: true, small: true });
  const [lastUsed, setLastUsed] = useState(null);

  // Mount one interactive 3D rig per card, run a single shared render loop,
  // and clean everything up on unmount.
  useEffect(() => {
    try {
      setLastUsed(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      /* localStorage unavailable */
    }

    MACHINE_CARDS.forEach(({ key }) => {
      const canvas = canvasRefs.current[key];
      if (!canvas) return;
      const viewer = new RigViewer({ canvas, machine: key });
      viewer.firstDragCb = () => setHintVisible((prev) => ({ ...prev, [key]: false }));
      viewers.current[key] = viewer;
    });

    lastRef.current = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const t = now / 1000;
      Object.values(viewers.current).forEach((v) => {
        if (v.active && v.w) v.update(dt, t);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      Object.values(viewers.current).forEach((v) => v.dispose());
      viewers.current = {};
    };
  }, []);

  const handleHover = (key, hovered) => {
    viewers.current[key]?.setHover(hovered);
  };

  const handleSelect = (machine) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    viewers.current[machine]?.powerFlash();
    setMachine(machine);
    try {
      localStorage.setItem(STORAGE_KEY, machine);
    } catch (e) {
      /* localStorage unavailable */
    }

    // Let the power-on flash play out briefly before leaving the page.
    setTimeout(() => navigate('/dashboard'), 260);
  };

  return (
    <>
      <GlobalStyles
        styles={{
          '@keyframes fadeSlideUp': {
            '0%': { opacity: 0, transform: 'translateY(28px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' },
          },
          '@keyframes floatSlow': {
            '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
            '50%': { transform: 'translate(-40px, 40px) scale(1.12)' },
          },
        }}
      />

      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',

          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',

          background: `linear-gradient(155deg, #070c16 0%, ${NAVY} 55%, #0a1e19 100%)`,

          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 5, sm: 6 },
        }}
      >
        {/* Grid texture */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,

            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '46px 46px',

            maskImage:
              'radial-gradient(ellipse at 50% 42%, black 0%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at 50% 42%, black 0%, transparent 78%)',

            pointerEvents: 'none',
          }}
        />

        {/* Aurora orbs */}
        <Box
          sx={{
            position: 'absolute',
            width: 520,
            height: 520,
            borderRadius: '50%',
            top: -220,
            right: -160,

            background:
              'radial-gradient(circle, rgba(22,163,74,0.16) 0%, rgba(22,163,74,0) 70%)',

            animation: 'floatSlow 16s ease-in-out infinite',

            pointerEvents: 'none',
          }}
        />

        <Box
          sx={{
            position: 'absolute',
            width: 520,
            height: 520,
            borderRadius: '50%',
            bottom: -220,
            left: -160,

            background:
              'radial-gradient(circle, rgba(217,119,6,0.14) 0%, rgba(217,119,6,0) 70%)',

            animation: 'floatSlow 20s ease-in-out infinite reverse',

            pointerEvents: 'none',
          }}
        />

        {/* Content */}
        <Box
          sx={{
            width: '100%',
            maxWidth: 1080,
            position: 'relative',
            zIndex: 1,

            animation: 'fadeSlideUp 0.6s ease both',
          }}
        >
          {/* Header */}
          <Stack
            alignItems="center"
            spacing={1.5}
            sx={{ textAlign: 'center', mb: { xs: 4, sm: 6 } }}
          >
            <Chip
              label="MACHINE CONTROL"
              sx={{
                bgcolor: 'rgba(32,190,165,0.10)',
                color: '#20bea5',
                border: '1px solid rgba(32,190,165,0.35)',
                borderRadius: 10,

                fontWeight: 700,
                fontSize: { xs: '0.6rem', sm: '0.66rem' },
                letterSpacing: '0.24em',
                px: 1.5,
              }}
            />

            <Typography
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.55rem', sm: '2rem', md: '2.4rem' },
                letterSpacing: { xs: '0.04em', sm: '0.08em' },
                lineHeight: 1.15,

                background:
                  'linear-gradient(100deg, #ffffff 35%, rgba(255,255,255,0.55) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              THALACUVERY BOREWELL
            </Typography>

            <Box
              sx={{
                width: 60,
                height: 3,
                borderRadius: 10,
                background: 'linear-gradient(90deg, #20bea5, rgba(32,190,165,0))',
                mx: 'auto',
              }}
            />

            <Typography
              sx={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: { xs: '0.82rem', sm: '0.92rem' },
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              Which machine are you operating today?
            </Typography>
          </Stack>

          {/* Cards */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 3, md: 4 }}
          >
            {MACHINE_CARDS.map((card, i) => {
              const machineCfg = MACHINES[card.key];

              return (
                <Card
                  key={card.key}
                  elevation={0}
                  className="machine-card"
                  sx={{
                    flex: 1,
                    minWidth: 0,

                    borderRadius: '26px',
                    overflow: 'hidden',

                    bgcolor: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(14px)',
                    border: '1px solid rgba(255,255,255,0.10)',

                    boxShadow: '0 20px 45px rgba(0,0,0,0.35)',

                    transition:
                      'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',

                    animation: `fadeSlideUp 0.6s ${0.15 + i * 0.12}s ease both`,

                    cursor: 'pointer',

                    '&:hover': {
                      transform: 'translateY(-8px)',
                      borderColor: `${card.color}88`,
                      boxShadow: `0 28px 60px rgba(0,0,0,0.45), 0 0 42px ${card.color}33`,
                    },

                    '&:active': {
                      transform: 'translateY(-4px) scale(0.985)',
                    },
                  }}
                  onMouseEnter={() => handleHover(card.key, true)}
                  onMouseLeave={() => handleHover(card.key, false)}
                >
                  <CardActionArea
                    onClick={() => handleSelect(card.key)}
                    sx={{ height: '100%' }}
                  >
                    {/* 3D rig stage */}
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        height: { xs: 235, sm: 275, md: 320 },
                        overflow: 'hidden',
                        bgcolor: '#0a1120',
                      }}
                    >
                      <Box
                        component="canvas"
                        ref={(el) => (canvasRefs.current[card.key] = el)}
                        sx={{
                          width: '100%',
                          height: '100%',
                          display: 'block',
                          touchAction: 'none',
                          cursor: 'grab',
                          '&:active': { cursor: 'grabbing' },
                        }}
                      />

                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          background:
                            'linear-gradient(to top, rgba(7,12,22,0.55) 0%, rgba(7,12,22,0) 42%)',
                          pointerEvents: 'none',
                        }}
                      />

                      {/* Index number */}
                      <Typography
                        sx={{
                          position: 'absolute',
                          top: 14,
                          right: 18,

                          color: 'rgba(255,255,255,0.28)',
                          fontWeight: 800,
                          fontSize: { xs: '1.6rem', sm: '2rem' },
                          letterSpacing: '0.05em',
                          pointerEvents: 'none',
                        }}
                      >
                        {card.index}
                      </Typography>

                      {/* Drag hint */}
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.7}
                        sx={{
                          position: 'absolute',
                          top: 14,
                          left: 16,

                          opacity: hintVisible[card.key] ? 1 : 0,
                          transition: 'opacity 0.7s ease',
                          pointerEvents: 'none',

                          color: 'rgba(255,255,255,0.42)',
                          fontWeight: 600,
                          fontSize: '0.55rem',
                          letterSpacing: '0.24em',
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M21 12a9 9 0 1 1-3.2-6.9M21 3v5.5h-5.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>DRAG · ROTATE</span>
                      </Stack>

                      {/* Last used badge */}
                      {lastUsed === card.key && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 18,
                            right: 16,

                            color: machineCfg.lt,
                            border: `1px solid ${machineCfg.cb}`,
                            bgcolor: 'rgba(0,0,0,0.4)',

                            fontWeight: 600,
                            fontSize: '0.5rem',
                            letterSpacing: '0.2em',
                            px: 1.1,
                            py: 0.5,
                            borderRadius: '7px',
                            pointerEvents: 'none',
                          }}
                        >
                          LAST USED
                        </Box>
                      )}

                      {/* Label pill */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: { xs: 16, sm: 20 },
                          bottom: { xs: 16, sm: 18 },

                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,

                          px: { xs: 1.6, sm: 1.9 },
                          py: { xs: 0.75, sm: 0.95 },
                          borderRadius: '11px',

                          bgcolor: card.color,
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: { xs: '0.74rem', sm: '0.84rem' },
                          letterSpacing: '0.05em',

                          boxShadow: `0 6px 18px ${card.color}66`,
                          pointerEvents: 'none',
                        }}
                      >
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            bgcolor: '#fff',
                            flexShrink: 0,
                            boxShadow: `0 0 0 3px ${card.color}55`,
                          }}
                        />
                        {card.title}
                      </Box>
                    </Box>

                    {/* Body */}
                    <Box sx={{ p: { xs: 2.2, sm: 2.6 } }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mb: 0.5 }}
                      >
                        <Typography
                          sx={{
                            color: card.color,
                            fontWeight: 700,
                            fontSize: { xs: '0.66rem', sm: '0.7rem' },
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {card.tagline}
                        </Typography>

                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: card.color,
                            boxShadow: `0 0 0 4px ${card.color}26`,
                          }}
                        />
                      </Stack>

                      <Typography
                        sx={{
                          color: 'rgba(255,255,255,0.62)',
                          fontSize: { xs: '0.84rem', sm: '0.9rem' },
                          fontWeight: 500,
                          lineHeight: 1.55,
                        }}
                      >
                        {card.desc}
                      </Typography>

                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          mt: 2.2,
                          pt: 2,
                          borderTop: '1px dashed rgba(255,255,255,0.14)',
                        }}
                      >
                        <Typography
                          sx={{
                            color: 'rgba(255,255,255,0.45)',
                            fontWeight: 700,
                            fontSize: '0.68rem',
                            letterSpacing: '0.2em',
                          }}
                        >
                          TAP TO CONTINUE
                        </Typography>

                        <svg
                          className="machine-arrow"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={{
                            transition: 'transform 0.3s ease',
                            flexShrink: 0,
                          }}
                        >
                          <path
                            d="M5 12h13M13 6l6 6-6 6"
                            stroke={card.color}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </Stack>
                    </Box>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>

          {/* Footer */}
          <Typography
            sx={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.30)',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              mt: { xs: 4, sm: 5 },

              animation: 'fadeSlideUp 0.6s 0.45s ease both',
            }}
          >
            Select a machine to continue
          </Typography>
        </Box>
      </Box>
    </>
  );
};

export default MachineSelection;