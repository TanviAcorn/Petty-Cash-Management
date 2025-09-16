// src/components/Sidebar.jsx
import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  Divider,
} from "@mui/material";
import { useAuth } from "../contexts/AuthContext";

// Icons
import {
  Dashboard,
  ListAlt,
  CheckCircle,
  Cancel,
  People,
  Business,
  Settings,
  AddCircle,
  Person,
  AttachMoney,
} from "@mui/icons-material";

const drawerWidth = 260;

// Role-based menu items
const getMenuItemsByRole = (userRole) => {
  const adminMenuItems = [
    { text: "Dashboard", icon: <Dashboard />, path: "/dashboard" },
    { text: "All Requests", icon: <ListAlt />, path: "/requests" },
    { text: "Pending Approval", icon: <ListAlt />, path: "/pending-approval" },
    { text: "Approved", icon: <CheckCircle />, path: "/approved" },
    { text: "Rejected", icon: <Cancel />, path: "/rejected" },
    { text: "User Management", icon: <People />, path: "/users" },
    { text: "Companies", icon: <Business />, path: "/companies" },
    { text: "Payments", icon: <AttachMoney />, path: "/payments" },
    { text: "Settings", icon: <Settings />, path: "/settings" },
  ];

  const userMenuItems = [
    { text: "Dashboard", icon: <Dashboard />, path: "/user-dashboard" },
    { text: "My Requests", icon: <ListAlt />, path: "/my-requests" },
    { text: "New Request", icon: <AddCircle />, path: "/new-request" },
    { text: "Profile", icon: <Person />, path: "/profile" },
  ];

  return userRole === 'Admin' ? adminMenuItems : userMenuItems;
};

// Default menu items for backward compatibility
const menuItems = [
  { text: "Dashboard", icon: <Dashboard />, path: "/dashboard" },
  { text: "All Requests", icon: <ListAlt />, path: "/requests" },
  { text: "Pending Approval", icon: <ListAlt />, path: "/pending-approval" },
  { text: "Approved", icon: <CheckCircle />, path: "/approved" },
  { text: "Rejected", icon: <Cancel />, path: "/rejected" },
  { text: "User Management", icon: <People />, path: "/users" },
  { text: "Companies", icon: <Business />, path: "/companies" },
  { text: "Payments", icon: <AttachMoney />, path: "/payments" },
  { text: "Settings", icon: <Settings />, path: "/settings" },
];

export { menuItems, getMenuItemsByRole };

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth?.() || { user: null };
  const [active, setActive] = useState('');
  const [currentMenuItems, setCurrentMenuItems] = useState(menuItems);

  // Update menu items based on user role
  useEffect(() => {
    if (user) {
      const roleBasedMenuItems = getMenuItemsByRole(user.role);
      setCurrentMenuItems(roleBasedMenuItems);
    } else {
      setCurrentMenuItems(menuItems);
    }
  }, [user]);

  useEffect(() => {
    const currentPage = currentMenuItems.find(item => location.pathname === item.path);
    if (currentPage) {
      setActive(currentPage.text);
    } else if (location.pathname === '/') {
      navigate('/dashboard');
      setActive('Dashboard');
    }
  }, [location.pathname, navigate, currentMenuItems]);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2.25, display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            bgcolor: "primary.main",
            borderRadius: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
            fontSize: "18px",
          }}
        >
          HR
        </Box>
        <Box>
          <Typography fontWeight="bold">HR PettyCash</Typography>
          <Typography
            sx={{
              fontSize: "11px",
              bgcolor: (theme) => theme.palette.mode === 'light' ? 'primary.main' : 'primary.dark',
              color: "white",
              px: 0.8,
              py: 0.2,
              borderRadius: 1,
              display: "inline-block",
              boxShadow: (theme) => `0 2px 6px ${theme.palette.primary.main}25`,
            }}
          >
            {user?.role || 'Admin'}
          </Typography>
        </Box>
      </Box>

      {/* Menu */}
      <List sx={{ flexGrow: 1, px: 0.5 }}>
        {currentMenuItems.map((item) => (
          <ListItem
            key={item.text}
            disablePadding
            sx={{
              mb: 0.25,
            }}
          >
            <ListItemButton
              component={Link}
              to={item.path}
              selected={active === item.text}
              sx={{
                borderRadius: 2,
                mx: 0.75,
                width: '100%',
                transition: 'all .15s ease-in-out',
                '& .MuiListItemText-primary': { fontWeight: 500 },
                "&.Mui-selected": {
                  bgcolor: (theme) => theme.palette.mode === 'light' ? 'primary.main' : 'primary.dark',
                  color: "white",
                  "& .MuiSvgIcon-root": { color: "white" },
                  boxShadow: (theme) => `0 6px 14px ${theme.palette.primary.main}33`,
                },
                '&:hover': {
                  textDecoration: 'none',
                  bgcolor: 'action.hover',
                  transform: 'translateY(-1px)'
                },
                '&.Mui-selected:hover': {
                  bgcolor: (theme) => theme.palette.mode === 'light' ? 'primary.main' : 'primary.dark',
                  transform: 'translateY(-1px)'
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: active === item.text ? "white" : "text.secondary",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{ fontSize: "0.95rem" }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box sx={{ minWidth: 0 }}>
        <Typography fontSize="0.8rem" color="text.secondary" noWrap sx={{ lineHeight: 1.8 }}>
          © Acorn Universal Consultancy LLP, {new Date().getFullYear()}.
        </Typography>
      </Box>

      <Divider />
        
      {/* Footer with User */}
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Avatar sx={{ bgcolor: "primary.main" }}>
          {(user?.firstName?.[0] || user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontSize="0.9rem" noWrap title={user?.firstName ? `${user.firstName} ${user?.lastName || ''}`.trim() : (user?.name || 'User')}>
            {user?.firstName ? `${user.firstName} ${user?.lastName || ''}`.trim() : (user?.name || 'User')}
          </Typography> 
          <Typography fontSize="0.75rem" color="text.secondary" noWrap title={user?.email || ''}>
            {user?.email || ''}
          </Typography>
        </Box>
      </Box>

    </Drawer>
  );
}