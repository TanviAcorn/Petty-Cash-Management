import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Paper,
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
    <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%', p: 3 }}>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
          Welcome back, {user.firstName || 'John'}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your petty cash requests and expenses.
        </Typography>
      </Box>

      {/* Stats Cards Row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'flex-start' }}>
        {/* My Requests Card */}
        <Card sx={{ 
          bgcolor: '#1976d2',
          color: 'white',
          minWidth: 200,
          height: 120
        }}>
          <CardContent sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center' }}>
            <ReceiptIcon sx={{ fontSize: 40, mr: 2 }} />
            <Box>
              <Typography variant="h3" fontWeight="bold" sx={{ lineHeight: 1 }}>
                {stats.totalRequests}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                My Requests
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Pending Card */}
        <Card sx={{ 
          bgcolor: '#ff9800',
          color: 'white',
          minWidth: 200,
          height: 120
        }}>
          <CardContent sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center' }}>
            <AccessTimeIcon sx={{ fontSize: 40, mr: 2 }} />
            <Box>
              <Typography variant="h3" fontWeight="bold" sx={{ lineHeight: 1 }}>
                {stats.pending}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                Pending
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* This Month Card */}
        <Card sx={{ 
          bgcolor: '#4caf50',
          color: 'white',
          minWidth: 200,
          height: 120
        }}>
          <CardContent sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center' }}>
            <AttachMoneyIcon sx={{ fontSize: 40, mr: 2 }} />
            <Box>
              <Typography variant="h4" fontWeight="bold" sx={{ lineHeight: 1 }}>
                {formatCurrency(stats.thisMonthAmount)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                This Month
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* New Request Card */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          ml: 2
        }}>
          <Box sx={{ 
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '2px dashed #1976d2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: '#f0f2ff'
            }
          }}
          component={Link}
          to="/new-request"
          >
            <AddIcon sx={{ fontSize: 30, color: '#1976d2' }} />
          </Box>
          <Typography 
            variant="body2" 
            sx={{ 
              mt: 1, 
              color: '#1976d2', 
              fontWeight: 'medium',
              textDecoration: 'none'
            }}
            component={Link}
            to="/new-request"
          >
            New Request
          </Typography>
        </Box>
      </Box>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
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
                    py: 1.5,
                    bgcolor: '#1976d2',
                    '&:hover': { bgcolor: '#1565c0' },
                    textTransform: 'uppercase',
                    fontWeight: 'bold'
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
                    py: 1.5,
                    textTransform: 'uppercase',
                    fontWeight: 'bold'
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
                    py: 1.5,
                    textTransform: 'uppercase',
                    fontWeight: 'bold'
                  }}
                >
                  Update Profile
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* My Requests */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, height: 'fit-content', textAlign: 'center' }}>
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
                bgcolor: '#1976d2',
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}
            >
              View Requests
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Paper sx={{ mt: 4, p: 3 }}>
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
      </Paper>
    </Box>
  );
};

export default UserDashboard;
