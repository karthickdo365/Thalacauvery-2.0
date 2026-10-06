import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, TextField, MenuItem, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  CircularProgress, Tabs, Tab,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import api from '../utils/api';
import ExportButton from '../components/ExportButton';
import PageHeader from '../components/PageHeader';
import { fmtINR, NAVY, TEAL } from '../utils/constants';
import { useMachine } from '../context/MachineContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const profitLossColumns = [
  { header: 'Month', accessor: 'monthLabel' },
  { header: 'Total Points', accessor: (r) => r.totalPoints ?? 0 },
  { header: 'Total Amount', accessor: (r) => r.totalAmount ?? 0 },
  { header: 'Work Revenue', accessor: (r) => r.workRevenue ?? r.revenue },
  { header: 'Material Expense', accessor: (r) => r.materialExpense },
  { header: 'Salary Expense', accessor: (r) => r.salaryExpense },
  { header: 'Total Expense', accessor: (r) => r.totalExpense },
  { header: 'Profit/Loss', accessor: (r) => r.profit },
];

const dailyColumns = [
  { header: 'Date', accessor: (r) => dayjs(r.date).format('DD/MM/YYYY') },
  { header: 'Type', accessor: 'type' },
  { header: 'Quantity', accessor: 'quantity' },
  { header: 'Cost/L', accessor: 'costPerLiter' },
  { header: 'Total', accessor: 'totalPrice' },
];

const SummaryCard = ({ label, value, color }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h6" fontWeight={700} color={color}>{value}</Typography>
    </CardContent>
  </Card>
);

