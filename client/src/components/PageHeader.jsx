import { Box, Chip, Typography } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { TEAL, TEAL_DARK } from '../utils/constants';
import usePermissions from '../hooks/usePermissions';

// Consistent page title band: icon + title + subtitle, read-only badge for
// viewers, and a slot for page-level actions (e.g. "Editing" chip, export).
const PageHeader = ({ title, subtitle, icon, actions }) => {
  const { canWrite } = usePermissions();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
      {icon && (
        <Box
          sx={{
            width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
            bgcolor: `${TEAL}1c`, color: TEAL_DARK,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        )}
      </Box>
      {!canWrite && (
        <Chip
          size="small"
          icon={<VisibilityIcon sx={{ fontSize: 15 }} />}
          label="Read-only"
          sx={{ bgcolor: '#fef9c3', color: '#854d0e', '& .MuiChip-icon': { color: '#854d0e' } }}
        />
      )}
      {actions}
    </Box>
  );
};

export default PageHeader;
