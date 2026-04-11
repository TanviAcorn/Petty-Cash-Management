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
import { formatCurrency } from '../utils/currency';
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
        return '#ff9800';
      case 'payment done':
        return '#2e7d32';
      case 'processed':
        return '#0288d1';
      case 'intercompany':
        return '#ff9800';
      default:
        return '#ff9800';
    }
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
        <StatCard icon={<AttachMoneyIcon color="success" />} label="This Month" value={stats.thisMonthAmount} />
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
              <Grid item xs={12} sm={4}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<ReceiptIcon />}
                  component={Link}
                  to="/new-request"
                  sx={{ py: 1.25, textTransform: 'none', fontWeight: 600 }}
                >
                  New Request
                </Button>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<AddIcon />}
                  component={Link}
                  to="/new-travel-request"
                  sx={{ py: 1.25, textTransform: 'none', fontWeight: 600 }}
                >
                  New Travel Request
                </Button>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<PersonIcon />}
                  component={Link}
                  to="/profile"
                  sx={{ py: 1.25, textTransform: 'none', fontWeight: 600 }}
                >
                  My Profile
                </Button>
              </Grid>
            </Grid>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ p: 3, height: 'fit-content' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>Recent Activity</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Your latest requests</Typography>
            {loading ? (
              <Typography variant="body2" color="text.secondary">Loading...</Typography>
            ) : recentRequests.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No recent requests</Typography>
            ) : (
              <List disablePadding>
                {recentRequests.map((request, index) => (
                  <ListItem key={request.id || index} disablePadding sx={{ mb: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>{getStatusIcon(request.status)}</ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="body2" fontWeight={500} noWrap>{request.category || '—'}</Typography>}
                      secondary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            {request.dateOfPurchase ? new Date(request.dateOfPurchase).toLocaleDateString() : '—'}
                          </Typography>
                          <Chip label={request.status} size="small" sx={{ height: 16, fontSize: '0.65rem', bgcolor: getStatusColor(request.status), color: '#fff' }} />
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UserDashboard;
