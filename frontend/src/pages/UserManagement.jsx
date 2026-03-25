// src/pages/UserManagement.jsx

import { useState, useEffect, useMemo, useCallback } from "react";
import axiosClient from "../api/axiosClient";
import Pagination from '../components/Pagination';

// MUI components
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Typography,
  Chip,
  InputBase,
} from "@mui/material";
import { alpha } from '@mui/material/styles';

// MUI icons
import {
  Add,
  Edit,
  Delete,
  People,
  Person,
  Apartment,
  Search as SearchIcon,
  AccountBalance,
} from "@mui/icons-material";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // Add separate state for all users (for L1 Manager dropdown)
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0,
  });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "User",
    company: "",
    department: "",
    l1ManagerId: "", // Add L1 Manager field
  });
  const [searchQuery, setSearchQuery] = useState("");

  const fetchUsers = useCallback(async (page = pagination.currentPage, limit = pagination.itemsPerPage) => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await axiosClient.get("/users", { params });
      const usersList = Array.isArray(res.data?.data || res.data) ? (res.data.data || res.data) : [];
      setUsers(usersList);
      if (res.data?.pagination) setPagination(res.data.pagination);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, pagination.currentPage, pagination.itemsPerPage]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [searchQuery]);

  // Fetch companies from backend
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await axiosClient.get('/companies');
        const companiesData = Array.isArray(response.data?.data) ? response.data.data : response.data;
        setCompanies(companiesData || []);
      } catch (error) {
        console.error('Failed to fetch companies:', error);
        setCompanies([]);
      }
    };
    fetchCompanies();
  }, []);

  // Fetch ALL users for L1 Manager dropdown (without pagination)
  const fetchAllUsers = useCallback(async () => {
    try {
      const response = await axiosClient.get('/users', { 
        params: { 
          page: 1, 
          limit: 1000 // Get a large number to include all users
        } 
      });
      const usersList = Array.isArray(response.data?.data) ? response.data.data : [];
      setAllUsers(usersList);
    } catch (error) {
      console.error('Failed to fetch all users:', error);
      setAllUsers([]);
    }
  }, []);

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`Field changed: ${name} = ${value} (type: ${typeof value})`); // Debug log
    setFormData({ ...formData, [name]: value });
  };

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
      l1ManagerId: "", // Reset L1 Manager
    });
    setOpen(true);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    
    // Split the full name into first and last names
    let firstName = '';
    let lastName = '';
    
    if (user.name) {
      const nameParts = user.name.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    
    // Convert l1ManagerId to string for the dropdown (MUI Select expects string values)
    const l1ManagerIdValue = user.l1ManagerId ? String(user.l1ManagerId) : '';
    
    console.log('Editing user:', { 
      userId: user.id, 
      l1ManagerId: user.l1ManagerId, 
      l1ManagerIdValue,
      l1ManagerName: user.l1ManagerName 
    });
    
    // Set form data with split names and L1 Manager
    setFormData({
      ...user,
      firstName,
      lastName,
      password: '', // Clear password for security
      l1ManagerId: l1ManagerIdValue, // Include L1 Manager as string
    });
    
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // For editing, only send the password if a new one was entered
        const dataToUpdate = { ...formData };
        if (!dataToUpdate.password) {
          delete dataToUpdate.password;
        }
        
        console.log('Before conversion - l1ManagerId:', dataToUpdate.l1ManagerId, 'Type:', typeof dataToUpdate.l1ManagerId);
        
        // Convert l1ManagerId to number or null
        if (dataToUpdate.l1ManagerId && dataToUpdate.l1ManagerId !== '') {
          dataToUpdate.l1ManagerId = parseInt(dataToUpdate.l1ManagerId, 10);
          console.log('After conversion - l1ManagerId:', dataToUpdate.l1ManagerId, 'Type:', typeof dataToUpdate.l1ManagerId);
        } else {
          dataToUpdate.l1ManagerId = null;
          console.log('Set l1ManagerId to null');
        }
        
        console.log('Updating user with data:', JSON.stringify(dataToUpdate, null, 2));
        await axiosClient.put(`/users/${editingUser.id}`, dataToUpdate);
        console.log('Update successful, refreshing user list...');
      } else {
        // For creating, password is required
        const dataToCreate = { ...formData };
        
        console.log('Before conversion - l1ManagerId:', dataToCreate.l1ManagerId, 'Type:', typeof dataToCreate.l1ManagerId);
        
        // Convert l1ManagerId to number or null
        if (dataToCreate.l1ManagerId && dataToCreate.l1ManagerId !== '') {
          dataToCreate.l1ManagerId = parseInt(dataToCreate.l1ManagerId, 10);
          console.log('After conversion - l1ManagerId:', dataToCreate.l1ManagerId, 'Type:', typeof dataToCreate.l1ManagerId);
        } else {
          dataToCreate.l1ManagerId = null;
          console.log('Set l1ManagerId to null');
        }
        
        console.log('Creating user with data:', JSON.stringify(dataToCreate, null, 2));
        await axiosClient.post("/users", dataToCreate);
        console.log('Create successful, refreshing user list...');
      }
      
      // Close dialog first
      setOpen(false);
      setEditingUser(null);
      
      // Force refresh both user lists
      await fetchUsers(pagination.currentPage, pagination.itemsPerPage);
      await fetchAllUsers();
      
      console.log('User lists refreshed successfully');
    } catch (error) {
      console.error("Failed to save user:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      alert(`Failed to save user: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await axiosClient.delete(`/users/${id}`);
        fetchUsers(); // Refresh paginated list
        fetchAllUsers(); // Refresh all users list
      } catch (error) {
        console.error("Failed to delete user:", error);
      }
    }
  };

  const totalUsers = pagination.totalItems;
  const adminUsers = users.filter((user) => user.role === "Admin").length;
  const paymentUsers = users.filter((user) => user.role === "Payment").length;
  const uniqueCompanies = new Set(
    users.filter((user) => user.company).map((user) => user.company)
  ).size;

  const filteredUsers = useMemo(() => {
    // Since filtering is now done on the backend, we just return the users as-is
    return users;
  }, [users]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
    fetchUsers(newPage, pagination.itemsPerPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setPagination(prev => ({ ...prev, itemsPerPage: newItemsPerPage, currentPage: 1 }));
    fetchUsers(1, newItemsPerPage);
  };

  // Reusable StatCard for metrics
  const StatCard = ({ icon, label, value, color = 'primary' }) => (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, bgcolor: 'background.paper', borderColor: 'divider' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.25 }}>
        <Box sx={(theme)=>({ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1, bgcolor: alpha(theme.palette[color].main, 0.15), color: theme.palette[color].main })}>
          {icon}
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="h6" fontWeight={700}>{value}</Typography>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, pb: 5, minHeight: "100%", backgroundColor: "background.default", maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage user accounts and permissions
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={handleAddUser}>
          Add User
        </Button>
      </Box>

      <Box sx={{
        display: 'grid',
        gap: 2,
        mb: 4,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }
      }}>
        <StatCard icon={<People />} label="Total Users" value={totalUsers} color="primary" />
        <StatCard icon={<Person />} label="Admins" value={adminUsers} color="success" />
        <StatCard icon={<AccountBalance />} label="Payment Users" value={paymentUsers} color="info" />
        <StatCard icon={<Apartment />} label="Companies" value={uniqueCompanies} color="secondary" />
      </Box>

      <Card variant="outlined">
        <CardHeader
          title={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Typography variant="h6" fontWeight="bold">
                Users
              </Typography>
            </Box>
          }
          subheader={
            <Typography variant="body2" color="text.secondary">
              A list of all users in your system
            </Typography>
          }
          action={
            <Box sx={{ display: "flex", alignItems: "center", border: 1, borderColor: 'divider', borderRadius: 1, p: "4px 8px", bgcolor: 'background.paper' }}>
              <SearchIcon sx={{ color: "text.secondary", mr: 1 }} />
              <InputBase
                placeholder="Search users..."
                inputProps={{ "aria-label": "search" }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Box>
          }
          sx={{ borderBottom: 1, borderColor: "divider" }}
        />
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>L1 Manager</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={u.role.toLowerCase()}
                          size="small"
                          color={
                            u.role === "Admin" ? "primary" : 
                            u.role === "Payment" ? "success" : 
                            "default"
                          }
                          sx={{ textTransform: "lowercase" }}
                        />
                      </TableCell>
                      <TableCell>{u.company}</TableCell>
                      <TableCell>{u.department}</TableCell>
                      <TableCell>{u.l1ManagerName || '-'}</TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" onClick={() => handleEdit(u)}>
                          <Edit />
                        </IconButton>
                        <IconButton color="error" onClick={() => handleDelete(u.id)}>
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
      
      {/* Pagination */}
      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        itemsPerPage={pagination.itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
        loading={loading}
      />

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
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
              <TextField
                fullWidth
                select
                name="role"
                label="Role *"
                value={formData.role}
                onChange={handleChange}
              >
                <MenuItem value="User">User</MenuItem>
                <MenuItem value="Admin">Admin</MenuItem>
                <MenuItem value="Payment">Payment</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                name="company"
                label="Company"
                value={formData.company || ""}
                onChange={handleChange}
              >
                <MenuItem value="">
                  <em>Select Company</em>
                </MenuItem>
                {Array.isArray(companies) && companies.map((company) => (
                  <MenuItem key={company.id} value={company.name}>
                    {company.name}
                  </MenuItem>
                ))}
              </TextField>
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                name="l1ManagerId"
                label="L1 Manager (Optional)"
                value={formData.l1ManagerId || ""}
                onChange={handleChange}
                helperText={
                  formData.l1ManagerId 
                    ? `Selected Manager ID: ${formData.l1ManagerId} (${allUsers.find(u => String(u.id) === String(formData.l1ManagerId))?.name || 'Unknown'})` 
                    : 'No manager selected'
                }
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {Array.isArray(allUsers) && allUsers
                  .filter(user => user.id !== editingUser?.id) // Don't allow user to be their own manager
                  .map((user) => (
                    <MenuItem key={user.id} value={String(user.id)}>
                      {user.name} ({user.email}) - ID: {user.id}
                    </MenuItem>
                  ))}
              </TextField>
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