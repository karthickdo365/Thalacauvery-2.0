import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';

import PeopleIcon from '@mui/icons-material/People';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import PaidIcon from '@mui/icons-material/Paid';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import DiscountIcon from '@mui/icons-material/Discount';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import ConstructionIcon from '@mui/icons-material/Construction';
import BuildIcon from '@mui/icons-material/Build';

import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

import { Bar, Doughnut } from 'react-chartjs-2';

import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

import { fetchDashboardStats } from '../redux/slices/dashboardSlice';
import { useMachine } from '../context/MachineContext';

import api from '../utils/api';
import PageHeader from '../components/PageHeader';

import {
  NAVY,
  TEAL,
  TEAL_DARK as TEAL_D,
  toNum as safeNum,
  fmtINR as fmtSafe,
  statusColor,
} from '../utils/constants';

dayjs.extend(isoWeek);

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const fmt = fmtSafe;

/* =========================================================
   HELPERS
========================================================= */

const filterByPeriod = (
  rows,
  period,
  dateField = 'date'
) => {
  if (!period || period === 'all') {
    return rows;
  }

  const now = dayjs();

  return rows.filter((row) => {
    const date = dayjs(row?.[dateField]);

    if (!date.isValid()) {
      return true;
    }

    if (period === 'week') {
      return date.isSame(now, 'week');
    }

    if (period === 'month') {
      return date.isSame(now, 'month');
    }

    if (period === 'year') {
      return date.isSame(now, 'year');
    }

    return true;
  });
};

const getMaterialType = (material) => {
  return String(
    material?.type ||
      material?.materialType ||
      material?.name ||
      ''
  )
    .trim()
    .toLowerCase();
};

const isMaterialType = (
  material,
  type
) => {
  const materialType =
    getMaterialType(material);

  return (
    materialType === type ||
    materialType.includes(type)
  );
};

const getDiscount = (point) => {
  return safeNum(
    point?.discountAmount ??
      point?.discount ??
      point?.discountValue ??
      point?.breakdown?.discountAmount ??
      0
  );
};

const getPaidAmount = (point) => {
  if (
    point?.paymentStatus ===
    'Paid'
  ) {
    return safeNum(
      point?.totalAmount
    );
  }

  return safeNum(
    point?.paidAmount
  );
};

const getPendingAmount = (point) => {
  const total = safeNum(
    point?.totalAmount
  );

  if (
    point?.paymentStatus ===
    'Unpaid'
  ) {
    return total;
  }

  const paid = safeNum(
    point?.paidAmount
  );

  return Math.max(
    0,
    total - paid
  );
};

/* =========================================================
   PERIOD OPTIONS
========================================================= */

const PERIOD_OPTIONS = [
  {
    value: 'all',
    label: 'All',
  },
  {
    value: 'week',
    label: 'Week',
  },
  {
    value: 'month',
    label: 'Month',
  },
  {
    value: 'year',
    label: 'Year',
  },
];

/* =========================================================
   CARD CONFIG
========================================================= */

