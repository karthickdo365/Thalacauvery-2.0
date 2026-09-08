import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import {
  Box, Button, Card, CardContent, TextField, Typography, Link,
  Alert, CircularProgress, InputAdornment, IconButton,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { login, clearError } from '../redux/slices/authSlice';
import { toast } from 'react-toastify';
import { NAVY, TEAL, TEAL_DARK } from '../utils/constants';
import logo from '../asserts/login.png';

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    dispatch(clearError());
    const result = await dispatch(login(data));
    if (login.fulfilled.match(result)) {
      toast.success('Login successful!');
      navigate('/machine-selection');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: NAVY, p: 2, position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Background decorative circles */}
      <Box sx={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', bgcolor: TEAL, opacity: 0.06, top: -120, right: -100 }} />
      <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', bgcolor: TEAL, opacity: 0.06, bottom: -80, left: -60 }} />

      <Card
        sx={{
          maxWidth: 420, width: '100%', borderRadius: '20px', overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.35)', position: 'relative', zIndex: 1, border: 'none',
        }}
      >
        {/* Header */}
        <Box sx={{ bgcolor: NAVY, color: 'white', p: 3, textAlign: 'center', borderBottom: `3px solid ${TEAL}` }}>
          <Box
            sx={{
              width: 72, height: 72, borderRadius: '16px', overflow: 'hidden',
              bgcolor: 'rgba(30,190,165,0.1)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', mx: 'auto', mb: 1.5,
            }}
          >
            <img src={logo} alt="Thalacuvery Borewell" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
          <Typography variant="h6" fontWeight={700} letterSpacing="0.06em">
            THALACUVERY BOREWELL
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.5, mt: 0.5, fontWeight: 300 }}>
            Management System
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Sign In
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              fullWidth label="Username" margin="normal" autoComplete="username"
              {...register('username', { required: 'Username is required' })}
              error={!!errors.username} helperText={errors.username?.message}
            />
            <TextField
              fullWidth label="Password" margin="normal"
              type={showPassword ? 'text' : 'password'} autoComplete="current-password"
              {...register('password', { required: 'Password is required' })}
              error={!!errors.password} helperText={errors.password?.message}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              fullWidth type="submit" variant="contained" size="large" disabled={loading}
              sx={{
                mt: 3, py: 1.5, bgcolor: TEAL, borderRadius: '10px', fontWeight: 600,
                letterSpacing: '0.04em',
                '&:hover': { bgcolor: TEAL_DARK },
                '&.Mui-disabled': { bgcolor: '#a7f3d0', color: '#fff' },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
            </Button>
          </Box>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Don&apos;t have an account?{' '}
              <Link
                component={RouterLink} to="/register"
                sx={{ fontWeight: 600, color: TEAL_DARK, textDecoration: 'none' }}
              >
                Sign Up
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
