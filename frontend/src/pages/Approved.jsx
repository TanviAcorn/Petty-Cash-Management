import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  OutlinedInput,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  CircularProgress,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Checkbox,
  Button,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import SendIcon from '@mui/icons-material/Send';
import axiosClient from '../api/axiosClient';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import Pagination from '../components/Pagination';
import { useAuth } from '../contexts/AuthContext';

const timeRanges = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Year', value: 'year' },
];

const statusColor = (s) => {
  switch ((s || '').toLowerCase()) {
    case 'approved': return { color: 'success', label: 'approved' };
    case 'rejected': return { color: 'error', label: 'rejected' };
    case 'intercompany': return { color: 'secondary', label: 'intercompany' };
    case 'processed': return { color: 'info', label: 'processed' };
    case 'payment done': return { color: 'success', label: 'payment done' };
    default: return { color: 'warning', label: 'pending' };
  }
};

const StatCard = ({ icon, label, value, color = 'primary' }) => (
  <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, bgcolor: 'background.paper', borderColor: 'divider' }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 2.5 }}>
      <Box
        sx={(theme) => ({
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          bgcolor: alpha(theme.palette[color].main, 0.15),
          color: theme.palette[color].main,
        })}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={700}>{value}</Typography>
      </Box>
    </CardContent>
  </Card>
);