const CARD_CONFIG = {
  totalBorewellPoints: {
    label: 'Points',
    color: NAVY,
    icon: <WaterDropIcon />,
    hasPeriodFilter: true,

    fetch: (machineType) =>
      api.get(
        '/borewell-points',
        {
          params: {
            limit: 500,
            machineType,
          },
        }
      ),

    extract: (data) =>
      data?.points || [],

    columns: [
      'Date',
      'Party',
      'Broker',
      'Total',
      'Status',
    ],

    render: (point) => [
      dayjs(
        point?.date
      ).format('DD/MM/YYYY'),

      point?.partyName ||
        '—',

      point?.brokerId?.name ||
        '—',

      fmtSafe(
        point?.totalAmount
      ),

      point?.paymentStatus ||
        'Unpaid',
    ],

    chipCol: 4,
  },

  paidAmount: {
    label: 'Paid Amount',
    color: '#2e7d32',
    icon: <PaidIcon />,
    hasPeriodFilter: true,

    fetch: (machineType) =>
      api.get(
        '/borewell-points',
        {
          params: {
            limit: 500,
            machineType,
          },
        }
      ),

    extract: (data) =>
      (data?.points || []).filter(
        (point) =>
          point?.paymentStatus ===
            'Paid' ||
          point?.paymentStatus ===
            'Partial'
      ),

    columns: [
      'Date',
      'Party',
      'Broker',
      'Total',
      'Paid',
      'Status',
    ],

    render: (point) => [
      dayjs(
        point?.date
      ).format('DD/MM/YYYY'),

      point?.partyName ||
        '—',

      point?.brokerId?.name ||
        '—',

      fmtSafe(
        point?.totalAmount
      ),

      fmtSafe(
        getPaidAmount(point)
      ),

      point?.paymentStatus ||
        'Unpaid',
    ],

    chipCol: 5,
  },

  pendingAmount: {
    label: 'Pending Amount',
    color: '#b91c1c',
    icon: <PendingActionsIcon />,
    hasPeriodFilter: true,

    fetch: (machineType) =>
      api.get(
        '/borewell-points',
        {
          params: {
            limit: 500,
            machineType,
          },
        }
      ),

    extract: (data) =>
      (data?.points || []).filter(
        (point) =>
          point?.paymentStatus ===
            'Unpaid' ||
          point?.paymentStatus ===
            'Partial'
      ),

    columns: [
      'Date',
      'Party',
      'Broker',
      'Total',
      'Pending',
      'Status',
    ],

    render: (point) => [
      dayjs(
        point?.date
      ).format('DD/MM/YYYY'),

      point?.partyName ||
        '—',

      point?.brokerId?.name ||
        '—',

      fmtSafe(
        point?.totalAmount
      ),

      fmtSafe(
        getPendingAmount(point)
      ),

      point?.paymentStatus ||
        'Unpaid',
    ],

    chipCol: 5,
  },

  discount: {
    label: 'Discount',
    color: '#7c3aed',
    icon: <DiscountIcon />,
    hasPeriodFilter: true,

    fetch: (machineType) =>
      api.get(
        '/borewell-points',
        {
          params: {
            limit: 500,
            machineType,
          },
        }
      ),

    extract: (data) =>
      (data?.points || []).filter(
        (point) =>
          getDiscount(point) > 0
      ),

    columns: [
      'Date',
      'Party',
      'Broker',
      'Total',
      'Discount',
    ],

    render: (point) => [
      dayjs(
        point?.date
      ).format('DD/MM/YYYY'),

      point?.partyName ||
        '—',

      point?.brokerId?.name ||
        '—',

      fmtSafe(
        point?.totalAmount
      ),

      fmtSafe(
        getDiscount(point)
      ),
    ],
  },

  diesel: {
    label: 'Diesel',
    color: '#2563eb',
    icon: <LocalGasStationIcon />,
    hasPeriodFilter: true,

    fetch: (machineType) =>
      api.get(
        '/materials',
        {
          params: {
            limit: 500,
            machineType,
          },
        }
      ),

    extract: (data) =>
      (data?.materials || []).filter(
        (material) =>
          isMaterialType(
            material,
            'diesel'
          )
      ),

    columns: [
      'Date',
      'Type',
      'Quantity',
      'Cost/L',
      'Total Amount',
    ],

    render: (material) => [
      dayjs(
        material?.date
      ).format('DD/MM/YYYY'),

      material?.type ||
        'Diesel',

      safeNum(
        material?.quantity
      ) || '—',

      material?.costPerLiter !=
      null
        ? fmtSafe(
            material.costPerLiter
          )
        : '—',

      fmtSafe(
        material?.totalPrice
      ),
    ],

    totalField:
      'totalPrice',
  },

  petrol: {
    label: 'Petrol',
    color: '#ea580c',
    icon: <LocalGasStationIcon />,
    hasPeriodFilter: true,

    fetch: (machineType) =>
      api.get(
        '/materials',
        {
          params: {
            limit: 500,
            machineType,
          },
        }
      ),

    extract: (data) =>
      (data?.materials || []).filter(
        (material) =>
          isMaterialType(
            material,
            'petrol'
          )
      ),

    columns: [
      'Date',
      'Type',
      'Quantity',
      'Cost/L',
      'Total Amount',
    ],

    render: (material) => [
      dayjs(
        material?.date
      ).format('DD/MM/YYYY'),

      material?.type ||
        'Petrol',

      safeNum(
        material?.quantity
      ) || '—',

      material?.costPerLiter !=
      null
        ? fmtSafe(
            material.costPerLiter
          )
        : '—',

      fmtSafe(
        material?.totalPrice
      ),
    ],

    totalField:
      'totalPrice',
  },

  bit: {
    label: 'Bit',
    color: '#0891b2',
    icon: <ConstructionIcon />,
    hasPeriodFilter: true,

    fetch: (machineType) =>
      api.get(
        '/materials',
        {
          params: {
            limit: 500,
            machineType,
          },
        }
      ),

    extract: (data) =>
      (data?.materials || []).filter(
        (material) =>
          isMaterialType(
            material,
            'bit'
          )
      ),

    columns: [
      'Date',
      'Type',
      'Quantity',
      'Cost',
      'Total Amount',
    ],

    render: (material) => [
      dayjs(
        material?.date
      ).format('DD/MM/YYYY'),

      material?.type ||
        'Bit',

      safeNum(
        material?.quantity
      ) || '—',

      material?.costPerLiter !=
      null
        ? fmtSafe(
            material.costPerLiter
          )
        : '—',

      fmtSafe(
        material?.totalPrice
      ),
    ],

    totalField:
      'totalPrice',
  },

  hammer: {
    label: 'Hammer',
    color: '#92400e',
    icon: <BuildIcon />,
    hasPeriodFilter: true,

    fetch: (machineType) =>
      api.get(
        '/materials',
        {
          params: {
            limit: 500,
            machineType,
          },
        }
      ),

    extract: (data) =>
      (data?.materials || []).filter(
        (material) =>
          isMaterialType(
            material,
            'hammer'
          )
      ),

    columns: [
      'Date',
      'Type',
      'Quantity',
      'Cost',
      'Total Amount',
    ],

    render: (material) => [
      dayjs(
        material?.date
      ).format('DD/MM/YYYY'),

      material?.type ||
        'Hammer',

      safeNum(
        material?.quantity
      ) || '—',

      material?.costPerLiter !=
      null
        ? fmtSafe(
            material.costPerLiter
          )
        : '—',

      fmtSafe(
        material?.totalPrice
      ),
    ],

    totalField:
      'totalPrice',
  },

  totalEmployees: {
    label: 'Employee',
    color: '#059669',
    icon: <PeopleIcon />,
    hasPeriodFilter: false,

    fetch: (machineType) =>
      api.get(
        '/users',
        {
          params: {
            type: 'Employee',
            limit: 100,
            machineType,
          },
        }
      ),

    extract: (data) =>
      data?.users || [],

    columns: [
      'Name',
      'Phone',
      'Salary',
      'Date',
    ],

    render: (user) => [
      user?.name ||
        '—',

      user?.phone ||
        '—',

      user?.salary
        ? fmtSafe(
            user.salary
          )
        : '—',

      user?.date
        ? dayjs(
            user.date
          ).format(
            'DD/MM/YYYY'
          )
        : '—',
    ],
  },
};

