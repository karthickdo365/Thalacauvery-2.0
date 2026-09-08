import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  AppBar, Avatar, Box, Chip, Divider, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Menu, MenuItem, Toolbar, Typography,
  useMediaQuery, useTheme, Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import LogoutIcon from '@mui/icons-material/Logout';
import LockResetIcon from '@mui/icons-material/LockReset';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { logout } from '../redux/slices/authSlice';
import { toggleTheme, selectThemeMode } from '../redux/slices/themeSlice';
import { useMachine } from '../context/MachineContext';
import { NAVY, NAVY_DARK, TEAL, TEAL_DARK } from '../utils/constants';
import usePermissions from '../hooks/usePermissions';
import ChangePasswordDialog from './ChangePasswordDialog';

const drawerWidth = 260;

const menuItems = [
  { text: 'Dashboard',            icon: <DashboardIcon />,  path: '/dashboard' },
  { text: 'Personal Information', icon: <PeopleIcon />,     path: '/personal-info' },
  { text: 'Materials',            icon: <InventoryIcon />,  path: '/materials' },
  { text: 'Agent Information',    icon: <ReceiptIcon />,    path: '/borewell-points' },
  { text: 'Points',               icon: <WaterDropIcon />,  path: '/bills' },
  { text: 'Attendance & Salary',  icon: <EventNoteIcon />,  path: '/attendance' },
  { text: 'Reports',              icon: <AssessmentIcon />, path: '/reports' },
];

const adminMenuItems = [
  { text: 'Activity Log', icon: <HistoryIcon />,        path: '/activity-logs' },
  { text: 'Accounts',     icon: <ManageAccountsIcon />, path: '/accounts' },
];

const ROLE_LABELS = { admin: 'Admin', partner: 'Partner', viewer: 'Viewer' };

const navItemSx = {
  mx: 1.25, mb: 0.5, borderRadius: 2, color: 'rgba(255,255,255,0.72)',
  '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.55)', minWidth: 38 },
  '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
  '&.Mui-selected': {
    bgcolor: TEAL, color: '#fff',
    '& .MuiListItemIcon-root': { color: '#fff' },
    '&:hover': { bgcolor: TEAL_DARK },
  },
};

const Layout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user, role, canWrite } = usePermissions();
  const themeMode = useSelector(selectThemeMode);
  const { currentMachine, clearMachine, isBig } = useMachine();

  const allItems = canWrite ? [...menuItems, ...adminMenuItems] : menuItems;
  const pageTitle = allItems.find((i) => i.path === location.pathname)?.text || 'Dashboard';
  const machineLabel = isBig ? 'BIG MACHINE' : 'SMALL MACHINE';

  const handleLogout = () => {
    dispatch(logout());
    clearMachine();
    navigate('/login');
  };

  const handleSwitchMachine = () => {
    clearMachine();
    navigate('/machine-selection');
    if (isMobile) setMobileOpen(false);
  };

  const handleNav = (path) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const renderItem = (item) => (
    <ListItemButton
      key={item.path}
      selected={location.pathname === item.path}
      onClick={() => handleNav(item.path)}
      sx={navItemSx}
    >
      <ListItemIcon>{item.icon}</ListItemIcon>
      <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.88rem', fontWeight: 500 }} />
    </ListItemButton>
  );

  const drawer = (
    <Box
      sx={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
      }}
    >
      {/* Brand */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 40, height: 40, borderRadius: '12px', bgcolor: `${TEAL}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <WaterDropIcon sx={{ color: TEAL, fontSize: 22 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.05em', lineHeight: 1.2 }}>
            THALACUVERY
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
            BOREWELL MANAGEMENT
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Current Machine Badge */}
      <Box sx={{ px: 2, py: 1.5 }}>
        <Box
          sx={{
            px: 1.5, py: 1, borderRadius: 2,
            bgcolor: isBig ? `${TEAL}22` : 'rgba(59,130,246,0.15)',
            border: `1px solid ${isBig ? TEAL : '#3b82f6'}44`,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: isBig ? TEAL : '#60a5fa', fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.1em' }}>
            {machineLabel}
          </Typography>
        </Box>
      </Box>

      <List sx={{ flex: 1, pt: 0.5, overflowY: 'auto' }}>
        <Typography sx={{ px: 2.5, pb: 0.75, color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em' }}>
          MENU
        </Typography>
        {menuItems.map(renderItem)}

        {canWrite && (
          <>
            <Typography sx={{ px: 2.5, pt: 2, pb: 0.75, color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em' }}>
              ADMINISTRATION
            </Typography>
            {adminMenuItems.map(renderItem)}
          </>
        )}
      </List>

      {/* Switch Machine */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Button
          fullWidth
          startIcon={<SwapHorizIcon />}
          onClick={handleSwitchMachine}
          sx={{
            color: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.82rem',
            py: 0.9,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: TEAL, color: TEAL },
          }}
        >
          Switch Machine
        </Button>
      </Box>

      {/* User card */}
      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <Avatar sx={{ bgcolor: TEAL, width: 34, height: 34, fontSize: '0.9rem', fontWeight: 700 }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography noWrap sx={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600 }}>
              {user?.name || 'User'}
            </Typography>
            <Typography sx={{ color: canWrite ? TEAL : 'rgba(255,255,255,0.5)', fontSize: '0.68rem', fontWeight: 600 }}>
              {ROLE_LABELS[role] || 'Viewer'}{!canWrite && ' · read-only'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 700, fontSize: '1.05rem' }}>
            {pageTitle}
          </Typography>

          <Chip
            size="small"
            label={machineLabel}
            sx={{
              bgcolor: isBig ? `${TEAL}18` : 'rgba(59,130,246,0.12)',
              color: isBig ? TEAL_DARK : '#2563eb',
              fontWeight: 700,
              fontSize: '0.72rem',
              mr: 0.5,
            }}
          />

          {!canWrite && !isMobile && (
            <Chip size="small" label="Read-only access" sx={{ bgcolor: '#fef9c3', color: '#854d0e', mr: 1 }} />
          )}

          <IconButton color="inherit" onClick={() => dispatch(toggleTheme())} title="Toggle theme">
            {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
            <Avatar sx={{ bgcolor: TEAL, width: 34, height: 34, fontSize: '0.9rem', fontWeight: 700 }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            slotProps={{ paper: { sx: { minWidth: 200, mt: 1 } } }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" fontWeight={700}>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                @{user?.username} · {ROLE_LABELS[role] || 'Viewer'}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); setPwdOpen(true); }}>
              <ListItemIcon><LockResetIcon fontSize="small" /></ListItemIcon>
              Change Password
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); handleSwitchMachine(); }}>
              <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon>
              Switch Machine
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <Drawer
            variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: drawerWidth, border: 'none' } }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent" open
            sx={{ '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', border: 'none' } }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, mt: 8, width: { md: `calc(100% - ${drawerWidth}px)` }, minWidth: 0 }}>
        <Outlet />
      </Box>

      <ChangePasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </Box>
  );
};

export default Layout;
