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


const getEmployeeDateKey = (value) => {
  if (!value) return '';

  const date = dayjs(value);
  return date.isValid()
    ? date.format('YYYY-MM-DD')
    : '';
};

const getEmployeeEndDateKey = (employee) => {
  if (!employee) return '';

  return getEmployeeDateKey(
    employee?.endDate ||
      employee?.terminationDate ||
      employee?.lastWorkingDate ||
      employee?.exitDate ||
      employee?.terminatedOn ||
      ''
  );
};

const getAttendanceDateKey = (record) => {
  return getEmployeeDateKey(
    record?.date ||
      record?.attendanceDate ||
      record?.absenceDate ||
      ''
  );
};

const isAbsentAttendance = (record) => {
  const status = String(
    record?.status ||
      record?.attendanceStatus ||
      record?.state ||
      ''
  )
    .trim()
    .toLowerCase();

  return status === 'absent';
};

const extractAttendanceRows = (data) => {
  const rows =
    data?.records ||
    data?.attendance ||
    data?.data ||
    data?.items ||
    [];

  return Array.isArray(rows)
    ? rows
    : [];
};

/*
 * Current-month salary calculation used by the dashboard.
 *
 * Salary is calculated per employee, not by adding the full monthly
 * salary of every employee. The calculation follows the Attendance
 * page rule:
 *
 *   daily salary = monthly salary / 30
 *   gross salary = daily salary × eligible days
 *   absent deduction = daily salary × absent days
 *   current payable = gross salary - absent deduction - advances
 *
 * Every employee gets their own salary rate, joining date and absence
 * records. Therefore employees with different salaries are calculated
 * independently.
 */