/* =========================================================
   DASHBOARD CARD ORDER
========================================================= */

const FIRST_ROW = [
  {
    key: 'totalBorewellPoints',
    currency: false,
  },

  {
    key: 'paidAmount',
    currency: true,
  },

  {
    key: 'pendingAmount',
    currency: true,
  },

  {
    key: 'discount',
    currency: true,
  },
];

const SECOND_ROW = [
  {
    key: 'diesel',
    currency: true,
  },

  {
    key: 'petrol',
    currency: true,
  },

  {
    key: 'bit',
    currency: true,
  },

  {
    key: 'hammer',
    currency: true,
  },
];

/* =========================================================
   STAT CARD
========================================================= */

const StatCard = ({
  title,
  value,
  icon,
  color,
  onClick,
}) => (
  <Card
    onClick={onClick}
    elevation={0}
    sx={{
      height: '100%',
      cursor: 'pointer',

      border:
        '1px solid #dbe3ec',

      borderRadius: '12px',

      bgcolor: '#fff',

      transition:
        'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',

      '&:hover': {
        transform:
          'translateY(-3px)',

        boxShadow:
          `0 8px 24px ${color}22`,

        borderColor:
          `${color}66`,
      },

      '&:active': {
        transform:
          'translateY(-1px)',
      },
    }}
  >
    <CardContent
      sx={{
        display: 'flex',
        alignItems: 'center',

        gap: 1.5,

        p: '14px !important',

        minHeight: 74,
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 46,
          height: 46,

          borderRadius: '10px',

          bgcolor: `${color}18`,
          color,

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',

          flexShrink: 0,

          '& svg': {
            fontSize: 24,
          },
        }}
      >
        {icon}
      </Box>

      {/* Text */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <Typography
          sx={{
            color: '#64748b',

            fontSize:
              '0.72rem',

            fontWeight: 500,

            letterSpacing:
              '0.02em',

            mb: 0.25,

            textTransform:
              'none',
          }}
        >
          {title}
        </Typography>

        <Typography
          sx={{
            color: '#0f172a',

            fontWeight: 700,

            fontSize:
              '1.05rem',

            lineHeight: 1.2,

            whiteSpace:
              'nowrap',

            overflow:
              'hidden',

            textOverflow:
              'ellipsis',
          }}
        >
          {value}
        </Typography>
      </Box>

      {/* Arrow */}
      <ArrowForwardIosIcon
        sx={{
          fontSize: 12,
          color: '#cbd5e1',
        }}
      />
    </CardContent>
  </Card>
);

/* =========================================================
   CHART CARD
========================================================= */

const ChartCard = ({
  title,
  children,
}) => (
  <Card
    elevation={0}
    sx={{
      height: '100%',

      border:
        '1px solid #dbe3ec',

      borderRadius:
        '14px',

      bgcolor: '#fff',
    }}
  >
    <CardContent
      sx={{
        p: '16px !important',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',

          gap: 1,

          mb: 1.5,
        }}
      >
        <Box
          sx={{
            width: 3,
            height: 16,

            bgcolor: TEAL,

            borderRadius: 1,
          }}
        />

        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{
            color:
              'text.primary',
          }}
        >
          {title}
        </Typography>
      </Box>

      {children}
    </CardContent>
  </Card>
);

/* =========================================================
   CHART LEGEND
========================================================= */

const ChartLegend = ({
  items,
}) => (
  <Box
    sx={{
      display: 'flex',
      gap: 1.5,

      flexWrap: 'wrap',

      mb: 1,
    }}
  >
    {items.map(
      ({
        color,
        label,
      }) => (
        <Box
          key={label}
          sx={{
            display:
              'flex',

            alignItems:
              'center',

            gap: 0.5,
          }}
        >
          <Box
            sx={{
              width: 9,
              height: 9,

              borderRadius:
                '2px',

              bgcolor: color,
            }}
          />

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontSize:
                '0.7rem',
            }}
          >
            {label}
          </Typography>
        </Box>
      )
    )}
  </Box>
);

/* =========================================================
   SEARCH HIGHLIGHT
========================================================= */

const HighlightText = ({
  text,
  search,
}) => {
  const value =
    String(text);

  const index =
    value
      .toLowerCase()
      .indexOf(
        search.toLowerCase()
      );

  if (index === -1) {
    return <>{value}</>;
  }

  return (
    <>
      {value.slice(
        0,
        index
      )}

      <Box
        component="mark"
        sx={{
          bgcolor:
            `${TEAL}40`,

          color:
            'inherit',

          borderRadius:
            '3px',

          px: '2px',

          fontWeight: 700,
        }}
      >
        {value.slice(
          index,
          index +
            search.length
        )}
      </Box>

      {value.slice(
        index +
          search.length
      )}
    </>
  );
};

/* =========================================================
   DETAIL DIALOG
========================================================= */