const Approved = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [sendingBulkPayment, setSendingBulkPayment] = useState(false);
  const [bulkPaymentMessage, setBulkPaymentMessage] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState({
    total: 0,
    totalAmount: 0,
    avgAmount: 0,
    topCategory: { name: 'N/A', count: 0 }
  });
  const [payments, setPayments] = useState([]);
  const [company, setCompany] = useState('all');
  const [category, setCategory] = useState('all');
  const [range, setRange] = useState('all');
  const navigate = useNavigate();

  const companies = useMemo(() => ['all', ...Array.from(new Set(requests.map(r => r.company).filter(Boolean)))], [requests]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(requests.map(r => r.category).filter(Boolean)))], [requests]);

  const fetchData = useCallback(async (page = pagination.currentPage, limit = pagination.itemsPerPage) => {
    try {
      setLoading(true);
      
      const params = {
        page,
        limit,
        status: ['approved', 'intercompany']
      };
      
      // Add user role and company for Payment users
      if (user) {
        params.userRole = user.role;
        if (user.role === 'Payment' && user.company) {
          params.assignedCompany = user.company;
        }
      }
      
      // Add search if present
      if (searchTerm.trim()) {
        params.q = searchTerm.trim();
      }
      
      // Add company filter if not 'all'
      if (company !== 'all') {
        params.company = company;
      }
      
      // Add category filter if not 'all'
      if (category !== 'all') {
        params.category = category;
      }
      
      // Add date range filter if not 'all'
      if (range !== 'all') {
        params.range = range;
      }
      
      const { data } = await axiosClient.get('/requests', { params });
      const requestsList = Array.isArray(data?.data || data) ? (data.data || data) : [];
      setRequests(requestsList);
      
      // Update pagination state if pagination data is available
      if (data?.pagination) {
        setPagination(data.pagination);
        
        // Calculate statistics based on current filtered data
        if (requestsList.length > 0) {
          const total = data.pagination.totalItems;
          // For total amount and average, we'd need a separate endpoint or calculate differently
          // For now, using current page data
          const totalAmount = requestsList.reduce((sum, req) => sum + Number(req.amount || 0), 0);
          const avgAmount = requestsList.length > 0 ? totalAmount / requestsList.length : 0;

          // Find top category from current page data
          const categoryCounts = requestsList.reduce((acc, req) => {
            const cat = req.category || 'Uncategorized';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {});

          const topCategory = Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

          setStats({
            total,
            totalAmount,
            avgAmount,
            topCategory: { name: topCategory[0], count: topCategory[1] }
          });
        } else {
          setStats({
            total: data.pagination.totalItems,
            totalAmount: 0,
            avgAmount: 0,
            topCategory: { name: 'N/A', count: 0 }
          });
        }
      }
    } catch (error) {
      console.error('Error fetching approved requests:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, company, category, range, pagination.currentPage, pagination.itemsPerPage, user]);

  useEffect(() => {
    fetchData();
    // Load payments list for badges
    (async () => {
      try {
        const { data } = await axiosClient.get('/requests/payments/list');
        setPayments(Array.isArray(data?.data) ? data.data : []);
      } catch {}
    })();
  }, [fetchData]);

  const filteredRequests = useMemo(() => {
    // Since filtering is now done on the backend, we just return the requests as-is
    return requests;
  }, [requests]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
    fetchData(newPage, pagination.itemsPerPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setPagination(prev => ({ ...prev, itemsPerPage: newItemsPerPage, currentPage: 1 }));
    fetchData(1, newItemsPerPage);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedRequests(filteredRequests.map(r => r.id));
    } else {
      setSelectedRequests([]);
    }
  };

  const handleSelectRequest = (requestId) => {
    setSelectedRequests(prev => {
      if (prev.includes(requestId)) {
        return prev.filter(id => id !== requestId);
      } else {
        return [...prev, requestId];
      }
    });
  };

  const handleBulkPayment = async () => {
    if (selectedRequests.length === 0) {
      setBulkPaymentMessage({ type: 'error', text: 'Please select at least one request' });
      return;
    }

    try {
      setSendingBulkPayment(true);
      setBulkPaymentMessage(null);

      const response = await axiosClient.post('/requests/bulk-payment', {
        requestIds: selectedRequests
      });

      setBulkPaymentMessage({ 
        type: 'success', 
        text: `Successfully sent ${selectedRequests.length} request(s) to payment team` 
      });
      setSelectedRequests([]);
      
      // Reload page after a short delay to show the success message
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error sending bulk payment:', error);
      setBulkPaymentMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to send bulk payment notification' 
      });
      setSendingBulkPayment(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>Approved Requests</Typography>
        <Typography variant="body2" color="text.secondary">
          View and manage all approved petty cash reimbursement requests
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <StatCard
          icon={<CheckCircleOutlineIcon />}
          label="Total Approved"
          value={stats.total}
          color="success"
        />
        <StatCard
          icon={<AttachMoneyIcon />}
          label="Total Amount"
          value={stats.totalAmount}
          color="primary"
        />
        <StatCard
          icon={<TrendingUpIcon />}
          label="Average Amount"
          value={stats.avgAmount}
          color="info"
        />
        <StatCard
          icon={<ApartmentOutlinedIcon />}
          label="Intercompany"
          value={`${stats.topCategory.name} (${stats.topCategory.count})`}
          color="warning"
        />
      </Box>

      {/* Filters */}
      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search requests..."
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ width: 320, maxWidth: '100%' }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              input={<OutlinedInput />}
            >
              {timeRanges.map((range) => (
                <MenuItem key={range.value} value={range.value}>
                  {range.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              input={<OutlinedInput />}
              displayEmpty
            >
              <MenuItem value="all">All Companies</MenuItem>
              {companies.filter(c => c !== 'all').map((comp) => (
                <MenuItem key={comp} value={comp}>
                  {comp}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              input={<OutlinedInput />}
              displayEmpty
            >
              <MenuItem value="all">All Categories</MenuItem>
              {categories.filter(c => c !== 'all').map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
            {selectedRequests.length > 0 && (
              <>
                <Typography variant="body2" color="text.secondary">
                  {selectedRequests.length} selected
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SendIcon />}
                  onClick={handleBulkPayment}
                  disabled={sendingBulkPayment}
                >
                  {sendingBulkPayment ? 'Sending...' : 'Send to Payment'}
                </Button>
              </>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Bulk Payment Message */}
      {bulkPaymentMessage && (
        <Alert 
          severity={bulkPaymentMessage.type} 
          onClose={() => setBulkPaymentMessage(null)}
        >
          {bulkPaymentMessage.text}
        </Alert>
      )}

      {/* Requests Table */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={filteredRequests.length > 0 && selectedRequests.length === filteredRequests.length}
                      indeterminate={selectedRequests.length > 0 && selectedRequests.length < filteredRequests.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Date Approved</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Intercompany Transfer From</TableCell>
                  <TableCell>Intercompany Transfer To</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Loading approved requests...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                      <CheckCircleOutlineIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">
                        No approved requests found
                      </Typography>
                      {searchTerm && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Try adjusting your search criteria
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => {
                    const sc = statusColor('approved');
                    const pay = payments.find(p => p.requestId === request.id);
                    const isSelected = selectedRequests.includes(request.id);
                    return (
                      <TableRow key={request.id} hover selected={isSelected}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleSelectRequest(request.id)}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 260 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box>
                              <Typography fontWeight={600} lineHeight={1.2}>{request.employeeName}</Typography>
                              <Typography variant="caption" color="text.secondary">{request.employeeEmail || ''}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Tooltip title={formatDate(request.approvedAt)}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EventAvailableIcon color="success" fontSize="small" />
                              <Typography variant="body2">
                                {request.approvedAt && request.status === 'approved'
                                  ? new Date(request.approvedAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric'
                                    })
                                  : 'N/A'}
                              </Typography>
                            </Box>
                          </Tooltip>
                        </TableCell>
                        <TableCell>{request.category || 'N/A'}</TableCell>
                        <TableCell>{request.company || 'N/A'}</TableCell>
                        <TableCell>{request.location || 'N/A'}</TableCell>
                        <TableCell align="right">{formatCurrency(request.amount || 0, request.currency)}</TableCell>
                        <TableCell>
                          {pay ? (
                            <Chip size="small" color={String(pay.status).toLowerCase()==='done' ? 'success' : 'warning'} label={String(pay.status).toLowerCase()==='done' ? 'Payment Done' : 'Payment Pending'} />
                          ) : (
                            <Chip size="small" label="No Payment" />
                          )}
                        </TableCell>
                        <TableCell>{request.transferFrom || '-'}</TableCell>
                        <TableCell>{request.transferTo || '-'}</TableCell>
                        <TableCell>{request.reason || '-'}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => navigate(`/requests/${request.id}`)}>
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
    </Box>
  )
}

export default Approved;
