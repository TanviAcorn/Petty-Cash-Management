import React, { useEffect, useMemo, useState } from 'react';
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
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import axiosClient from '../api/axiosClient';

const formatCurrency = (value) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));

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
    case 'processing': return { color: 'warning', label: 'processing' };
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
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState('30d');
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

  useEffect(() => {
    const fetchApprovedRequests = async () => {
      try {
        setLoading(true);
        // Fetch only approved requests
        const { data } = await axiosClient.get('/requests', { 
          params: { status: 'approved' && 'intercompany' }
        });
        
        const requestsList = Array.isArray(data?.data || data) ? (data.data || data) : [];
        setRequests(requestsList);

        // Calculate statistics
        if (requestsList.length > 0) {
          const total = requestsList.length;
          const totalAmount = requestsList.reduce((sum, req) => sum + Number(req.amount || 0), 0);
          const avgAmount = total > 0 ? totalAmount / total : 0;

          // Find top category
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
            total: 0,
            totalAmount: 0,
            avgAmount: 0,
            topCategory: { name: 'N/A', count: 0 }
          });
        }
      } catch (error) {
        console.error('Error fetching approved requests:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovedRequests();
    // Load payments list for badges
    (async () => {
      try {
        const { data } = await axiosClient.get('/requests/payments/list');
        setPayments(Array.isArray(data?.data) ? data.data : []);
      } catch {}
    })();
  }, [timeRange]);

  const filteredRequests = useMemo(() => {
    let result = requests;
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(request =>
        (request.employee_name || '').toLowerCase().includes(searchLower) ||
        (request.employee_email || '').toLowerCase().includes(searchLower) ||
        (request.company || '').toLowerCase().includes(searchLower) ||
        (request.category || '').toLowerCase().includes(searchLower) ||
        (request.reason || '').toLowerCase().includes(searchLower)
      );
    }
    
    // Apply company filter
    if (company && company !== 'all') {
      result = result.filter(request => request.company === company);
    }
    
    // Apply category filter
    if (category && category !== 'all') {
      result = result.filter(request => request.category === category);
    }
    
    // Apply date range filter
    if (range && range !== 'all') {
      const now = new Date();
      result = result.filter(request => {
        const approvedDate = new Date(request.approved_at || request.created_at);
        switch(range) {
          case '7d':
            const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
            return approvedDate >= sevenDaysAgo;
          case '30d':
            const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
            return approvedDate >= thirtyDaysAgo;
          case 'year':
            return approvedDate.getFullYear() === new Date().getFullYear();
          default:
            return true;
        }
      });
    }
    
    return result;
  }, [requests, searchTerm, company, category, range]);

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

  // Update stats when filtered requests change
  useEffect(() => {
    if (filteredRequests.length > 0) {
      const total = filteredRequests.length;
      const totalAmount = filteredRequests.reduce((sum, req) => sum + Number(req.amount || 0), 0);
      const avgAmount = total > 0 ? totalAmount / total : 0;

      // Find top category
      const categoryCounts = filteredRequests.reduce((acc, req) => {
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
        total: 0,
        totalAmount: 0,
        avgAmount: 0,
        topCategory: { name: 'N/A', count: 0 }
      });
    }
  }, [filteredRequests]);

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
          value={formatCurrency(stats.totalAmount)}
          color="primary"
        />
        <StatCard
          icon={<TrendingUpIcon />}
          label="Average Amount"
          value={formatCurrency(stats.avgAmount)}
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
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Date Approved</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Intercompany</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Loading approved requests...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
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
                    return (
                      <TableRow key={request.id} hover>
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
                        <TableCell align="right">{formatCurrency(request.amount || 0)}</TableCell>
                        <TableCell>
                          {pay ? (
                            <Chip size="small" color={String(pay.status).toLowerCase()==='done' ? 'success' : 'warning'} label={String(pay.status).toLowerCase()==='done' ? 'Payment Done' : 'Payment Pending'} />
                          ) : (
                            <Chip size="small" label="No Payment" />
                          )}
                        </TableCell>
                        <TableCell>{request.intercompany || '-'}</TableCell>
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
    </Box>
  );
}

export default Approved;