const DetailDialog = ({
  open,
  onClose,
  cardKey,
  summaryValue,
  machineType,
}) => {
  const [allRows, setAllRows] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [period, setPeriod] =
    useState('all');

  const config =
    CARD_CONFIG[cardKey];

  const load =
    useCallback(
      async () => {
        if (
          !cardKey ||
          !config
        ) {
          return;
        }

        setLoading(true);

        try {
          const {
            data,
          } =
            await config.fetch(
              machineType
            );

          const rows =
            config.extract(
              data
            );

          setAllRows(
            Array.isArray(
              rows
            )
              ? rows
              : []
          );
        } catch (
          error
        ) {
          console.error(
            'Failed to load details:',
            error
          );

          setAllRows([]);
        } finally {
          setLoading(false);
        }
      },
      [
        cardKey,
        machineType,
      ]
    );

  useEffect(() => {
    if (open) {
      setSearch('');
      setPeriod('all');

      load();
    } else {
      setAllRows([]);
      setSearch('');
      setPeriod('all');
    }
  }, [
    open,
    load,
  ]);

  if (!config) {
    return null;
  }

  /* -------------------------------------------------------
     Period
  ------------------------------------------------------- */

  const periodRows =
    filterByPeriod(
      allRows,
      period
    );

  /* -------------------------------------------------------
     Search
  ------------------------------------------------------- */

  const filteredRows =
    search.trim()
      ? periodRows.filter(
          (row) => {
            const cells =
              config.render(
                row
              );

            return cells.some(
              (cell) =>
                String(
                  cell
                )
                  .toLowerCase()
                  .includes(
                    search
                      .toLowerCase()
                  )
            );
          }
        )
      : periodRows;

  /* -------------------------------------------------------
     Currency cards
  ------------------------------------------------------- */

  const isCurrencyCard =
    [
      'paidAmount',
      'pendingAmount',
      'discount',
      'diesel',
      'petrol',
      'bit',
      'hammer',
    ].includes(
      cardKey
    );

  /* -------------------------------------------------------
     Filtered total
  ------------------------------------------------------- */

  const filteredTotal =
    filteredRows.reduce(
      (sum, row) => {
        if (
          cardKey ===
          'paidAmount'
        ) {
          return (
            sum +
            getPaidAmount(
              row
            )
          );
        }

        if (
          cardKey ===
          'pendingAmount'
        ) {
          return (
            sum +
            getPendingAmount(
              row
            )
          );
        }

        if (
          cardKey ===
          'discount'
        ) {
          return (
            sum +
            getDiscount(
              row
            )
          );
        }

        if (
          [
            'diesel',
            'petrol',
            'bit',
            'hammer',
          ].includes(
            cardKey
          )
        ) {
          return (
            sum +
            safeNum(
              row?.totalPrice
            )
          );
        }

        return sum;
      },
      0
    );

  /* -------------------------------------------------------
     Search placeholder
  ------------------------------------------------------- */

  const searchPlaceholder =
    {
      totalBorewellPoints:
        'Search by party, broker, status…',

      paidAmount:
        'Search by party, broker…',

      pendingAmount:
        'Search by party, broker…',

      discount:
        'Search by party, broker…',

      diesel:
        'Search diesel records…',

      petrol:
        'Search petrol records…',

      bit:
        'Search bit records…',

      hammer:
        'Search hammer records…',

      totalEmployees:
        'Search by name, phone…',
    }[cardKey] ||
    'Search…';

  const periodLabel =
    {
      all: 'All time',

      week: 'This week',

      month: 'This month',

      year: 'This year',
    }[period];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius:
            '16px',

          overflow:
            'hidden',
        },
      }}
    >
      {/* =================================================
          DIALOG HEADER
      ================================================= */}

      <DialogTitle
        sx={{
          bgcolor: NAVY,

          color: '#fff',

          p: 0,

          borderBottom:
            `3px solid ${config.color}`,
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 2,

            display: 'flex',

            alignItems:
              'center',

            justifyContent:
              'space-between',

            gap: 2,
          }}
        >
          {/* Left */}
          <Box
            sx={{
              display:
                'flex',

              alignItems:
                'center',

              gap: 1.5,
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,

                borderRadius:
                  '9px',

                bgcolor:
                  `${config.color}22`,

                color:
                  config.color,

                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'center',
              }}
            >
              {config.icon}
            </Box>

            <Box>
              <Typography
                fontWeight={700}
                fontSize="1rem"
              >
                {config.label}
              </Typography>

              <Typography
                sx={{
                  color:
                    'rgba(255,255,255,0.5)',

                  fontSize:
                    '0.75rem',

                  mt: 0.2,
                }}
              >
                {loading
                  ? 'Loading…'
                  : `${
                      machineType ===
                      'big'
                        ? 'Big Machine'
                        : 'Small Machine'
                    } · ${
                      filteredRows.length
                    } of ${
                      allRows.length
                    } records · ${
                      periodLabel
                    }`}
              </Typography>
            </Box>
          </Box>

          {/* Right */}
          <Box
            sx={{
              display:
                'flex',

              alignItems:
                'center',

              gap: 2,
            }}
          >
            {summaryValue && (
              <Typography
                sx={{
                  color:
                    config.color,

                  fontWeight: 800,

                  fontSize:
                    '1.05rem',
                }}
              >
                {summaryValue}
              </Typography>
            )}

            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                color:
                  '#fff',
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* =================================================
            FILTERS
        ================================================= */}

        <Box
          sx={{
            px: 3,
            pb: 2,

            display:
              'flex',

            flexDirection:
              'column',

            gap: 1.5,
          }}
        >
          {config.hasPeriodFilter && (
            <ToggleButtonGroup
              value={period}
              exclusive
              onChange={(
                _,
                value
              ) => {
                if (value) {
                  setPeriod(
                    value
                  );
                }
              }}
              size="small"
              sx={{
                bgcolor:
                  'rgba(255,255,255,0.07)',

                borderRadius:
                  '8px',

                width:
                  'fit-content',

                '& .MuiToggleButton-root':
                  {
                    color:
                      'rgba(255,255,255,0.55)',

                    border:
                      'none',

                    borderRadius:
                      '7px !important',

                    px: 2,

                    py: 0.5,

                    fontSize:
                      '0.75rem',

                    fontWeight: 600,

                    textTransform:
                      'none',

                    '&.Mui-selected':
                      {
                        bgcolor:
                          TEAL,

                        color:
                          '#fff',

                        '&:hover':
                          {
                            bgcolor:
                              TEAL_D,
                          },
                      },

                    '&:hover':
                      {
                        bgcolor:
                          'rgba(255,255,255,0.1)',
                      },
                  },
              }}
            >
              {PERIOD_OPTIONS.map(
                (option) => (
                  <ToggleButton
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </ToggleButton>
                )
              )}
            </ToggleButtonGroup>
          )}

          <TextField
            fullWidth
            size="small"
            placeholder={
              searchPlaceholder
            }
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            autoComplete="off"
            InputProps={{
              startAdornment:
                (
                  <InputAdornment position="start">
                    <SearchIcon
                      sx={{
                        color:
                          'rgba(255,255,255,0.5)',

                        fontSize:
                          18,
                      }}
                    />
                  </InputAdornment>
                ),

              endAdornment:
                search ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() =>
                        setSearch(
                          ''
                        )
                      }
                      sx={{
                        color:
                          'rgba(255,255,255,0.5)',
                      }}
                    >
                      <CloseIcon
                        fontSize="small"
                      />
                    </IconButton>
                  </InputAdornment>
                ) : null,
            }}
            sx={{
              '& .MuiOutlinedInput-root':
                {
                  bgcolor:
                    'rgba(255,255,255,0.08)',

                  borderRadius:
                    '8px',

                  color:
                    '#fff',

                  '& fieldset':
                    {
                      borderColor:
                        'rgba(255,255,255,0.15)',
                    },

                  '&:hover fieldset':
                    {
                      borderColor:
                        'rgba(30,190,165,0.5)',
                    },

                  '&.Mui-focused fieldset':
                    {
                      borderColor:
                        TEAL,
                    },
                },

              '& input':
                {
                  color:
                    '#fff',
                },

              '& input::placeholder':
                {
                  color:
                    'rgba(255,255,255,0.35)',

                  opacity: 1,
                },
            }}
          />
        </Box>
      </DialogTitle>

      {/* =================================================
          TABLE
      ================================================= */}

      <DialogContent
        sx={{
          p: 0,

          bgcolor:
            'background.default',
        }}
      >
        {loading ? (
          <Box
            sx={{
              display:
                'flex',

              justifyContent:
                'center',

              py: 7,
            }}
          >
            <CircularProgress
              sx={{
                color:
                  TEAL,
              }}
            />
          </Box>
        ) : filteredRows.length ===
          0 ? (
          <Box
            sx={{
              textAlign:
                'center',

              py: 7,

              px: 2,
            }}
          >
            <Typography
              color="text.secondary"
              fontWeight={600}
            >
              {search
                ? `No results for "${search}"`
                : `No records for ${periodLabel.toLowerCase()}`}
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
            >
              {search
                ? 'Try a different search term'
                : 'Try a different time period'}
            </Typography>
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            sx={{
              boxShadow:
                'none',

              borderRadius:
                0,
            }}
          >
            <Table
              size="small"
              stickyHeader
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      width: 40,
                    }}
                  >
                    #
                  </TableCell>

                  {config.columns.map(
                    (column) => (
                      <TableCell
                        key={
                          column
                        }
                        sx={{
                          fontWeight:
                            700,
                        }}
                      >
                        {column}
                      </TableCell>
                    )
                  )}
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredRows.map(
                  (
                    row,
                    index
                  ) => {
                    const cells =
                      config.render(
                        row
                      );

                    return (
                      <TableRow
                        key={
                          row?._id ||
                          row?.id ||
                          index
                        }
                        hover
                      >
                        <TableCell
                          sx={{
                            color:
                              'text.secondary',

                            fontSize:
                              '0.78rem',
                          }}
                        >
                          {index +
                            1}
                        </TableCell>

                        {cells.map(
                          (
                            cell,
                            cellIndex
                          ) => (
                            <TableCell
                              key={
                                cellIndex
                              }
                              sx={{
                                fontSize:
                                  '0.82rem',
                              }}
                            >
                              {config.chipCol ===
                              cellIndex ? (
                                <Chip
                                  label={
                                    cell
                                  }
                                  size="small"
                                  sx={{
                                    ...statusColor(
                                      cell
                                    ),

                                    fontWeight:
                                      600,

                                    fontSize:
                                      '0.7rem',

                                    height:
                                      20,
                                  }}
                                />
                              ) : search &&
                                String(
                                  cell
                                )
                                  .toLowerCase()
                                  .includes(
                                    search.toLowerCase()
                                  ) ? (
                                <HighlightText
                                  text={String(
                                    cell
                                  )}
                                  search={
                                    search
                                  }
                                />
                              ) : (
                                cell
                              )}
                            </TableCell>
                          )
                        )}
                      </TableRow>
                    );
                  }
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* =================================================
            DIALOG FOOTER
        ================================================= */}

        {!loading &&
          filteredRows.length >
            0 && (
            <Box
              sx={{
                px: 3,
                py: 1.5,

                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'space-between',

                bgcolor:
                  'background.default',

                borderTop: 1,

                borderColor:
                  'divider',
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
              >
                {filteredRows.length <
                allRows.length
                  ? `${filteredRows.length} of ${allRows.length} records`
                  : `${allRows.length} total records`}
              </Typography>

              {isCurrencyCard && (
                <Box
                  sx={{
                    bgcolor:
                      NAVY,

                    borderRadius:
                      '10px',

                    px: 3,
                    py: 1.2,

                    display:
                      'flex',

                    alignItems:
                      'center',

                    gap: 2,
                  }}
                >
                  <Typography
                    sx={{
                      color:
                        'rgba(255,255,255,0.6)',

                      fontSize:
                        '0.78rem',
                    }}
                  >
                    {period !==
                      'all' ||
                    search
                      ? 'Filtered Total'
                      : 'Total'}
                  </Typography>

                  <Typography
                    sx={{
                      color:
                        TEAL,

                      fontWeight:
                        800,

                      fontSize:
                        '1.05rem',
                    }}
                  >
                    {period !==
                      'all' ||
                    search
                      ? fmtSafe(
                          filteredTotal
                        )
                      : summaryValue}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
      </DialogContent>
    </Dialog>
  );
};

/* =========================================================
   DASHBOARD
========================================================= */

const Dashboard = () => {
  const dispatch =
    useDispatch();

  const {
    stats,
    charts,
    loading,
  } = useSelector(
    (state) =>
      state.dashboard
  );

  const [
    activeCard,
    setActiveCard,
  ] = useState(null);

  const [
    dialogOpen,
    setDialogOpen,
  ] = useState(false);

  const [
    materialRows,
    setMaterialRows,
  ] = useState([]);

  const [
    pointRows,
    setPointRows,
  ] = useState([]);

  const {
    currentMachine,
  } = useMachine();

  /* =======================================================
     FETCH DASHBOARD STATS
  ======================================================= */

  useEffect(() => {
    if (
      currentMachine ===
        'big' ||
      currentMachine ===
        'small'
    ) {
      dispatch(
        fetchDashboardStats(
          currentMachine
        )
      );
    }
  }, [
    dispatch,
    currentMachine,
  ]);

  /* =======================================================
     FETCH MATERIALS
  ======================================================= */

  useEffect(() => {
    if (
      currentMachine !==
        'big' &&
      currentMachine !==
        'small'
    ) {
      return;
    }

    const loadMaterials =
      async () => {
        try {
          const {
            data,
          } = await api.get(
            '/materials',
            {
              params: {
                limit: 500,
                machineType:
                  currentMachine,
              },
            }
          );

          setMaterialRows(
            data?.materials ||
              []
          );
        } catch (
          error
        ) {
          console.error(
            'Failed to load materials:',
            error
          );

          setMaterialRows(
            []
          );
        }
      };

    loadMaterials();
  }, [
    currentMachine,
  ]);

  /* =======================================================
     FETCH POINTS
  ======================================================= */

  useEffect(() => {
    if (
      currentMachine !==
        'big' &&
      currentMachine !==
        'small'
    ) {
      return;
    }

    const loadPoints =
      async () => {
        try {
          const {
            data,
          } = await api.get(
            '/borewell-points',
            {
              params: {
                limit: 500,
                machineType:
                  currentMachine,
              },
            }
          );

          setPointRows(
            data?.points ||
              []
          );
        } catch (
          error
        ) {
          console.error(
            'Failed to load points:',
            error
          );

          setPointRows([]);
        }
      };

    loadPoints();
  }, [
    currentMachine,
  ]);

  /* =======================================================
     CARD CLICK
  ======================================================= */

  const handleCardClick =
    (key) => {
      setActiveCard(key);
      setDialogOpen(true);
    };

  /* =======================================================
     MACHINE NOT SELECTED
  ======================================================= */

  if (!currentMachine) {
    return (
      <Box
        sx={{
          display:
            'flex',

          justifyContent:
            'center',

          mt: 8,

          px: 2,
        }}
      >
        <Card
          elevation={0}
          sx={{
            maxWidth: 520,

            width: '100%',

            border:
              '1px solid #dbe3ec',

            borderRadius:
              '14px',
          }}
        >
          <CardContent
            sx={{
              textAlign:
                'center',

              py: 5,
            }}
          >
            <DashboardIcon
              sx={{
                fontSize: 42,

                color: TEAL,

                mb: 1,
              }}
            />

            <Typography
              variant="h6"
              fontWeight={700}
            >
              Select a machine
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
              }}
            >
              Select Big Machine
              or Small Machine
              to view its
              dashboard.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    loading ||
    !stats
  ) {
    return (
      <Box
        sx={{
          display:
            'flex',

          justifyContent:
            'center',

          mt: 8,
        }}
      >
        <CircularProgress
          sx={{
            color: TEAL,
          }}
        />
      </Box>
    );
  }

  /* =======================================================
     DASHBOARD VALUES
  ======================================================= */

  const points =
    stats?.totalBorewellPoints ??
    stats?.points ??
    0;

  const paidAmount =
    stats?.paidAmount ??
    0;

  const pendingAmount =
    stats?.pendingAmount ??
    0;

  /* -------------------------------------------------------
     Discount
  ------------------------------------------------------- */

  const discountFromStats =
    stats?.discount ??
    stats?.discountAmount;

  const discount =
    discountFromStats !=
    null
      ? safeNum(
          discountFromStats
        )
      : pointRows.reduce(
          (
            sum,
            point
          ) =>
            sum +
            getDiscount(
              point
            ),
          0
        );

  /* -------------------------------------------------------
     Material TOTAL AMOUNTS
  ------------------------------------------------------- */

  const getMaterialTotal =
    (type) =>
      materialRows
        .filter(
          (material) =>
            isMaterialType(
              material,
              type
            )
        )
        .reduce(
          (
            sum,
            material
          ) =>
            sum +
            safeNum(
              material?.totalPrice
            ),
          0
        );

  const diesel =
    stats?.diesel !=
    null
      ? safeNum(
          stats.diesel
        )
      : getMaterialTotal(
          'diesel'
        );

  const petrol =
    stats?.petrol !=
    null
      ? safeNum(
          stats.petrol
        )
      : getMaterialTotal(
          'petrol'
        );

  const bit =
    stats?.bit !=
    null
      ? safeNum(
          stats.bit
        )
      : getMaterialTotal(
          'bit'
        );

  const hammer =
    stats?.hammer !=
    null
      ? safeNum(
          stats.hammer
        )
      : getMaterialTotal(
          'hammer'
        );

  const employees =
    stats?.totalEmployees ??
    stats?.employee ??
    0;

  /* =======================================================
     CHART DATA
  ======================================================= */

  const expenseData = {
    labels:
      charts?.monthlyExpense?.map(
        (item) =>
          item.month
      ) || [],

    datasets: [
      {
        label:
          'Monthly Expense (₹)',

        data:
          charts?.monthlyExpense?.map(
            (item) =>
              item.amount
          ) || [],

        backgroundColor:
          NAVY,

        borderRadius: 5,
      },
    ],
  };

  const workData = {
    labels:
      charts?.borewellWork?.map(
        (item) =>
          item.month
      ) || [],

    datasets: [
      {
        label:
          'Borewell Works',

        data:
          charts?.borewellWork?.map(
            (item) =>
              item.count
          ) || [],

        backgroundColor:
          TEAL,

        borderRadius: 5,
      },
    ],
  };

  const paymentData = {
    labels:
      charts?.paymentStatus?.map(
        (item) =>
          item.status
      ) || [],

    datasets: [
      {
        data:
          charts?.paymentStatus?.map(
            (item) =>
              item.count
          ) || [],

        backgroundColor: [
          '#4caf50',
          '#ef4444',
          '#f59e0b',
        ],

        borderWidth: 0,
      },
    ],
  };

  const barOptions =
    (yFormatter) => ({
      responsive: true,

      maintainAspectRatio:
        false,

      plugins: {
        legend: {
          display: false,
        },

        tooltip: {
          callbacks: {
            label:
              (context) =>
                ` ${context.dataset.label}: ${context.parsed.y}`,
          },
        },
      },

      scales: {
        x: {
          grid: {
            display: false,
          },

          ticks: {
            font: {
              size: 11,
            },

            autoSkip:
              false,
          },
        },

        y: {
          beginAtZero: true,

          grid: {
            color:
              '#f1f5f9',
          },

          ticks: {
            font: {
              size: 11,
            },

            callback:
              yFormatter,
          },
        },
      },
    });

  const doughnutOptions =
    {
      responsive: true,

      maintainAspectRatio:
        false,

      cutout: '65%',

      plugins: {
        legend: {
          display: false,
        },
      },
    };

  /* =======================================================
     CARD DATA
  ======================================================= */

  const firstRowCards = [
    {
      key:
        'totalBorewellPoints',

      title: 'Points',

      value: points,

      icon:
        <WaterDropIcon />,

      color: NAVY,
    },

    {
      key:
        'paidAmount',

      title:
        'Paid Amount',

      value:
        fmt(paidAmount),

      icon:
        <PaidIcon />,

      color: '#2e7d32',
    },

    {
      key:
        'pendingAmount',

      title:
        'Pending Amount',

      value:
        fmt(pendingAmount),

      icon:
        <PendingActionsIcon />,

      color: '#b91c1c',
    },

    {
      key:
        'discount',

      title:
        'Discount',

      value:
        fmt(discount),

      icon:
        <DiscountIcon />,

      color: '#7c3aed',
    },
  ];

  const secondRowCards = [
    {
      key: 'diesel',

      title:
        'Diesel',

      value:
        fmt(diesel),

      icon:
        <LocalGasStationIcon />,

      color: '#2563eb',
    },

    {
      key: 'petrol',

      title:
        'Petrol',

      value:
        fmt(petrol),

      icon:
        <LocalGasStationIcon />,

      color: '#ea580c',
    },

    {
      key: 'bit',

      title: 'Bit',

      value:
        fmt(bit),

      icon:
        <ConstructionIcon />,

      color: '#0891b2',
    },

    {
      key: 'hammer',

      title:
        'Hammer',

      value:
        fmt(hammer),

      icon:
        <BuildIcon />,

      color: '#92400e',
    },
  ];

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <Box>
      {/* =================================================
          PAGE HEADER
      ================================================= */}

      {/* <PageHeader
        title="Dashboard"
        subtitle=""
        icon={
          <DashboardIcon />
        }
      /> */}

      <Box
        sx={{
          width: '100%',
        }}
      >
        {/* =================================================
            ROW 1
        ================================================= */}

        <Grid
          container
          spacing={1.25}
          sx={{
            mb: 1.5,
          }}
        >
          {firstRowCards.map(
            (card) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={3}
                key={
                  card.key
                }
              >
                <StatCard
                  title={
                    card.title
                  }
                  value={
                    card.value
                  }
                  icon={
                    card.icon
                  }
                  color={
                    card.color
                  }
                  onClick={() =>
                    handleCardClick(
                      card.key
                    )
                  }
                />
              </Grid>
            )
          )}
        </Grid>

        {/* =================================================
            ROW 2
        ================================================= */}

        <Grid
          container
          spacing={1.25}
          sx={{
            mb: 1.5,
          }}
        >
          {secondRowCards.map(
            (card) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={3}
                key={
                  card.key
                }
              >
                <StatCard
                  title={
                    card.title
                  }
                  value={
                    card.value
                  }
                  icon={
                    card.icon
                  }
                  color={
                    card.color
                  }
                  onClick={() =>
                    handleCardClick(
                      card.key
                    )
                  }
                />
              </Grid>
            )
          )}
        </Grid>

        {/* =================================================
            ROW 3
            EMPLOYEE CENTER
        ================================================= */}

        {/* <Grid
          container
          justifyContent="center"
          sx={{
            mb: 3,
          }}
        >
          <Grid
            item
            xs={12}
            sm={6}
            md={3}
          >
            <StatCard
              title="Employee"
              value={
                employees
              }
              icon={
                <PeopleIcon />
              }
              color="#059669"
              onClick={() =>
                handleCardClick(
                  'totalEmployees'
                )
              }
            />
          </Grid>
        </Grid> */}

        {/* =================================================
            ANALYTICS
        ================================================= */}

        <Typography
          variant="overline"
          sx={{
            fontSize:
              '0.68rem',

            color:
              '#64748b',

            letterSpacing:
              '0.1em',

            mb: 1,

            display:
              'block',
          }}
        >
          Analytics
        </Typography>

        <Grid
          container
          spacing={1.5}
        >
          {/* =============================================
              MONTHLY EXPENSE
          ============================================= */}

          <Grid
            item
            xs={12}
            md={6}
          >
            <ChartCard
              title="Monthly Expense"
            >
              <ChartLegend
                items={[
                  {
                    color: NAVY,
                    label:
                      'Expense (₹)',
                  },
                ]}
              />

              <Box
                sx={{
                  position:
                    'relative',

                  height: 240,
                }}
              >
                <Bar
                  data={
                    expenseData
                  }
                  options={barOptions(
                    (value) =>
                      `₹${Math.round(
                        value /
                          1000
                      )}k`
                  )}
                />
              </Box>
            </ChartCard>
          </Grid>

          {/* =============================================
              BOREWELL WORKS
          ============================================= */}

          <Grid
            item
            xs={12}
            md={6}
          >
            <ChartCard
              title="Borewell Works"
            >
              <ChartLegend
                items={[
                  {
                    color: TEAL,
                    label:
                      'Work count',
                  },
                ]}
              />

              <Box
                sx={{
                  position:
                    'relative',

                  height: 240,
                }}
              >
                <Bar
                  data={
                    workData
                  }
                  options={barOptions(
                    (value) =>
                      value
                  )}
                />
              </Box>
            </ChartCard>
          </Grid>

          {/* =============================================
              PAYMENT STATUS
          ============================================= */}

          <Grid
            item
            xs={12}
            md={6}
          >
            <ChartCard
              title="Payment Status"
            >
              <ChartLegend
                items={[
                  {
                    color:
                      '#4caf50',
                    label:
                      'Paid',
                  },

                  {
                    color:
                      '#ef4444',
                    label:
                      'Unpaid',
                  },

                  {
                    color:
                      '#f59e0b',
                    label:
                      'Partial',
                  },
                ]}
              />

              <Box
                sx={{
                  position:
                    'relative',

                  height: 240,

                  display:
                    'flex',

                  justifyContent:
                    'center',
                }}
              >
                <Box
                  sx={{
                    width: 220,

                    position:
                      'relative',
                  }}
                >
                  <Doughnut
                    data={
                      paymentData
                    }
                    options={
                      doughnutOptions
                    }
                  />
                </Box>
              </Box>
            </ChartCard>
          </Grid>
        </Grid>
      </Box>

      {/* =================================================
          DETAIL DIALOG
      ================================================= */}

      <DetailDialog
        open={
          dialogOpen
        }
        onClose={() =>
          setDialogOpen(
            false
          )
        }
        cardKey={
          activeCard
        }
        machineType={
          currentMachine
        }
        summaryValue={
          activeCard ===
          'totalBorewellPoints'
            ? String(
                points
              )
            : activeCard ===
              'paidAmount'
            ? fmt(
                paidAmount
              )
            : activeCard ===
              'pendingAmount'
            ? fmt(
                pendingAmount
              )
            : activeCard ===
              'discount'
            ? fmt(
                discount
              )
            : activeCard ===
              'diesel'
            ? fmt(
                diesel
              )
            : activeCard ===
              'petrol'
            ? fmt(
                petrol
              )
            : activeCard ===
              'bit'
            ? fmt(
                bit
              )
            : activeCard ===
              'hammer'
            ? fmt(
                hammer
              )
            : activeCard ===
              'totalEmployees'
            ? String(
                employees
              )
            : null
        }
      />
    </Box>
  );
};

export default Dashboard;