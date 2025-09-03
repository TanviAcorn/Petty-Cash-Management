// src/App.jsx

import React, { useState } from "react";
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
  InputBase,
  alpha,
  useMediaQuery,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import Sidebar from "./components/Sidebar";
import UserManagement from "./pages/UserManagement";

const drawerWidth = 240;

const App = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {" "}
      {/* <-- KEY CHANGE */}
      <CssBaseline />
      {/* Main App Bar at the top */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          boxShadow: "none",
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: "white",
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
            User Management
          </Typography>

          {!isSmallScreen && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="body1" fontWeight="bold">
                AU
              </Typography>
              <Chip label="Admin" color="success" size="small" />
            </Box>
          )}
        </Toolbar>
      </AppBar>
      {/* Sidebar component */}
      <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: { xs: "56px", sm: "64px" },
          overflow: "hidden", // ✅ fix: no sidebar scroll
        }}
      >
        <UserManagement />
      </Box>
    </Box>
  );
};

export default App;