const Reports = () => {
  const { currentMachine } = useMachine();
  const [tab, setTab] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [profitLoss, setProfitLoss] = useState(null);
  const [totalPointsByMonth, setTotalPointsByMonth] = useState({});
  const [dailyReport, setDailyReport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [loading, setLoading] = useState(false);

  const fetchProfitLoss = useCallback(async () => {
    setLoading(true);
    setProfitLoss(null);
    try {
      const { data } = await api.get('/reports/profit-loss', {
        params: { year, machineType: currentMachine },
      });
      setProfitLoss(data);
    } catch {
      toast.error('Failed to load profit/loss report');
    } finally {
      setLoading(false);
    }
  }, [year, currentMachine]);

  const fetchTotalPoints = useCallback(async () => {
    try {
      const { data } = await api.get('/borewell-points', {
        params: {
          limit: 500,
          machineType: currentMachine,
        },
      });

      const points = Array.isArray(data?.points) ? data.points : [];

      const counts = {};

      points.forEach((point) => {
        if (!point?.date) return;

        const date = new Date(point.date);
        if (Number.isNaN(date.getTime())) return;

        const pointYear = date.getFullYear();
        if (pointYear !== Number(year)) return;

        const month = date.getMonth() + 1;
        const key = `${pointYear}-${String(month).padStart(2, '0')}`;

        if (!counts[key]) {
          counts[key] = {
            totalPoints: 0,
            totalAmount: 0,
          };
        }

        counts[key].totalPoints += 1;

        // Point amount is the borewell point's total amount.
        counts[key].totalAmount += Number(
          point?.totalAmount ??
          point?.amount ??
          point?.pointAmount ??
          0
        );
      });

      setTotalPointsByMonth(counts);
    } catch {
      setTotalPointsByMonth({});
    }
  }, [year, currentMachine]);

  const fetchDailyExpense = useCallback(async () => {
    setLoading(true);
    setDailyReport(null);
    try {
      const { data } = await api.get('/reports/daily-expense', {
        params: {
          date: selectedDate.format('YYYY-MM-DD'),
          machineType: currentMachine,
        },
      });
      setDailyReport(data);
    } catch {
      toast.error('Failed to load daily expense report');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, currentMachine]);

  useEffect(() => {
    if (!currentMachine) return;

    if (tab === 0) {
      fetchProfitLoss();
      fetchTotalPoints();
    } else {
      fetchDailyExpense();
    }
  }, [
    tab,
    currentMachine,
    fetchProfitLoss,
    fetchTotalPoints,
    fetchDailyExpense,
  ]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 3 + i);

  if (!currentMachine) {
    return (
      <Box>
        <PageHeader
          title="Reports"
          subtitle="Select Big Machine or Small Machine to view separate reports"
          icon={<AssessmentIcon />}
        />

        <Card sx={{ mt: 2 }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <AssessmentIcon sx={{ fontSize: 48, color: TEAL, mb: 1 }} />
            <Typography variant="h6" fontWeight={700}>
              Select a machine
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Reports are separated between Big Machine and Small Machine.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Show only months with actual business activity.
  // Months containing only the old blanket salary value are hidden from the report.
  const reportWithPoints = profitLoss
    ? profitLoss.report.map((row) => {
        const key = `${year}-${String(row.month).padStart(2, '0')}`;

        return {
          ...row,
          totalPoints: totalPointsByMonth[key]?.totalPoints ?? 0,
          totalAmount: totalPointsByMonth[key]?.totalAmount ?? 0,
        };
      })
    : [];

  const visibleReport = reportWithPoints.filter((r) =>
    Number(r.totalPoints ?? 0) > 0 ||
    Number(r.totalAmount ?? 0) !== 0 ||
    Number(r.worksCount ?? 0) > 0 ||
    Number(r.workRevenue ?? r.revenue ?? 0) !== 0 ||
    Number(r.materialExpense ?? 0) !== 0
  );

  const chartData = profitLoss ? {
    labels: visibleReport.map((r) => r.monthLabel),
    datasets: [
      {
        label: 'Work Revenue',
        data: visibleReport.map((r) => r.workRevenue ?? r.revenue ?? 0),
        backgroundColor: NAVY,
        borderRadius: 4,
      },
      {
        label: 'Total Expense',
        data: visibleReport.map((r) => r.totalExpense ?? 0),
        backgroundColor: '#ef4444',
        borderRadius: 4,
      },
      {
        label: 'Profit / Loss',
        data: visibleReport.map((r) => r.profit ?? 0),
        backgroundColor: TEAL,
        borderRadius: 4,
      },
    ],
  } : null;

  return (
    <Box>
      <PageHeader
        title="Reports"
        subtitle={`${currentMachine === 'big' ? 'Big Machine' : 'Small Machine'} · Profit & loss and daily expense breakdowns`}
        icon={<AssessmentIcon />}
      />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          mb: 1.5,
        }}
      >
        <Typography
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            fontSize: 12,
            fontWeight: 700,
            color: 'secondary.main',
            bgcolor: 'secondary.light',
          }}
        >
          {currentMachine === 'big' ? 'BIG MACHINE' : 'SMALL MACHINE'}
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)}
        sx={{ mb: 2.5, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
        textColor="secondary" indicatorColor="secondary">
        <Tab label="Monthly Profit / Loss" />
        <Tab label="Daily Expense" />
      </Tabs>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress color="secondary" /></Box>}

      {tab === 0 && profitLoss && !loading && (
        <>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Total Revenue" value={fmtINR(profitLoss.totals.revenue)} color="secondary.dark" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard
                label="Work Revenue"
                value={fmtINR(profitLoss.totals.workRevenue ?? profitLoss.totals.revenue ?? 0)}
                color="secondary.dark"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Total Expenses" value={fmtINR(profitLoss.totals.totalExpense)} color="error.main" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Net Profit/Loss" value={fmtINR(profitLoss.totals.profit)}
                color={profitLoss.totals.profit >= 0 ? 'success.main' : 'error.main'} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Monthly Payroll" value={fmtINR(profitLoss.monthlySalary)} color="text.primary" />
            </Grid>
          </Grid>

          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Grid item xs={12} sm={3}>
                  <TextField fullWidth select size="small" label="Year" value={year}
                    onChange={(e) => setYear(Number(e.target.value))}>
                    {yearOptions.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item>
                  <ExportButton
                    data={visibleReport}
                    columns={profitLossColumns}
                    filename={`profit_loss_${year}`}
                  />
                </Grid>
              </Grid>
              {chartData && (
                <Bar data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ borderRadius: '10px', overflowX: 'auto' }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {profitLossColumns.map((c) => (
                        <TableCell key={c.header}>{c.header}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleReport.map((row) => (
                      <TableRow key={row.month} hover>
                        <TableCell>{row.monthLabel}</TableCell>
                        <TableCell>{row.totalPoints}</TableCell>
                        <TableCell>{fmtINR(row.totalAmount)}</TableCell>
                        <TableCell>{fmtINR(row.workRevenue ?? row.revenue ?? 0)}</TableCell>
                        <TableCell>{fmtINR(row.materialExpense)}</TableCell>
                        <TableCell>{fmtINR(row.salaryExpense)}</TableCell>
                        <TableCell>{fmtINR(row.totalExpense)}</TableCell>
                        <TableCell sx={{ color: row.profit >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                          {fmtINR(row.profit)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {visibleReport.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                          No work activity recorded for this period
                        </TableCell>
                      </TableRow>
                    )}

                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {visibleReport.reduce((sum, row) => sum + Number(row.totalPoints ?? 0), 0)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {fmtINR(visibleReport.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0))}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {fmtINR(profitLoss.totals.workRevenue ?? profitLoss.totals.revenue ?? 0)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{fmtINR(profitLoss.totals.materialExpense)}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{fmtINR(profitLoss.totals.salaryExpense)}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{fmtINR(profitLoss.totals.totalExpense)}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: profitLoss.totals.profit >= 0 ? 'success.main' : 'error.main' }}>
                        {fmtINR(profitLoss.totals.profit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {tab === 1 && dailyReport && !loading && (
        <>
          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <DatePicker label="Select Date" value={selectedDate} onChange={setSelectedDate}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Total Expense</Typography>
                  <Typography variant="h5" fontWeight={700} color="error.main">
                    {fmtINR(dailyReport.totalExpense)}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Items</Typography>
                  <Typography variant="h5" fontWeight={700}>{dailyReport.itemCount}</Typography>
                </Grid>
                <Grid item>
                  <ExportButton data={dailyReport.materials} columns={dailyColumns}
                    filename={`daily_expense_${selectedDate.format('YYYY-MM-DD')}`} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '10px' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Type', 'Quantity', 'Cost/L', 'Total'].map((h) => (
                        <TableCell key={h}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyReport.materials.map((m) => (
                      <TableRow key={m._id} hover>
                        <TableCell>{m.type}</TableCell>
                        <TableCell>{m.quantity ?? '—'}</TableCell>
                        <TableCell>{m.costPerLiter != null ? fmtINR(m.costPerLiter) : '—'}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{fmtINR(m.totalPrice)}</TableCell>
                      </TableRow>
                    ))}
                    {dailyReport.materials.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                          No expenses recorded for this date
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default Reports;
