// src/components/Sidebar.jsx
import React from "react";
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

// Icons
import {
  Dashboard,
  ListAlt,
  CheckCircle,
  Cancel,
  People,
  Business,
  Settings,
} from "@mui/icons-material";

const drawerWidth = 260;

const menuItems = [
  { text: "Dashboard", icon: <Dashboard /> },
  { text: "All Requests", icon: <ListAlt /> },
  { text: "Pending Approval", icon: <ListAlt /> },
  { text: "Approved", icon: <CheckCircle /> },
  { text: "Rejected", icon: <Cancel /> },
  { text: "User Management", icon: <People /> },
  { text: "Companies", icon: <Business /> },
  { text: "Settings", icon: <Settings /> },
];

export default function Sidebar({ active = "User Management" }) {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          borderRight: "1px solid #f0f0f0",
        },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            bgcolor: "success.main",
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
              bgcolor: "success.main",
              color: "white",
              px: 0.8,
              py: 0.1,
              borderRadius: 1,
              display: "inline-block",
            }}
          >
            Admin
          </Typography>
        </Box>
      </Box>

      {/* Menu */}
      <List sx={{ flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItem
            key={item.text}
            disablePadding
            sx={{
              mb: 0.5,
            }}
          >
            <ListItemButton
              selected={active === item.text}
              sx={{
                borderRadius: 2,
                mx: 1,
                "&.Mui-selected": {
                  bgcolor: "success.main",
                  color: "white",
                  "& .MuiSvgIcon-root": { color: "white" },
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
        <Avatar sx={{ bgcolor: "grey.400" }}>AU</Avatar>
        <Box>
          <Typography fontSize="0.9rem">Admin User</Typography>
          <Typography fontSize="0.75rem" color="text.secondary">
            admin@company.com
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}