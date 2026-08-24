// ── Brand palette ─────────────────────────────────────────────────────────────
export const NAVY      = '#0a2540';
export const NAVY_DARK = '#061a30';
export const TEAL      = '#1EBEA5';
export const TEAL_DARK = '#17a391';

// ── Formatters ────────────────────────────────────────────────────────────────
export const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const fmtINR = (v) => `₹${toNum(v).toLocaleString('en-IN')}`;

// ── Payment status chip colors ────────────────────────────────────────────────
const STATUS_COLORS = {
  Paid:    { bgcolor: '#dcfce7', color: '#166534' },
  Unpaid:  { bgcolor: '#fee2e2', color: '#991b1b' },
  Partial: { bgcolor: '#fef9c3', color: '#854d0e' },
  Other:   { bgcolor: '#ede9fe', color: '#5b21b6' },
};
export const statusColor = (s) => STATUS_COLORS[s] || {};

export const machineChipSx = (isBig) => ({
  bgcolor: isBig ? `${TEAL}20` : '#f1f5f9',
  color: isBig ? TEAL_DARK : '#475569',
  fontWeight: 700,
});

// ── Depth slabs (single source of truth for rate cards AND billing) ───────────
const buildSlabs = (first, max) => {
  const slabs = [first];
  for (let from = first.to; from < max; from += 100) {
    slabs.push({ range: `${from}-${from + 100} Feet`, from, to: from + 100 });
  }
  return slabs;
};

export const SMALL_DEPTH_SLABS = buildSlabs({ range: '0-200 Feet', from: 0, to: 200 }, 1500);
export const BIG_DEPTH_SLABS   = buildSlabs({ range: '1-300 Feet', from: 0, to: 300 }, 1800);

export const SMALL_DEPTH_RANGES = SMALL_DEPTH_SLABS.map((s) => s.range);
export const BIG_DEPTH_RANGES   = BIG_DEPTH_SLABS.map((s) => s.range);

// ── Pipe definitions per machine type ─────────────────────────────────────────
// rateKey = field on the agent rate card, feetKey = field on the bill entry
export const SMALL_PIPES = [
  { rateKey: 'outerPipe',      feetKey: 'outerPipeFeet', label: 'Outer Pipe' },
  { rateKey: 'innerPipe',      feetKey: 'innerPipeFeet', label: 'Inner Pipe' },
  { rateKey: 'smallInnerPipe', feetKey: 'smallPipeFeet', label: 'Small Inner Pipe' },
];

export const BIG_PIPES = [
  { rateKey: 'plasticOuter', feetKey: 'plasticOuterFeet', label: 'Plastic Outer' },
  { rateKey: 'plasticInner', feetKey: 'plasticInnerFeet', label: 'Plastic Inner' },
  { rateKey: 'jiOuter',      feetKey: 'jiOuterFeet',      label: 'JI Outer' },
  { rateKey: 'jiInner',      feetKey: 'jiInnerFeet',      label: 'JI Inner' },
];
