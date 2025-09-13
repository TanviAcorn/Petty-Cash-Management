import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
  Receipt as ReceiptIcon,
  AccessTime as AccessTimeIcon,
  AttachMoney as AttachMoneyIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Pending as PendingIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import axiosClient from '../api/axiosClient';

// Reusable modern stat card (visual parity with Admin Dashboard)
const StatCard = ({ icon, label, value }) => (
  <Card
    variant="outlined"
    sx={{
      height: '100%',
      borderRadius: 3,
      borderColor: 'divider',
      background: (theme) => theme.palette.mode === 'light'
        ? 'linear-gradient(180deg, rgba(2,6,23,0.02) 0%, rgba(2,6,23,0) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)',
      boxShadow: (theme) => `0 6px 16px ${theme.palette.mode==='light' ? 'rgba(2,6,23,0.05)' : 'rgba(0,0,0,0.35)'}`,
    }}
  >
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 2.5 }}>
      <Box sx={(theme)=>({
        width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2,
        bgcolor: theme.palette.action.hover,
      })}>
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={800}>{value}</Typography>
      </Box>
    </CardContent>
  </Card>
);

const UserDashboard = () => {
  const [user, setUser] = useState({});
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user info from localStorage
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(userData);

    // Fetch user's requests
    const fetchRequests = async () => {
      try {
        const { data } = await axiosClient.get('/requests', {
          params: { email: userData?.email }
        });
        setRequests(Array.isArray(data?.data || data) ? (data.data || data) : []);
      } catch (error) {
        console.error('Error fetching requests:', error);
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const stats = useMemo(() => {
    const totalRequests = requests.length;
    const pending = requests.filter(r => String(r.status).toLowerCase() === 'pending').length;
    const thisMonthAmount = requests
      .filter(r => {
        const requestDate = new Date(r.dateOfPurchase || r.date);
        const now = new Date();
        return requestDate.getMonth() === now.getMonth() && 
               requestDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    return { totalRequests, pending, thisMonthAmount };
  }, [requests]);

  const recentRequests = useMemo(() => {
    return requests
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
      .slice(0, 3);
  }, [requests]);

  const getStatusIcon = (status) => {
    switch (String(status).toLowerCase()) {
      case 'approved':
        return <CheckCircleIcon sx={{ color: '#4caf50' }} />;
      case 'rejected':
        return <CancelIcon sx={{ color: '#f44336' }} />;
      case 'pending':
      default:
        return <PendingIcon sx={{ color: '#ff9800' }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (String(status).toLowerCase()) {
      case 'approved':
        return '#4caf50';
      case 'rejected':
        return '#f44336';
      case 'pending':
      default:
        return '#ff9800';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Number(amount || 0));
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%', p: { xs: 2, sm: 3 } }}>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
          Welcome back, {user.firstName || 'John'}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your petty cash requests and expenses.
        </Typography>
      </Box>

      {/* Stats Cards Row (modern) */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', mb: 2 }}>
        <StatCard icon={<ReceiptIcon color="primary" />} label="My Requests" value={stats.totalRequests} />
        <StatCard icon={<AccessTimeIcon color="warning" />} label="Pending" value={stats.pending} />
        <StatCard icon={<AttachMoneyIcon color="success" />} label="This Month" value={formatCurrency(stats.thisMonthAmount)} />
      </Box>

      {/* Main Content Grid */}
      <Grid container spacing={2.5}>
        {/* Quick Actions */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined" sx={{ p: 3, height: 'fit-content' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<ReceiptIcon />}
                  component={Link}
                  to="/new-request"
                  sx={{ 
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 600
                  }}
                >
                  Submit New Request
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<ReceiptIcon />}
                  component={Link}
                  to="/my-requests"
                  sx={{ 
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 600
                  }}
                >
                  View My Requests
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<PersonIcon />}
                  component={Link}
                  to="/profile"
                  sx={{ 
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 600
                  }}
                >
                  Update Profile
                </Button>
              </Grid>
            </Grid>
          </Card>
        </Grid>

        {/* My Requests */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ p: 3, height: 'fit-content', textAlign: 'center' }}>
            <ReceiptIcon sx={{ fontSize: 60, color: '#1976d2', mb: 2 }} />
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
              My Requests
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              View and track your submitted requests
            </Typography>
            <Button
              variant="contained"
              component={Link}
              to="/my-requests"
              sx={{ 
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              View Requests
            </Button>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Card variant="outlined" sx={{ mt: 4, p: 3 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
          Recent Activity
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your latest petty cash requests
        </Typography>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Loading recent activity...
            </Typography>
          </Box>
        ) : recentRequests.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No recent requests found
            </Typography>
          </Box>
        ) : (
          <List>
            {recentRequests.map((request, index) => (
              <ListItem
                key={request.id || index}
                sx={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  mb: 1,
                  '&:last-child': { mb: 0 }
                }}
              >
                <ListItemIcon>
                  {getStatusIcon(request.status)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body1" fontWeight="medium">
                        {request.category || 'Office supplies request'}
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {formatCurrency(request.amount)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {request.dateOfPurchase ? 
                          new Date(request.dateOfPurchase).toLocaleDateString() :
                          request.date ? 
                          new Date(request.date).toLocaleDateString() :
                          'January 19, 2024'
                        }
                      </Typography>
                      <Chip
                        label={request.status || 'approved'}
                        size="small"
                        sx={{
                          bgcolor: getStatusColor(request.status),
                          color: 'white',
                          fontWeight: 'medium'
                        }}
                      />
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Card>
    </Box>
  );
};

export default UserDashboard;
