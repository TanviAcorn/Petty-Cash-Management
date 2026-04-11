import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, MenuItem, IconButton, Typography, Box
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export default function AddUserModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "",
    role: "User", company: "", department: "",
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: `${form.firstName} ${form.lastName}`,
      email: form.email,
      password: form.password,
      role: form.role,
      company: form.company,
      department: form.department,
    });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Create New User</Typography>
          <Typography variant="body2" color="text.secondary">
            Add a new user with their role and company information.
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="First Name" name="firstName"
                value={form.firstName} onChange={handleChange} required />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Last Name" name="lastName"
                value={form.lastName} onChange={handleChange} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Email" name="email" type="email"
                value={form.email} onChange={handleChange} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Password" name="password" type="password"
                value={form.password} onChange={handleChange} required />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" select label="Role" name="role"
                value={form.role} onChange={handleChange}>
                <MenuItem value="User">User</MenuItem>
                <MenuItem value="Admin">Admin</MenuItem>
                <MenuItem value="Payment">Payment</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Company" name="company"
                value={form.company} onChange={handleChange} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" select label="Department" name="department"
                value={form.department} onChange={handleChange} required>
                <MenuItem value=""><em>Select department</em></MenuItem>
                <MenuItem value="IT">IT</MenuItem>
                <MenuItem value="Finance">Finance</MenuItem>
                <MenuItem value="Admin">Admin</MenuItem>
                <MenuItem value="HR">HR</MenuItem>
                <MenuItem value="Operations">Operations</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} variant="outlined">Cancel</Button>
          <Button type="submit" variant="contained" color="success">Create User</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
