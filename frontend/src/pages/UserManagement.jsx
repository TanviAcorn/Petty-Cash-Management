// src/pages/UserManagement.jsx

import React, { useState, useEffect, useMemo } from "react";
import axiosClient from "../api/axiosClient";

// MUI components
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  Paper,
  Typography,
  Chip,
  InputBase,
  Tabs,
  Tab,
  Badge,
} from "@mui/material";

// MUI icons
import {
  Add,
  Edit,
  Delete,
  People,
  Person,
  Apartment,
  Search as SearchIcon,
} from "@mui/icons-material";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "User",
    company: "",
    department: "",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      const res = await axiosClient.get("/users");
      setUsers(res.data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);


  // Handle input
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Save user
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await axiosClient.put(`/users/${editingUser.id}`, formData);
      } else {
        await axiosClient.post("/users", formData);
      }
      setOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Failed to save user:", error);
    }
  };

  // Edit user
  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({ ...user, password: "" }); // Clear password field for security
    setOpen(true);
  };

  // Delete user
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await axiosClient.delete(`/users/${id}`);
        fetchUsers();
      } catch (error) {
        console.error("Failed to delete user:", error);
      }
    }
  };

  // Open modal for add user
  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "User",
      company: "",
      department: "",
    });
    setOpen(true);
  };

  // Calculate summary stats
  const totalUsers = users.length;
  const adminUsers = users.filter((user) => user.role === "Admin").length;
  const uniqueCompanies = new Set(users.filter((user) => user.company).map((user) => user.company)).size;

  // Filter users based on active tab
  const filteredUsersByTab = () => {
    switch (activeTab) {
      case 0: // All Users
        return users;
      case 1: // Admins
        return users.filter((user) => user.role === "Admin");
      case 2: // Companies
        return users.filter((user) => user.company);
      default:
        return users;
    }
  };

  // Get users for current tab
  const currentTabUsers = filteredUsersByTab();

  // Filtered users for search functionality
  const filteredUsers = useMemo(() => {
    return currentTabUsers.filter((user) =>
      (user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.company?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [currentTabUsers, searchQuery]);

  const cardStyle = {
    elevation: 4,
    sx: {
      borderRadius: 2,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      p: 2,
    },
  };

  const statCard = (title, value, icon, iconColor) => (
    <Card {...cardStyle}>
      <CardContent
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1,
        }}
      >
        <Box>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold">
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: iconColor,
            p: 1.5,
            borderRadius: "50%",
            color: "white",
          }}
        >
          {icon}
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, pt: { xs: 10, sm: 10, md: 4 } }}>
      {/* Header section with User Management title and Add User button */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            👥 User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage user accounts and permissions
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddUser}
          sx={{ ml: "auto" }}
        >
          Add User
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ width: "100%", mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            "& .MuiTabs-indicator": {
              backgroundColor: "success.main",
              height: 3,
            },
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 500,
              fontSize: "0.9375rem",
              "&.Mui-selected": {
                color: "success.main",
              },
            },
          }}
        >
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <People />
                <span>Total Users</span>
                <Chip
                  label={totalUsers}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.7rem",
                    bgcolor: activeTab === 0 ? "success.light" : "grey.200",
                    color: activeTab === 0 ? "white" : "inherit",
                  }}
                />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Person />
                <span>Admins</span>
                <Chip
                  label={adminUsers}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.7rem",
                    bgcolor: activeTab === 1 ? "success.light" : "grey.200",
                    color: activeTab === 1 ? "white" : "inherit",
                  }}
                />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Apartment />
                <span>Companies</span>
                <Chip
                  label={uniqueCompanies}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.7rem",
                    bgcolor: activeTab === 2 ? "success.light" : "grey.200",
                    color: activeTab === 2 ? "white" : "inherit",
                  }}
                />
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* Summary Cards */}
      {/* <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          {statCard("Total Users", totalUsers, <People />, "primary.main")}
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          {statCard("Admins", adminUsers, <Person />, "success.main")}
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          {statCard("Companies", uniqueCompanies, <Apartment />, "warning.main")}
        </Grid>
      </Grid> */}

      {/* User List Card with Search */}
      <Card elevation={4}>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight="bold">Users</Typography>
              <Typography variant="body2" color="text.secondary">
                A list of all users in your system
              </Typography>
            </Box>
          }
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: 1, p: '4px 8px' }}>
              <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
              <InputBase
                placeholder="Search users..."
                inputProps={{ 'aria-label': 'search' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Box>
          }
          sx={{ borderBottom: "1px solid", borderColor: "grey.200" }}
        />
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.firstName} {u.lastName}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={u.role.toLowerCase()}
                          size="small"
                          color={u.role === 'Admin' ? 'success' : 'default'}
                          sx={{ textTransform: 'lowercase' }}
                        />
                      </TableCell>
                      <TableCell>{u.company}</TableCell>
                      <TableCell>{u.department}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          color="primary"
                          onClick={() => handleEdit(u)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(u.id)}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Dialog for Add/Edit */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                name="firstName"
                label="First Name"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                name="lastName"
                label="Last Name"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="email"
                label="Email"
                value={formData.email}
                onChange={handleChange}
                type="email"
                required
              />
            </Grid>
            {!editingUser && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  name="password"
                  label="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <Select
                fullWidth
                name="role"
                value={formData.role}
                onChange={handleChange}
                label="Role"
                displayEmpty
              >
                <MenuItem value="User">User</MenuItem>
                <MenuItem value="Admin">Admin</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="company"
                label="Company"
                value={formData.company}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="department"
                label="Department"
                value={formData.department}
                onChange={handleChange}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingUser ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;