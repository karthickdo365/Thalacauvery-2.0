import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import {
  Box, Button, Card, CardContent, Chip, Grid, IconButton, InputAdornment,
  MenuItem, Switch, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, TextField, Tooltip, Typography,
} from '@mui/material';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import usePermissions from '../hooks/usePermissions';
import { TEAL, TEAL_DARK } from '../utils/constants';

const ROLE_CHIP = {
  admin:   { bgcolor: '#ede9fe', color: '#5b21b6' },
  partner: { bgcolor: `${TEAL}20`, color: TEAL_DARK },
  viewer:  { bgcolor: '#f1f5f9', color: '#475569' },
};

const defaultValues = { name: '', username: '', password: '', phone: '', role: 'viewer' };

const Accounts = () => {
  const { user: me } = usePermissions();
  const [accounts, setAccounts] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues });

  const fetchAccounts = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/accounts');
      setAccounts(data.accounts);
    } catch {
      toast.error('Failed to load accounts');
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const onSubmit = async (formData) => {
    setSaving(true);
    try {
      await api.post('/auth/accounts', formData);
      toast.success(`${formData.role === 'partner' ? 'Partner' : 'Viewer'} account created`);
      reset(defaultValues);
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const updateAccount = async (id, patch, successMsg) => {
    try {
      await api.patch(`/auth/accounts/${id}`, patch);
      toast.success(successMsg);
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Login Accounts"
        subtitle="Manage who can sign in and what they can change"
        icon={<ManageAccountsIcon />}
      />

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
            Create Account
          </Typography>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2.5}>
                <TextField fullWidth label="Full Name" size="small"
                  {...register('name', { required: 'Required' })}
                  error={!!errors.name} helperText={errors.name?.message} />
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <TextField fullWidth label="Username" size="small" autoComplete="off"
                  {...register('username', { required: 'Required' })}
                  error={!!errors.username} helperText={errors.username?.message} />
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <TextField fullWidth label="Password" size="small" autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: 'Required',
                    minLength: { value: 6, message: 'Min 6 characters' },
                  })}
                  error={!!errors.password} helperText={errors.password?.message}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" edge="end" onClick={() => setShowPassword((p) => !p)}>
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <TextField fullWidth label="Phone" size="small" {...register('phone')} />
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <TextField fullWidth select label="Role" size="small" defaultValue="viewer" {...register('role')}>
                  <MenuItem value="viewer">Viewer — read only</MenuItem>
                  <MenuItem value="partner">Partner — full control</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" color="secondary" disabled={saving} startIcon={<PersonAddIcon />}>
                  Create Account
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '10px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Name', 'Username', 'Phone', 'Role', 'Active', 'Created'].map((h) => (
                    <TableCell key={h}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                      No accounts found
                    </TableCell>
                  </TableRow>
                )}
                {accounts.map((a) => {
                  const isSelf = a._id === me?._id;
                  const isAdmin = a.role === 'admin';
                  const locked = isSelf || isAdmin;
                  return (
                    <TableRow key={a._id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {a.name}{isSelf && <Chip label="you" size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>@{a.username}</TableCell>
                      <TableCell>{a.phone || '—'}</TableCell>
                      <TableCell>
                        {locked ? (
                          <Chip label={a.role} size="small" sx={{ ...ROLE_CHIP[a.role], textTransform: 'capitalize' }} />
                        ) : (
                          <TextField
                            select size="small" value={a.role} variant="standard"
                            onChange={(e) => updateAccount(a._id, { role: e.target.value }, `Role changed to ${e.target.value}`)}
                            sx={{ minWidth: 90 }}
                          >
                            <MenuItem value="viewer">Viewer</MenuItem>
                            <MenuItem value="partner">Partner</MenuItem>
                          </TextField>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title={locked ? 'Cannot change this account' : (a.isActive ? 'Deactivate' : 'Activate')}>
                          <span>
                            <Switch
                              size="small" color="secondary" checked={a.isActive} disabled={locked}
                              onChange={(e) =>
                                updateAccount(a._id, { isActive: e.target.checked }, e.target.checked ? 'Account activated' : 'Account deactivated')}
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {dayjs(a.createdAt).format('DD/MM/YYYY')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Accounts;