const calculateCurrentEmployeeSalary = (
  employee,
  attendanceRecords = [],
  advances = []
) => {
  if (!employee) {
    return {
      employee,
      monthlySalary: 0,
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      grossSalary: 0,
      absentDeduction: 0,
      advance: 0,
      currentSalary: 0,
    };
  }

  const today = dayjs().startOf('day');
  const todayKey = today.format('YYYY-MM-DD');

  const monthStartKey = today
    .startOf('month')
    .format('YYYY-MM-DD');

  const joiningKey =
    getEmployeeDateKey(employee?.date) ||
    monthStartKey;

  const employeeEndKey =
    getEmployeeEndDateKey(employee);

  let startKey =
    joiningKey > monthStartKey
      ? joiningKey
      : monthStartKey;

  let endKey = todayKey;

  if (employeeEndKey && employeeEndKey < endKey) {
    endKey = employeeEndKey;
  }

  if (endKey < startKey) {
    return {
      employee,
      monthlySalary:
        safeNum(employee?.salary),
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      grossSalary: 0,
      absentDeduction: 0,
      advance: 0,
      currentSalary: 0,
    };
  }

  const rangeStart = dayjs(startKey);
  const rangeEnd = dayjs(endKey);

  const totalDays =
    rangeEnd.diff(
      rangeStart,
      'day'
    ) + 1;

  const rangeSet = new Set();

  for (
    let date = rangeStart;
    !date.isAfter(rangeEnd, 'day');
    date = date.add(1, 'day')
  ) {
    rangeSet.add(
      date.format('YYYY-MM-DD')
    );
  }

  const absentKeys = new Set();

  for (const record of attendanceRecords) {
    if (isAbsentAttendance(record)) {
      const key =
        getAttendanceDateKey(record);

      if (key && rangeSet.has(key)) {
        absentKeys.add(key);
      }
    }

    if (
      Array.isArray(
        record?.absentDates
      )
    ) {
      for (
        const item of record.absentDates
      ) {
        const key =
          getEmployeeDateKey(
            item?.date || item
          );

        if (
          key &&
          rangeSet.has(key)
        ) {
          absentKeys.add(key);
        }
      }
    }
  }

  const absentDays =
    absentKeys.size;

  const presentDays = Math.max(
    totalDays - absentDays,
    0
  );

  const monthlySalary =
    safeNum(employee?.salary);

  const dailySalary =
    monthlySalary / 30;

  const grossSalary =
    dailySalary * totalDays;

  const absentDeduction =
    dailySalary * absentDays;

  const currentMonthAdvances =
    advances.reduce(
      (sum, item) => {
        const rawDate =
          item?.date ||
          item?.advanceDate ||
          item?.paymentDate ||
          item?.transactionDate ||
          item?.createdAt ||
          null;

        const advanceKey =
          rawDate
            ? getEmployeeDateKey(
                rawDate
              )
            : item?.month
              ? `${item.month}-01`
              : '';

        if (
          advanceKey &&
          advanceKey >= startKey &&
          advanceKey <= endKey
        ) {
          return (
            sum +
            safeNum(
              item?.advanceAmount ??
                item?.amount
            )
          );
        }

        return sum;
      },
      0
    );

  const salaryBeforeAdvance =
    Math.max(
      grossSalary -
        absentDeduction,
      0
    );

  const currentSalary =
    salaryBeforeAdvance -
    currentMonthAdvances;

  return {
    employee,
    monthlySalary,
    totalDays,
    presentDays,
    absentDays,
    grossSalary,
    absentDeduction,
    advance:
      currentMonthAdvances,
    currentSalary,
    startDate: startKey,
    endDate: endKey,
  };
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
    color: '#0f172a',
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
    color: '#0f172a',
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
    color: '#0f172a',
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
    color: '#0f172a',
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
    color: '#0f172a',
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
    color: '#0f172a',
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
    color: '#0f172a',
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
    color: '#0f172a',
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
    color: '#0f172a',
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
  multiline = false,
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

          bgcolor: 'var(--stat-icon-bg, #f1f5f9)',
          color: 'var(--stat-icon-color, #0f172a)',

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
              multiline
                ? '0.78rem'
                : '1.05rem',

            lineHeight:
              multiline
                ? 1.35
                : 1.2,

            whiteSpace:
              multiline
                ? 'normal'
                : 'nowrap',

            overflow:
              multiline
                ? 'visible'
                : 'hidden',

            textOverflow:
              multiline
                ? 'clip'
                : 'ellipsis',
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
          const response =
            await config.fetch(
              machineType
            );

          const data =
            response?.data ??
            response;

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
          bgcolor: '#fff',

          color: '#0f172a',

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
                color: '#0f172a',
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

                        color: '#0f172a',

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

                  color: '#0f172a',

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
                  color: '#0f172a',
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

  const [
    employeeRows,
    setEmployeeRows,
  ] = useState([]);

  const [
    salaryAdvanceRows,
    setSalaryAdvanceRows,
  ] = useState([]);

  const [
    employeeSalaryRows,
    setEmployeeSalaryRows,
  ] = useState([]);

  const {
    currentMachine,
  } = useMachine();

  const isBig = currentMachine === 'big';
  const isSmall = currentMachine === 'small';

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
          const response =
            await api.get(
              '/materials',
            {
              params: {
                limit: 500,
                machineType:
                  currentMachine,
              },
            }
          );

          const data =
            response?.data ??
            response;

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
          const response =
            await api.get(
              '/borewell-points',
            {
              params: {
                limit: 500,
                machineType:
                  currentMachine,
              },
            }
          );

          const data =
            response?.data ??
            response;

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
     FETCH EMPLOYEES / SALARY ADVANCES / ATTENDANCE
  ======================================================= */

  useEffect(() => {
    if (
      currentMachine !==
        'big' &&
      currentMachine !==
        'small'
    ) {
      setEmployeeRows([]);
      setSalaryAdvanceRows([]);
      setEmployeeSalaryRows([]);
      return;
    }

    let cancelled = false;

    const loadEmployeesAndSalary =
      async () => {
        try {
          const employeeResponse =
            await api.get(
              '/users',
              {
                params: {
                  type: 'Employee',
                  limit: 500,
                  machineType:
                    currentMachine,
                },
              }
            );

          const employeeData =
            employeeResponse?.data ??
            employeeResponse;

          const users =
            Array.isArray(
              employeeData?.users
            )
              ? employeeData.users
              : Array.isArray(
                  employeeData
                )
              ? employeeData
              : [];

          /*
           * Attendance and salary advances are loaded separately for
           * EACH employee. The previous dashboard loaded all advances
           * for the machine once and then deducted that same advance
           * total from every employee. That made the salary collapse
           * to ₹0 when the combined advance amount was larger than an
           * individual employee's salary.
           *
           * Attendance & Salary uses the employee-specific endpoints,
           * so the dashboard must use the same rule.
           */
          const salaryResults =
            await Promise.all(
              users.map(
                async (employee) => {
                  const employeeId =
                    employee?._id ||
                    employee?.id;

                  if (!employeeId) {
                    return {
                      salary: calculateCurrentEmployeeSalary(
                        employee,
                        [],
                        []
                      ),
                      advances: [],
                    };
                  }

                  try {
                    const [
                      attendanceResponse,
                      advanceResponse,
                    ] = await Promise.all([
                      api.get(
                        '/attendance',
                        {
                          params: {
                            employeeId,
                            machineType:
                              currentMachine,
                            limit: 500,
                          },
                        }
                      ),
                      api.get(
                        '/salary-advances',
                        {
                          params: {
                            employeeId,
                            machineType:
                              currentMachine,
                            limit: 500,
                          },
                        }
                      ),
                    ]);

                    const attendanceData =
                      attendanceResponse?.data ??
                      attendanceResponse;

                    const advanceData =
                      advanceResponse?.data ??
                      advanceResponse;

                    const attendanceRecords =
                      extractAttendanceRows(
                        attendanceData
                      );

                    const employeeAdvances =
                      Array.isArray(
                        advanceData?.records
                      )
                        ? advanceData.records
                        : Array.isArray(
                            advanceData?.advances
                          )
                        ? advanceData.advances
                        : Array.isArray(
                            advanceData?.data
                          )
                        ? advanceData.data
                        : Array.isArray(
                            advanceData?.items
                          )
                        ? advanceData.items
                        : Array.isArray(
                            advanceData
                          )
                        ? advanceData
                        : [];

                    return {
                      salary:
                        calculateCurrentEmployeeSalary(
                          employee,
                          attendanceRecords,
                          employeeAdvances
                        ),
                      advances:
                        employeeAdvances,
                    };
                  } catch (employeeSalaryError) {
                    console.error(
                      `Failed to load salary data for ${
                        employee?.name ||
                        'employee'
                      }:`,
                      employeeSalaryError
                    );

                    /*
                     * If the attendance/advance request fails, do not
                     * invent deductions. Show the salary based on the
                     * employee record and the dates we can calculate.
                     */
                    return {
                      salary:
                        calculateCurrentEmployeeSalary(
                          employee,
                          [],
                          []
                        ),
                      advances: [],
                    };
                  }
                }
              )
            );

          const salaryRows =
            salaryResults.map(
              (result) => result.salary
            );

          const advances =
            salaryResults.flatMap(
              (result) => result.advances || []
            );

          if (cancelled) {
            return;
          }

          setEmployeeRows(
            users
          );

          setSalaryAdvanceRows(
            advances
          );

          setEmployeeSalaryRows(
            salaryRows
          );
        } catch (error) {
          if (cancelled) {
            return;
          }

          console.error(
            'Failed to load employee/salary data:',
            error
          );

          setEmployeeRows([]);
          setSalaryAdvanceRows([]);
          setEmployeeSalaryRows([]);
        }
      };

    loadEmployeesAndSalary();

    return () => {
      cancelled = true;
    };
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

                color: '#0f172a',

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
            color: '#0f172a',
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

  /*
   * Pending Amount must come from borewell point payments.
   * Do not use the salary pending value here.
   *
   * Unpaid point:
   *   pending = totalAmount
   *
   * Partial point:
   *   pending = totalAmount - paidAmount
   *
   * This keeps the dashboard card consistent with the
   * Pending Amount detail dialog and the Points page.
   */
  const pendingAmount =
    pointRows.reduce(
      (sum, point) =>
        sum +
        getPendingAmount(point),
      0
    );

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

  const getMaterialQuantity =
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
              material?.quantity
            ),
          0
        );

  const bitQuantity =
    getMaterialQuantity('bit');

  const hammerQuantity =
    getMaterialQuantity('hammer');

  /*
   * Current salary is the amount payable for the current month up to
   * today, after each employee's own absent-day deduction and current
   * salary advances.
   *
   * Do not use:
   *   employeeRows.reduce((sum, employee) => sum + employee.salary)
   *
   * That only adds full monthly salaries and ignores attendance.
   */
  const totalSalary =
    employeeSalaryRows.reduce(
      (sum, row) =>
        sum +
        safeNum(
          row?.currentSalary
        ),
      0
    );

  const totalMonthlySalary =
    employeeRows.reduce(
      (sum, employee) =>
        sum +
        safeNum(
          employee?.salary
        ),
      0
    );

  /*
   * WORKED SALARY
   * ----------------
   * Worked Salary must be the salary earned for PRESENT / WORKED days,
   * before salary advances are deducted.
   *
   * currentSalary = worked salary - salary advances
   *
   * Therefore:
   *   worked salary = currentSalary + salary advances
   *
   * Example from the Salary Report:
   *   Employee 1 = ₹6,500.00
   *   Employee 2 = ₹6,500.00
   *   ...
   *   Total Worked Salary = ₹63,500.00
   *
   * Advances are shown separately below and are NOT removed from
   * Worked Salary.
   */
  const totalAbsentDeduction =
    employeeSalaryRows.reduce(
      (sum, row) =>
        sum +
        safeNum(
          row?.absentDeduction
        ),
      0
    );

  const totalCurrentSalaryAdvance =
    employeeSalaryRows.reduce(
      (sum, row) =>
        sum +
        safeNum(
          row?.advance
        ),
      0
    );

  /*
   * Worked Salary is the earned salary before salary advances.
   * currentSalary already has the employee's advances deducted,
   * so add the advances back for the Worked Salary figure.
   */
  /*
   * Salary Summary
   * Worked Salary = salary earned before advances
   * Advance      = salary advance already paid
   * Final Salary = Worked Salary - Advance
   */
  const totalWorkedSalary =
    totalSalary + totalCurrentSalaryAdvance;

  const totalFinalSalary =
    totalWorkedSalary -
    totalCurrentSalaryAdvance;

  /*
   * Pending salary comes from Attendance & Salary.
   * currentSalary is already calculated after absent deduction
   * and the employee's current-month salary advances.
   */
  const salaryPendingAmount =
    Math.max(
      totalSalary,
      0
    );

  /*
   * Salary advances are separate from borewell customer
   * payments. The old dashboard incorrectly displayed
   * partial borewell payments as "Advance", which is why
   * the Payment Summary showed 0 even when salary advances
   * existed.
   */
  const employees =
    employeeRows.length;

  /* =======================================================
     MACHINE SUMMARY
  ======================================================= */

  const sumPointField = (field) =>
    pointRows.reduce(
      (sum, point) =>
        sum + safeNum(point?.[field]),
      0
    );

  /*
   * MACHINE PIPE STOCK / USAGE
   *
   * Materials stores the number of pipes purchased/available.
   * Points stores the actual feet used. One pipe = 20 ft.
   *
   * Example:
   *   Material stock = 17 pipes
   *   Total feet used = 214 ft
   *   Pipes used = ceil(214 / 20) = 11
   *   Remaining = 17 - 11 = 6
   *
   * The dashboard intentionally shows the material stock in the
   * card title and the remaining/used feet below it, matching the
   * physical stock sheet used by the business.
   */
  const getPipeQuantity = (feet) =>
    feet > 0
      ? Math.ceil(feet / 20)
      : 0;

  const getPipeStockQuantity = (kind) => {
    const aliases = {
      outer: [
        'pipe outer',
        'outer pipe',
        'outer',
      ],
      inner: [
        'pipe inner',
        'inner pipe',
        'inner',
      ],
      smallInner: [
        'pipe small',
        'small pipe',
        'small inner',
        'small inner pipe',
      ],
      ji: [
        'pipe j1',
        'pipe ji',
        'ji pipe',
        'ji inner',
        'ji',
      ],
    };

    const names = aliases[kind] || [];

    return materialRows
      .filter((material) => {
        const type = getMaterialType(material);

        if (kind === 'inner') {
          // Do not count Small Inner as normal Inner.
          if (
            type.includes('small inner') ||
            type.includes('pipe small')
          ) {
            return false;
          }
        }

        return names.some((name) =>
          type === name ||
          type.includes(name)
        );
      })
      .reduce(
        (sum, material) =>
          sum + safeNum(material?.quantity),
        0
      );
  };

  const getPipeSummary = (feet, stockQuantity) => {
    const usedPipes = getPipeQuantity(feet);
    const remaining = Math.max(
      safeNum(stockQuantity) - usedPipes,
      0
    );

    return {
      stockQuantity: safeNum(stockQuantity),
      usedPipes,
      remaining,
    };
  };

  const outerFeet = isBig
    ? sumPointField('plasticOuterFeet')
    : sumPointField('outerPipeFeet');

  const innerFeet = isBig
    ? sumPointField('plasticInnerFeet')
    : sumPointField('innerPipeFeet');

  const smallInnerFeet =
    sumPointField('smallPipeFeet');

  const jiFeet =
    sumPointField('jiInnerFeet');

  const outerSummary =
    getPipeSummary(
      outerFeet,
      getPipeStockQuantity('outer')
    );

  const innerSummary =
    getPipeSummary(
      innerFeet,
      getPipeStockQuantity('inner')
    );

  const smallInnerSummary =
    getPipeSummary(
      smallInnerFeet,
      getPipeStockQuantity('smallInner')
    );

  const jiSummary =
    getPipeSummary(
      jiFeet,
      getPipeStockQuantity('ji')
    );

  const pipeCards = isBig
    ? [
        {
          key: 'bigOuter',
          title: `Outer (${outerSummary.stockQuantity})`,
          usedPipes: outerSummary.usedPipes,
          remaining: outerSummary.remaining,
          totalFeet: outerFeet,
          icon: <WaterDropIcon />,
          color: '#0f172a',
        },
        {
          key: 'bigInner',
          title: `Inner (${innerSummary.stockQuantity})`,
          usedPipes: innerSummary.usedPipes,
          remaining: innerSummary.remaining,
          totalFeet: innerFeet,
          icon: <WaterDropIcon />,
          color: '#0f172a',
        },
        {
          key: 'bigJI',
          title: `JI (${jiSummary.stockQuantity})`,
          usedPipes: jiSummary.usedPipes,
          remaining: jiSummary.remaining,
          totalFeet: jiFeet,
          icon: <WaterDropIcon />,
          color: '#0f172a',
        },
      ]
    : [
        {
          key: 'smallOuter',
          title: `Outer (${outerSummary.stockQuantity})`,
          usedPipes: outerSummary.usedPipes,
          remaining: outerSummary.remaining,
          totalFeet: outerFeet,
          icon: <WaterDropIcon />,
          color: '#0f172a',
        },
        {
          key: 'smallInner',
          title: `Inner (${innerSummary.stockQuantity})`,
          usedPipes: innerSummary.usedPipes,
          remaining: innerSummary.remaining,
          totalFeet: innerFeet,
          icon: <WaterDropIcon />,
          color: '#0f172a',
        },
        {
          key: 'smallInnerPipe',
          title: `Small Inner (${smallInnerSummary.stockQuantity})`,
          usedPipes: smallInnerSummary.usedPipes,
          remaining: smallInnerSummary.remaining,
          totalFeet: smallInnerFeet,
          icon: <WaterDropIcon />,
          color: '#0f172a',
        },
      ];

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
            color: '#0f172a',
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

      color: '#0f172a',
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

      color: '#0f172a',
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

      color: '#0f172a',
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

      color: '#0f172a',
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

      color: '#0f172a',
    },

    {
      key: 'petrol',

      title:
        'Petrol',

      value:
        fmt(petrol),

      icon:
        <LocalGasStationIcon />,

      color: '#0f172a',
    },

    {
      key: 'bit',

      title:
        `Bit (${bitQuantity})`,

      value:
        fmt(bit),

      icon:
        <ConstructionIcon />,

      color: '#0f172a',
    },

    {
      key: 'hammer',

      title:
        `Hammer (${hammerQuantity})`,

      value:
        fmt(hammer),

      icon:
        <BuildIcon />,

      color: '#0f172a',
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Typography
            sx={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#0f172a',
            }}
          >
            Dashboard
          </Typography>

          <Chip
            size="small"
            label={isBig ? 'BIG MACHINE' : 'SMALL MACHINE'}
            sx={{
              bgcolor: `${TEAL}18`,
              color: TEAL_D,
              fontWeight: 800,
              fontSize: '0.68rem',
            }}
          />
        </Box>
        {/* =================================================
            ROW 1
        ================================================= */}

        <Grid
          container
          spacing={1.25}
          sx={{
            mb: 1.5,

            '& > .MuiGrid-item:nth-of-type(1)': {
              '--stat-icon-color': '#0f172a',
              '--stat-icon-bg': '#eef0f2',
            },

            '& > .MuiGrid-item:nth-of-type(2)': {
              '--stat-icon-color': '#16a34a',
              '--stat-icon-bg': '#eaf6ed',
            },

            '& > .MuiGrid-item:nth-of-type(3)': {
              '--stat-icon-color': '#dc2626',
              '--stat-icon-bg': '#fdecec',
            },

            '& > .MuiGrid-item:nth-of-type(4)': {
              '--stat-icon-color': '#7c3aed',
              '--stat-icon-bg': '#f2eafd',
            },
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

            '& > .MuiGrid-item:nth-of-type(1)': {
              '--stat-icon-color': '#2563eb',
              '--stat-icon-bg': '#eaf1ff',
            },

            '& > .MuiGrid-item:nth-of-type(2)': {
              '--stat-icon-color': '#ea580c',
              '--stat-icon-bg': '#fff0e7',
            },

            '& > .MuiGrid-item:nth-of-type(3)': {
              '--stat-icon-color': '#0891b2',
              '--stat-icon-bg': '#e8f7fb',
            },

            '& > .MuiGrid-item:nth-of-type(4)': {
              '--stat-icon-color': '#92400e',
              '--stat-icon-bg': '#f5eee9',
            },
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
            MACHINE PIPE STOCK / USAGE
            STOCK IS THE LAST SUMMARY SECTION
        ================================================= */}

        <Box
          sx={{
            mb: 1.5,
            width: '100%',
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
            gap: {
              xs: 1,
              sm: 1.25,
              md: 1.25,
            },
            alignItems: 'stretch',
          }}
        >
          {pipeCards.map((card) => (
            <Box
              key={card.key}
              sx={{
                minWidth: 0,
                width: '100%',
                display: 'flex',
              }}
            >
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  width: '100%',
                  border: '1px solid #dbe3ec',
                  borderRadius: '12px',
                  bgcolor: '#fff',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                }}
              >
                <CardContent
                  sx={{
                    p: '14px !important',
                    minHeight: 74,
                  }}
                >
                  <Typography
                    sx={{
                      color: '#0f172a',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      mb: 0.8,
                    }}
                  >
                    {card.title}
                  </Typography>

                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.35,
                    }}
                  >
                    <Typography
                      component="div"
                      sx={{
                        fontSize: '0.68rem',
                        lineHeight: 1.35,
                        fontWeight: 700,
                        color: '#64748b',
                      }}
                    >
                      Executed ({card.usedPipes})
                    </Typography>

                    <Typography
                      component="div"
                      sx={{
                        fontSize: '0.68rem',
                        lineHeight: 1.35,
                        fontWeight: 700,
                        color: '#64748b',
                      }}
                    >
                      Total ft ({card.totalFeet})
                    </Typography>

                    <Typography
                      component="div"
                      sx={{
                        fontSize: '0.68rem',
                        lineHeight: 1.35,
                        fontWeight: 800,
                        color: '#dc2626',
                      }}
                    >
                      Stock ({card.remaining})
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          ))}


          <Box
            sx={{
              minWidth: 0,
              width: '100%',
              display: 'flex',
            }}
          >
            <Card
              elevation={0}
              sx={{
                height: '100%',
                border: '1px solid #dbe3ec',
                borderRadius: '12px',
                bgcolor: '#fff',
              }}
            >
              <CardContent
                sx={{
                  p: '14px !important',
                  minHeight: 74,
                }}
              >
                                <Typography
                  sx={{
                    color: '#0f172a',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    mb: 0.8,
                  }}
                >
                  Salary Summary
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(3, minmax(0, 1fr))',
                    gap: 0.75,
                  }}
                >
                  {/* WORKED SALARY */}
                  <Box>
                    <Typography
                      sx={{
                        color: '#64748b',
                        fontSize: '0.6rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Worked Salary
                    </Typography>

                    <Typography
                      sx={{
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmt(totalWorkedSalary)}
                    </Typography>
                  </Box>

                  {/* ADVANCE */}
                  <Box>
                    <Typography
                      sx={{
                        color: '#b45309',
                        fontSize: '0.6rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Advance
                    </Typography>

                    <Typography
                      sx={{
                        color: '#b45309',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmt(totalCurrentSalaryAdvance)}
                    </Typography>
                  </Box>

                  {/* FINAL SALARY */}
                  <Box>
                    <Typography
                      sx={{
                        color: '#0f172a',
                        fontSize: '0.6rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Final Salary
                    </Typography>

                    <Typography
                      sx={{
                        color:
                          totalFinalSalary < 0
                            ? '#b91c1c'
                            : '#0f172a',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmt(totalFinalSalary)}
                    </Typography>
                  </Box>
                </Box>

                <Typography
                  sx={{
                    mt: 0.8,
                    color: '#64748b',
                    fontSize: '0.62rem',
                  }}
                >
                  Monthly: {fmt(totalMonthlySalary)} · Absent deduction: {fmt(totalAbsentDeduction)}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* =================================================
            ROW 3
            EMPLOYEE CENTER
        ================================================= */}



        {/* =================================================
            ANALYTICS
        ================================================= */}

        <Typography
          variant="overline"
          sx={{
            fontSize:
              '0.68rem',

            color: '#0f172a',

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
                    color: '#0f172a',
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
                    color: '#0f172a',
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
                    color: '#0f172a',
                    label:
                      'Paid',
                  },

                  {
                    color: '#0f172a',
                    label:
                      'Unpaid',
                  },

                  {
                    color: '#0f172a',
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
                salaryPendingAmount
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
