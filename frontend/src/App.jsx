// src/App.jsx
import React, { useState } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useEffect } from "react";
import {
  Box,
  CssBaseline,
  AppBar,
  IconButton,
  Toolbar,
  Avatar,
  Typography,
  Chip,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Tooltip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import Person from "@mui/icons-material/Person";
import Sidebar from "./components/Sidebar";
import { useColorMode } from './theme/ColorMode.jsx';
import { useAuth } from "./contexts/AuthContext";
import Brightness6Icon from '@mui/icons-material/Brightness6';

// Pages
import Dashboard from "./pages/Dashboard";
import UserDashboard from "./pages/UserDashboard";
import UserManagement from "./pages/UserManagement";
import AllRequests from "./pages/AllRequests";
import PendingApproval from "./pages/PendingApproval";
import Approved from "./pages/Approved";
import Rejected from "./pages/Rejected";
import Companies from "./pages/Companies";
import Settings from "./pages/Settings";
import MyRequests from "./pages/MyRequests";
import NewRequest from "./pages/NewRequest";
import Profile from "./pages/Profile";
import RequestReview from "./pages/RequestReview";
import UserRequestDetails from "./pages/UserRequestDetails";
import { menuItems, getMenuItemsByRole } from "./components/Sidebar";

const drawerWidth = 260;

const App = () => {
  const theme = useTheme();
  const { mode, toggle } = useColorMode();
  const { user: userInfo, logout } = useAuth();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const [currentMenuItems, setCurrentMenuItems] = useState(menuItems);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    // Navigation will be handled automatically by AuthGate
  };

  const navigate = useNavigate();
  const [pageTitle, setPageTitle] = useState('Dashboard');

  const location = useLocation();

  // Update menu items based on user role
  useEffect(() => {
    if (userInfo) {
      const roleBasedMenuItems = getMenuItemsByRole(userInfo.role);
      setCurrentMenuItems(roleBasedMenuItems);
    } else {
      setCurrentMenuItems(menuItems);
    }
  }, [userInfo]);
  
  // Update page title when route changes and handle initial redirects
  useEffect(() => {
    const currentPage = currentMenuItems.find(item => item.path === location.pathname);
    
    if (currentPage) {
      setPageTitle(currentPage.text);
    } else if (location.pathname === '/') {
      // Redirect to appropriate dashboard based on role
      if (userInfo?.role === 'Admin') {
        navigate('/dashboard', { replace: true });
        setPageTitle('Dashboard');
      } else if (userInfo) {
        navigate('/user-dashboard', { replace: true });
        setPageTitle('Dashboard');
      }
    } else if (location.pathname === '/dashboard' && userInfo?.role !== 'Admin') {
      // If non-admin tries to access admin dashboard, redirect to user dashboard
      navigate('/user-dashboard', { replace: true });
      setPageTitle('Dashboard');
    } else if (location.pathname === '/user-dashboard' && userInfo?.role === 'Admin') {
      // If admin tries to access user dashboard, redirect to admin dashboard
      navigate('/dashboard', { replace: true });
      setPageTitle('Dashboard');
    } else if (/^\/requests\/[0-9]+$/.test(location.pathname)) {
      // Handle request review page
      setPageTitle('Request Review');
    } else if (/^\/my-requests\/[0-9]+$/.test(location.pathname)) {
      // Handle request details page
      setPageTitle('Request Details');
    }
  }, [location, navigate, currentMenuItems, userInfo]);

  const handleNavigation = (path, title) => {
    navigate(path);
    setPageTitle(title);
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <CssBaseline />
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          boxShadow: "none",
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {pageTitle}
          </Typography>

          {!isSmallScreen && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Chip
                icon={<Brightness6Icon />}
                label={mode === 'light' ? 'Light' : 'Dark'}
                size="small"
                variant="outlined"
                onClick={toggle}
                sx={{ cursor: 'pointer' }}
              />
              <Tooltip title="Account settings">
                <IconButton
                  onClick={handleMenuOpen}
                  size="small"
                  sx={{ ml: 1 }}
                  aria-controls={menuOpen ? "account-menu" : undefined}
                  aria-haspopup="true"
                  aria-expanded={menuOpen ? "true" : undefined}
                >
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    <Person fontSize="small" />
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                id="account-menu"
                open={menuOpen}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    overflow: "visible",
                    filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.12))",
                    mt: 1.5,
                    "& .MuiAvatar-root": {
                      width: 32,
                      height: 32,
                      ml: -0.5,
                      mr: 1,
                    },
                    "&:before": {
                      content: '""',
                      display: "block",
                      position: "absolute",
                      top: 0,
                      right: 14,
                      width: 10,
                      height: 10,
                      bgcolor: "background.paper",
                      transform: "translateY(-50%) rotate(45deg)",
                      zIndex: 0,
                    },
                  },
                }}
                transformOrigin={{ horizontal: "right", vertical: "top" }}
                anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              >
                {userInfo?.role === 'Admin' ? (
                  <MenuItem onClick={() => handleNavigation("/settings", "Settings")}>
                    <ListItemIcon>
                      <SettingsIcon fontSize="small" />
                    </ListItemIcon>
                    Settings
                  </MenuItem>
                ) : (
                  <MenuItem onClick={() => handleNavigation("/profile", "Profile")}>
                    <ListItemIcon>
                      <Person fontSize="small" />
                    </ListItemIcon>
                    Profile
                  </MenuItem>
                )}
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  Log out
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: { xs: "56px", sm: "64px" },
          p: 3,
          overflowY: "auto",
          overflowX: "hidden",
          backgroundColor: theme.palette.background.default,
          minHeight: "calc(100vh - 64px)",
        }}
      >
        <Routes>
          <Route path="/" element={
            userInfo?.role === 'Admin' ? 
            <Navigate to="/dashboard" replace /> : 
            <Navigate to="/user-dashboard" replace />
          } />
          {/* Protected Admin Routes */}
          <Route path="/dashboard" element={
            userInfo?.role === 'Admin' ? 
            <Dashboard /> : 
            <Navigate to="/user-dashboard" replace />
          } />
          
          <Route path="/users" element={
            userInfo?.role === 'Admin' ? 
            <UserManagement /> : 
            <Navigate to="/user-dashboard" replace />
          } />
          
          <Route path="/requests" element={
            userInfo?.role === 'Admin' ? 
            <AllRequests /> : 
            <Navigate to="/user-dashboard" replace />
          } />
          
          <Route path="/requests/:id" element={
            userInfo?.role === 'Admin' ? 
            <RequestReview /> : 
            <Navigate to="/user-dashboard" replace />
          } />
          
          <Route path="/pending-approval" element={
            userInfo?.role === 'Admin' ? 
            <PendingApproval /> : 
            <Navigate to="/user-dashboard" replace />
          } />
          
          <Route path="/approved" element={
            userInfo?.role === 'Admin' ? 
            <Approved /> : 
            <Navigate to="/user-dashboard" replace />
          } />
          
          <Route path="/rejected" element={
            userInfo?.role === 'Admin' ? 
            <Rejected /> : 
            <Navigate to="/user-dashboard" replace />
          } />
          
          <Route path="/companies" element={
            userInfo?.role === 'Admin' ? 
            <Companies /> : 
            <Navigate to="/user-dashboard" replace />
          } />
          
          <Route path="/settings" element={
            userInfo?.role === 'Admin' ? 
            <Settings /> : 
            <Navigate to="/profile" replace />
          } />
          
          {/* Protected User Routes */}
          <Route path="/user-dashboard" element={
            userInfo?.role === 'Admin' ? 
            <Navigate to="/dashboard" replace /> : 
            <UserDashboard />
          } />
          
          <Route path="/my-requests" element={
            userInfo?.role === 'Admin' ? 
            <Navigate to="/requests" replace /> : 
            <MyRequests />
          } />
          
          <Route path="/my-requests/:id" element={
            userInfo?.role === 'Admin' ? 
            <Navigate to="/requests" replace /> : 
            <UserRequestDetails />
          } />
          
          <Route path="/new-request" element={
            userInfo?.role === 'Admin' ? 
            <Navigate to="/dashboard" replace /> : 
            <NewRequest />
          } />
          
          {/* Public Routes */}
          <Route path="/profile" element={<Profile />} />
          
          {/* Catch-all route */}
          <Route path="*" element={
            userInfo?.role === 'Admin' ? 
            <Navigate to="/dashboard" replace /> : 
            <Navigate to="/user-dashboard" replace />
          } />
        </Routes>
      </Box>
    </Box>
  );
};

export default App;
