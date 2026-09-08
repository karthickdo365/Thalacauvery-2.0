import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Grid, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TablePagination, Chip, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';
import api from '../utils/api';
import ExportButton from '../components/ExportButton';
import PageHeader from '../components/PageHeader';

const actionColor = { create: 'success', update: 'info', delete: 'error', generate: 'primary', email: 'secondary' };
const MODULES = ['users', 'materials', 'points', 'invoices', 'attendance', 'salary', 'auth'];
const ACTIONS = ['create', 'update', 'delete', 'generate', 'email'];

const exportColumns = [
  { header: 'Date & Time', accessor: (r) => dayjs(r.createdAt).format('DD/MM/YYYY HH:mm') },
  { header: 'User', accessor: 'userName' },
  { header: 'Action', accessor: 'action' },
  { header: 'Module', accessor: 'module' },
  { header: 'Description', accessor: 'description' },
];

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      const params = { search, module: moduleFilter, action: actionFilter, page: page + 1, limit: rowsPerPage };
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();
      const { data } = await api.get('/activity-logs', { params });
      setLogs(data.logs);
      setTotal(data.total);
    } catch {
      toast.error('Failed to fetch activity logs');
    }
  }, [search, moduleFilter, actionFilter, startDate, endDate, page, rowsPerPage]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <Box>
      <PageHeader
        title="Activity Log"
        subtitle="Track who created, edited, or deleted records across the system"
        icon={<HistoryIcon />}
      />

      <Card>
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" placeholder="Search user or description..."
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField fullWidth select size="small" label="Module" value={moduleFilter}
                onChange={(e) => { setModuleFilter(e.target.value); setPage(0); }}>
                <MenuItem value="">All</MenuItem>
                {MODULES.map((m) => <MenuItem key={m} value={m} sx={{ textTransform: 'capitalize' }}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField fullWidth select size="small" label="Action" value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}>
                <MenuItem value="">All</MenuItem>
                {ACTIONS.map((a) => <MenuItem key={a} value={a} sx={{ textTransform: 'capitalize' }}>{a}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={2}>
              <DatePicker label="From" value={startDate} onChange={setStartDate}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
            </Grid>
            <Grid item xs={6} sm={2}>
              <DatePicker label="To" value={endDate} onChange={setEndDate}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
            </Grid>
            <Grid item>
              <ExportButton data={logs} columns={exportColumns} filename="activity_logs" />
            </Grid>
          </Grid>

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '10px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Date & Time', 'User', 'Action', 'Module', 'Description'].map((h) => (
                    <TableCell key={h}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log._id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{dayjs(log.createdAt).format('DD/MM/YYYY HH:mm')}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{log.userName}</TableCell>
                    <TableCell>
                      <Chip label={log.action} size="small" color={actionColor[log.action] || 'default'}
                        sx={{ height: 22, fontSize: '0.72rem', textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{log.module}</TableCell>
                    <TableCell>{log.description}</TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                      No activity logs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page}
            onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} />
        </CardContent>
      </Card>
    </Box>
  );
};

export default ActivityLogs;
