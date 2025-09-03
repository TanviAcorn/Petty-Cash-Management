import React, { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";

// MUI components
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
} from "@mui/material";

// MUI icons
import { Add, Edit, Delete } from "@mui/icons-material";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "User",
    company: "",
    department: "",
  });

  // Fetch users
  const fetchUsers = async () => {
    const res = await axiosClient.get("/users");
    setUsers(res.data);
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
    if (editingUser) {
      await axiosClient.put(`/users/${editingUser.id}`, formData);
    } else {
      await axiosClient.post("/users", formData);
    }
    setOpen(false);
    setEditingUser(null);
    fetchUsers();
  };

  // Edit user
  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData(user);
    setOpen(true);
  };

  // Delete user
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      await axiosClient.delete(`/users/${id}`);
      fetchUsers();
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

  return (
    <Box sx={{ p: 4, maxWidth: "1000px", mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          👥 User Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddUser}
        >
          Add User
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={3}>
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
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.firstName} {u.lastName}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role}</TableCell>
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

      {/* Dialog for Add/Edit */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {editingUser ? "Edit User" : "Create New User"}
        </DialogTitle>
        <DialogContent>
          <Box
            component="form"
            sx={{ display: "grid", gap: 2, mt: 1 }}
            onSubmit={handleSubmit}
          >
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                fullWidth
                name="firstName"
                label="First Name"
                value={formData.firstName}
                onChange={handleChange}
              />
              <TextField
                fullWidth
                name="lastName"
                label="Last Name"
                value={formData.lastName}
                onChange={handleChange}
              />
            </Box>
            <TextField
              fullWidth
              name="email"
              label="Email"
              value={formData.email}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              type="password"
              name="password"
              label="Password"
              value={formData.password}
              onChange={handleChange}
            />
            <Select
              fullWidth
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <MenuItem value="User">User</MenuItem>
              <MenuItem value="Admin">Admin</MenuItem>
            </Select>
            <TextField
              fullWidth
              name="company"
              label="Company"
              value={formData.company}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              name="department"
              label="Department"
              value={formData.department}
              onChange={handleChange}
            />
          </Box>
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



