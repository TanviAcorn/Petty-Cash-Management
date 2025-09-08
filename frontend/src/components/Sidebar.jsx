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
    { text: "Settings", icon: <Settings />, path: "/settings" },
  ];

  const userMenuItems = [
    { text: "Dashboard", icon: <Dashboard />, path: "/dashboard" },
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
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
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
              bgcolor: "primary.main",
              color: "white",
              px: 0.8,
              py: 0.1,
              borderRadius: 1,
              display: "inline-block",
            }}
          >
            {user?.role || 'Admin'}
          </Typography>
        </Box>
      </Box>

      {/* Menu */}
      <List sx={{ flexGrow: 1 }}>
        {currentMenuItems.map((item) => (
          <ListItem
            key={item.text}
            disablePadding
            sx={{
              mb: 0.5,
            }}
          >
            <ListItemButton
              component={Link}
              to={item.path}
              selected={active === item.text}
              sx={{
                borderRadius: 2,
                mx: 1,
                width: '100%',
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "white",
                  "& .MuiSvgIcon-root": { color: "white" },
                },
                '&:hover': {
                  textDecoration: 'none',
                  bgcolor: 'action.hover',
                },
                '&.Mui-selected:hover': {
                  bgcolor: 'primary.dark',
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