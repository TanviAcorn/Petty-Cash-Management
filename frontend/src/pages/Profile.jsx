import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Grid,
  Avatar,
  Alert,
  Snackbar,
  IconButton,
  InputAdornment,
  Paper,
  Divider,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  Business as BusinessIcon,
  Work as WorkIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Visibility,
  VisibilityOff,
  Save as SaveIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Badge as BadgeIcon,
  AccountCircle as AccountCircleIcon,
  CalendarMonth as CalendarMonthIcon,
  Shield as ShieldIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5005/api'}/users`;

const Profile = () => {
  const [editMode, setEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  
  const [user, setUser] = useState(null); // Initialize as null instead of empty object

  const [passwordErrors, setPasswordErrors] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const [initialUser, setInitialUser] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data) {
          const userData = response.data;
          const userState = {
            ...userData,
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
            accountCreated: userData.accountCreated || '9/10/2025',
            lastUpdated: userData.lastUpdated || '9/10/2025',
            accountStatus: userData.accountStatus || 'Active',
          };
          
          setUser(userState);
          setInitialUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        try {
          const storedUser = JSON.parse(localStorage.getItem('user'));
          if (storedUser) {
            const userState = {
              ...storedUser,
              currentPassword: '',
              newPassword: '',
              confirmPassword: '',
              accountCreated: storedUser.accountCreated || '9/10/2025',
              lastUpdated: storedUser.lastUpdated || '9/10/2025',
              accountStatus: storedUser.accountStatus || 'Active',
            };
            setUser(userState);
            setInitialUser(storedUser);
          }
        } catch (e) {
          console.error('Error parsing stored user data:', e);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleChange = (e) => {
    if (!user) return;
    
    const { name, value } = e.target;
    setUser(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validatePassword = () => {
    const errors = {
      current: '',
      new: '',
      confirm: ''
    };
    let isValid = true;

    if (!user.currentPassword) {
      errors.current = 'Current password is required';
      isValid = false;
    }

    if (!user.newPassword) {
      errors.new = 'New password is required';
      isValid = false;
    } else if (user.newPassword.length < 6) {
      errors.new = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (user.newPassword !== user.confirmPassword) {
      errors.confirm = 'Passwords do not match';
      isValid = false;
    }

    setPasswordErrors(errors);
    return isValid;
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      // Extract password fields and get the rest as profile data
      const { currentPassword, newPassword, confirmPassword, ...profileData } = user;
      
      // Call the common service to update the profile
      const response = await commonService.updateProfile(user.id, profileData);
      
      console.log('Profile update response:', response);
      
      // Create the updated user object
      const updatedUser = {
        ...user,
        ...profileData,
        lastUpdated: new Date().toISOString().split('T')[0] // Update the last updated timestamp
      };

      // Update localStorage and state
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setSnackbar({
        open: true,
        message: response?.message || 'Profile updated successfully',
        severity: 'success'
      });
      
      // Update state
      setEditMode(false);
      setUser(updatedUser);
      setInitialUser(updatedUser);

    } catch (error) {
      console.error('Error:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'An error occurred. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!validatePassword()) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      await axios.put(
        `${API_URL}/change-password`,
        {
          currentPassword: user.currentPassword,
          newPassword: user.newPassword
        },
        config
      );
      
      setSnackbar({
        open: true,
        message: 'Password changed successfully',
        severity: 'success'
      });
      
      setUser(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      
      setPasswordErrors({
        current: '',
        new: '',
        confirm: ''
      });
    } catch (error) {
      console.error('Error:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'An error occurred. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setUser(initialUser);
  };

  const handleClickShowPassword = (field) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Show loading state while user data is being fetched
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error state if user data couldn't be loaded
  if (!user) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">Failed to load user data. Please try again later.</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => window.location.reload()}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  const renderUserInfo = () => (
    <Grid container spacing={3} sx={{ mt: 2 }}>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="First Name"
          name="firstName"
          value={user.firstName || ''}
          margin="normal"
          disabled
          InputProps={{
            readOnly: true,
          }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Last Name"
          name="lastName"
          value={user.lastName || ''}
          margin="normal"
          disabled
          InputProps={{
            readOnly: true,
          }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Email Address"
          name="email"
          value={user.email || ''}
          margin="normal"
          disabled
          InputProps={{
            readOnly: true,
          }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Role"
          name="role"
          value={user.role || ''}
          margin="normal"
          disabled
          InputProps={{
            readOnly: true,
          }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Company"
          name="company"
          value={user.company || ''}
          margin="normal"
          disabled
          InputProps={{
            readOnly: true,
          }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Department"
          name="department"
          value={user.department || ''}
          margin="normal"
          disabled
          InputProps={{
            readOnly: true,
          }}
        />
      </Grid>
    </Grid>
  );

  const renderEditForm = () => (
    <Box component="form" id="profile-form" onSubmit={handleProfileSubmit}>
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="First Name"
            name="firstName"
            value={user.firstName || ''}
            onChange={handleChange}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Last Name"
            name="lastName"
            value={user.lastName || ''}
            onChange={handleChange}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            name="email"
            value={user.email || ''}
            onChange={handleChange}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Role"
            name="role"
            value={user.role || ''}
            margin="normal"
            disabled
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Company"
            name="company"
            value={user.company || ''}
            onChange={handleChange}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Department"
            name="department"
            value={user.department || ''}
            onChange={handleChange}
            margin="normal"
          />
        </Grid>
      </Grid>
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button
          variant="outlined"
          onClick={handleCancel}
          startIcon={<CloseIcon />}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="profile-form"
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={loading}
        >
          Save Changes
        </Button>
      </Box>
    </Box>
  );

  if (loading && !user.id) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Typography>Loading profile...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      {/* Header and Title */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Profile
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your personal information and account settings
        </Typography>
      </Box>

      {/* Personal Information Module */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PersonIcon />
            <Box>
              <Typography variant="h6" fontWeight="bold">Personal Information</Typography>
              <Typography variant="body2" color="text.secondary">Your personal details used throughout the system</Typography>
            </Box>
          </Stack>
          {!editMode && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => setEditMode(true)}
              disabled={loading}
              sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
            >
              Edit Profile
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        {/* Profile Card Summary */}
        {!editMode && (
          <>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
                {user.firstName ? user.firstName.charAt(0) : ''}{user.lastName ? user.lastName.charAt(0) : ''}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">{user.firstName} {user.lastName}</Typography>
                <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                <Typography variant="caption" sx={{ bgcolor: 'grey.200', px: 1, borderRadius: 1 }}>{user.role}</Typography>
              </Box>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">First Name</Typography>
                <Typography variant="body1" fontWeight="medium">{user.firstName}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Last Name</Typography>
                <Typography variant="body1" fontWeight="medium">{user.lastName}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Email Address</Typography>
                <Typography variant="body1" fontWeight="medium">{user.email}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Role</Typography>
                <Typography variant="body1" fontWeight="medium">{user.role}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Company</Typography>
                <Typography variant="body1" fontWeight="medium">{user.company}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Department</Typography>
                <Typography variant="body1" fontWeight="medium">{user.department}</Typography>
              </Grid>
            </Grid>
          </>
        )}
        
        {/* Edit Form */}
        {editMode && renderEditForm()}
      </Paper>

      {/* Account Security Module */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <ShieldIcon />
          <Box>
            <Typography variant="h6" fontWeight="bold">Account Security</Typography>
            <Typography variant="body2" color="text.secondary">Manage your password and security settings</Typography>
          </Box>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Box component="form" onSubmit={handlePasswordSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Current Password"
                type={showPassword.current ? 'text' : 'password'}
                name="currentPassword"
                value={user.currentPassword || ''}
                onChange={handleChange}
                margin="normal"
                error={!!passwordErrors.current}
                helperText={passwordErrors.current}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={() => handleClickShowPassword('current')} edge="end">
                      {showPassword.current ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="New Password"
                type={showPassword.new ? 'text' : 'password'}
                name="newPassword"
                value={user.newPassword || ''}
                onChange={handleChange}
                margin="normal"
                error={!!passwordErrors.new}
                helperText={passwordErrors.new || 'At least 6 characters'}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={() => handleClickShowPassword('new')} edge="end">
                      {showPassword.new ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Confirm New Password"
                type={showPassword.confirm ? 'text' : 'password'}
                name="confirmPassword"
                value={user.confirmPassword || ''}
                onChange={handleChange}
                margin="normal"
                error={!!passwordErrors.confirm}
                helperText={passwordErrors.confirm}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={() => handleClickShowPassword('confirm')} edge="end">
                      {showPassword.confirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  ),
                }}
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Change Password'}
            </Button>
          </Box>
        </Box>
      </Paper>
      
      {/* Account Information Module */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <InfoIcon />
          <Box>
            <Typography variant="h6" fontWeight="bold">Account Information</Typography>
            <Typography variant="body2" color="text.secondary">Additional details about your account</Typography>
          </Box>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Account Created</Typography>
            <Typography variant="body1" fontWeight="medium">{user.accountCreated}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Last Updated</Typography>
            <Typography variant="body1" fontWeight="medium">{user.lastUpdated}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">User ID</Typography>
            <Typography variant="body1" fontWeight="medium">{user.id}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Account Status</Typography>
            <Typography variant="body1" fontWeight="medium" color="success.main">
              <CheckCircleIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />{user.accountStatus}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
          elevation={6}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Profile;