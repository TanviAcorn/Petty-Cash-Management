import React, { useEffect, useMemo, useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Table, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableBody, 
  CircularProgress,
  Card,
  CardContent,
  Grid,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Add as AddIcon,
  Search,
  FilterList,
  Visibility,
  Edit,
  Delete,
  Description,
  AttachMoney,
  CheckCircle,
  Schedule,
  Cancel
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

const MyRequests = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user')||'{}'); } catch { return {}; }
  }, []);

  const load = async () => {
    if (!user?.email) {
      setError('No user email found. Please re-login.');
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/requests', { params: { email: user.email } });
      setRows(Array.isArray(data?.data || data) ? (data.data || data) : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load your requests');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fmtMoney = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(n||0));

  // Calculate dashboard stats
  const stats = useMemo(() => {
    const totalRequests = rows.length;
    const pending = rows.filter(r => r.status === 'pending').length;
    const approved = rows.filter(r => r.status === 'approved').length;
    const totalAmount = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
    return { totalRequests, pending, approved, totalAmount };
  }, [rows]);

  // Filter requests based on search and status
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const matchesSearch = !searchTerm || 
        row.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All Status' || row.status === statusFilter.toLowerCase();
      
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchTerm, statusFilter]);

  const getStatusChip = (status) => {
    const statusConfig = {
      approved: { color: 'success', icon: <CheckCircle sx={{ fontSize: 16 }} />, label: 'approved' },
      pending: { color: 'warning', icon: <Schedule sx={{ fontSize: 16 }} />, label: 'pending' },
      rejected: { color: 'error', icon: <Cancel sx={{ fontSize: 16 }} />, label: 'rejected' },
      'in-review': { color: 'info', icon: <Schedule sx={{ fontSize: 16 }} />, label: 'in-review' }
    };

    const config = statusConfig[status?.toLowerCase()] || { color: 'default', icon: null, label: status };
    
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        sx={{ textTransform: 'capitalize', fontWeight: 'medium' }}
      />
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1200, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box>
        <Typography variant="h5" fontWeight={700}>My Requests</Typography>
        <Typography variant="body2" color="text.secondary">Track and manage your petty cash reimbursement requests</Typography>
      </Box>

      {/* Dashboard Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#fff', borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ 
                bgcolor: '#e3f2fd', 
                borderRadius: 2, 
                p: 1.5, 
                mr: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Description sx={{ color: '#1976d2', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Total Requests
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {stats.totalRequests}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#fff', borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ 
                bgcolor: '#fff3e0', 
                borderRadius: 2, 
                p: 1.5, 
                mr: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Schedule sx={{ color: '#f57c00', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Pending
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {stats.pending}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#fff', borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ 
                bgcolor: '#e8f5e8', 
                borderRadius: 2, 
                p: 1.5, 
                mr: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle sx={{ color: '#2e7d32', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Approved
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {stats.approved}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#fff', borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ 
                bgcolor: '#e8f5e8', 
                borderRadius: 2, 
                p: 1.5, 
                mr: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AttachMoney sx={{ color: '#2e7d32', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Total Amount
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {fmtMoney(stats.totalAmount)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Your Requests Section */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* Section Header */}
        <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              Your Requests
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              component={Link}
              to="/new-request"
              sx={{ 
                bgcolor: '#1976d2',
                '&:hover': { bgcolor: '#1565c0' }
              }}
            >
              New Request
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">
            All your petty cash reimbursement requests
          </Typography>
        </Box>

        {/* Search and Filter */}
        <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0', bgcolor: '#fafafa' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: '#666' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'white',
                    '&:hover fieldset': {
                      borderColor: '#1976d2',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1976d2',
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status Filter"
                  sx={{
                    bgcolor: 'white',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#1976d2',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#1976d2',
                    },
                  }}
                >
                  <MenuItem value="All Status">All Status</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                  <MenuItem value="In-review">In Review</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        {/* Table Content */}
        <Box sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={32} />
            </Box>
          ) : filteredRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 8 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                {rows.length === 0 ? 'No requests found' : 'No matching requests'}
              </Typography>
              <Typography variant="body2">
                {error || (rows.length === 0 ? 'Create a new petty cash request to get started.' : 'Try adjusting your search or filter criteria.')}
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', color: '#666' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#666' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#666' }}>Company</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#666' }} align="right">Amount</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#666' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#666' }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((r, index) => (
                  <TableRow 
                    key={r.id || index} 
                    hover
                    sx={{ 
                      '&:hover': { bgcolor: '#f9f9f9' },
                      borderBottom: '1px solid #e0e0e0'
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" fontWeight="medium">
                        {r.dateOfPurchase ? new Date(r.dateOfPurchase).toLocaleDateString() : 
                         r.date ? new Date(r.date).toLocaleDateString() : '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Submitted: {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 
                                   r.date ? new Date(r.date).toLocaleDateString() : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={r.category} 
                        size="small" 
                        variant="outlined"
                        sx={{ bgcolor: '#f0f0f0' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {r.company}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold">
                        {fmtMoney(r.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(r.status)}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton size="small" sx={{ color: '#1976d2' }}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" sx={{ color: '#f57c00' }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" sx={{ color: '#d32f2f' }}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default MyRequests;
