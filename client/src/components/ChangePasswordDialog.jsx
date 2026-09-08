import { useState } from 'react';
import {
  Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, InputAdornment, TextField,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import api from '../utils/api';

const ChangePasswordDialog = ({ open, onClose }) => {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const handleClose = () => { reset(); onClose(); };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password updated');
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Change Password</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            fullWidth label="Current Password" margin="dense" size="small"
            type={show ? 'text' : 'password'} autoComplete="current-password"
            {...register('currentPassword', { required: 'Required' })}
            error={!!errors.currentPassword} helperText={errors.currentPassword?.message}
          />
          <TextField
            fullWidth label="New Password" margin="dense" size="small"
            type={show ? 'text' : 'password'} autoComplete="new-password"
            {...register('newPassword', {
              required: 'Required',
              minLength: { value: 6, message: 'Min 6 characters' },
            })}
            error={!!errors.newPassword} helperText={errors.newPassword?.message}
          />
          <TextField
            fullWidth label="Confirm New Password" margin="dense" size="small"
            type={show ? 'text' : 'password'} autoComplete="new-password"
            {...register('confirmPassword', {
              validate: (v) => v === watch('newPassword') || 'Passwords do not match',
            })}
            error={!!errors.confirmPassword} helperText={errors.confirmPassword?.message}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShow((p) => !p)} edge="end">
                    {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleClose} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" color="secondary" disabled={loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Update'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ChangePasswordDialog;
