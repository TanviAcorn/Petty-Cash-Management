import React from "react";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Chip,
  Avatar,
  useTheme,
  useMediaQuery,
  Divider,
} from "@mui/material";

// Icons
import {
  Dashboard,
  PlaylistAddCheck,
  PendingActions,
  DoneAll,
  Close,
  PeopleAlt,
  Apartment,
  Settings,
} from "@mui/icons-material";

const drawerWidth = 240;

const sidebarItems = [
  { text: "Dashboard", icon: <Dashboard />, path: "/dashboard" },
  { text: "All Requests", icon: <PlaylistAddCheck />, path: "/requests" },
  { text: "Pending Approval", icon: <PendingActions />, path: "/pending" },
  { text: "Approved", icon: <DoneAll />, path: "/approved" },
  { text: "Rejected", icon: <Close />, path: "/rejected" },
  { text: "User Management", icon: <PeopleAlt />, path: "/users" },
  { text: "Companies", icon: <Apartment />, path: "/companies" },
  { text: "Settings", icon: <Settings />, path: "/settings" },
];

const Sidebar = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const activePath = window.location.pathname;

  const drawerContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* App Title and Admin Chip */}
      <Toolbar sx={{ justifyContent: "space-between", p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              backgroundColor: theme.palette.primary.main,
              borderRadius: 1,
              mr: 1,
            }}
          />
          <Typography variant="h6" noWrap sx={{ fontWeight: "bold" }}>
            HR PettyCash
          </Typography>
        </Box>
        <Chip label="Admin" color="success" size="small" sx={{ ml: 1 }} />
      </Toolbar>
      <Divider />
      {/* Navigation List (no scrollbar) */}
      
      <List sx={{ flex: 1, px: 1, overflow: "hidden" }}>
        {" "}
        {/* prevent scrolling */}
        {sidebarItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ py: 0.5 }}>
            <ListItemButton
              selected={activePath === item.path}
              sx={{
                borderRadius: 2,
                "&.Mui-selected": {
                  backgroundColor: theme.palette.success.main, // ✅ green active
                  color: "white",
                  "& .MuiListItemIcon-root": {
                    color: "white",
                  },
                  "&:hover": {
                    backgroundColor: theme.palette.success.dark,
                  },
                },
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      {/* User Info at the bottom */}
      <Divider />
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <Avatar
          sx={{
            bgcolor: theme.palette.grey[300],
            color: theme.palette.text.primary,
          }}
        >
          AU
        </Avatar>
        <Box>
          <Typography variant="body1" fontWeight="bold">
            Admin User
          </Typography>
          <Typography variant="body2" color="text.secondary">
            admin@company.com
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
    >
      {/* Mobile Drawer (Temporary) */}
      <Drawer
        variant="temporary"
        open={isMobile && open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer (Permanent) */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: drawerWidth,
            borderRight: "none",
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
};

export default Sidebar;