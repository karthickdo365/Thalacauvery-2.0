import { Button } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { exportToExcel } from '../utils/exportExcel';

const ExportButton = ({ data, columns, filename, disabled }) => (
  <Button
    variant="outlined"
    size="small"
    startIcon={<FileDownloadIcon />}
    disabled={disabled || !data?.length}
    onClick={() => exportToExcel(data, columns, filename)}
    sx={{ borderColor: 'secondary.main', color: 'secondary.main' }}
  >
    Export Excel
  </Button>
);

export default ExportButton;
