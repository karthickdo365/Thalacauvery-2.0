import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Delete',
  message = 'Are you sure? This cannot be undone.',
  confirmLabel = 'Delete',
}) => (
  <Dialog open={open} onClose={onClose} PaperProps={{ sx: { minWidth: 320 } }}>
    <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary">{message}</Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
      <Button onClick={onClose} color="inherit">Cancel</Button>
      <Button color="error" variant="contained" onClick={onConfirm}>{confirmLabel}</Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;
