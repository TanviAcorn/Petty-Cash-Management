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
  Chip,
  IconButton,
  CircularProgress,
  Button,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import SearchIcon from '@mui/icons-material/Search';
import PlaylistAddCheckCircleIcon from '@mui/icons-material/PlaylistAddCheckCircle';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import axiosClient from '../api/axiosClient';
import { alpha } from '@mui/material/styles';
import Pagination from '../components/Pagination';
import { useAuth } from '../contexts/AuthContext';

const StatCard = ({ icon, label, value, color = 'primary' }) => (
  <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, bgcolor: 'background.paper', borderColor: 'divider' }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 2.5 }}>
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

const AllRequests = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0,
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  
  const formatCurrency = (amount, currency) => {
    try {
      // Ensure amount is a valid number
      const amountValue = Number(amount) || 0;
      
      // Get a safe currency code with fallbacks
      let safeCurrency = 'GBP'; // Default fallback
      if (currency && typeof currency === 'string' && currency.trim() !== '') {
        const trimmedCurrency = currency.trim().toUpperCase();
        // Only use the provided currency if it's a valid ISO 4217 currency code (basic check)
        if (/^[A-Z]{3}$/.test(trimmedCurrency)) {
          safeCurrency = trimmedCurrency;
        }
      }
      
      // Format the amount with the currency
      return new Intl.NumberFormat(undefined, { 
        style: 'currency', 
        currency: safeCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amountValue);
    } catch (error) {
      console.error('Error formatting currency:', error, { amount, currency });
      // Fallback to basic formatting if Intl.NumberFormat fails
      return `£${(Number(amount) || 0).toFixed(2)}`;
    }
  };

  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null
  });
  const navigate = useNavigate();

  const fetchData = useCallback(async (page = pagination.currentPage, limit = pagination.itemsPerPage) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit,
      };
      
      // Add user role and company for Payment users
      if (user) {
        params.userRole = user.role;
        if (user.role === 'Payment' && user.company) {
          params.assignedCompany = user.company;
        }
      }
      
      // Add status filter if not 'all'
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      // Add search if present
      if (search.trim()) {
        params.q = search.trim();
      }
      
      const { data } = await axiosClient.get('/requests', { params });
      const list = Array.isArray(data?.data || data) ? (data.data || data) : [];
      setRows(list);
      
      // Update pagination state if pagination data is available
      if (data?.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load requests');
      setRows([]);
    } finally { 
      setLoading(false); 
    }
  }, [statusFilter, search, pagination.currentPage, pagination.itemsPerPage, user]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData();
    return () => controller.abort();
  }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [search, statusFilter]);

  const stats = useMemo(() => {
    const total = pagination.totalItems;
    // For other stats, we'd need to fetch them separately or calculate from filtered data
    // For now, using the current page data
    const pending = rows.filter(r => String(r.status).toLowerCase() === 'pending').length;
    const approved = rows.filter(r => String(r.status).toLowerCase() === 'approved').length;
    const rejected = rows.filter(r => String(r.status).toLowerCase() === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [rows, pagination.totalItems]);

  const handleExportCSV = async () => {
    try {
      // Fetch ALL matching records (no pagination) for export
      const params = { limit: 100000, page: 1 };

      if (user) {
        params.userRole = user.role;
        if (user.role === 'Payment' && user.company) {
          params.assignedCompany = user.company;
        }
      }
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.q = search.trim();

      // Apply date range as a filter on the request date
      if (dateRange.startDate) params.fromDate = new Date(dateRange.startDate).toISOString().split('T')[0];
      if (dateRange.endDate)   params.toDate   = new Date(dateRange.endDate).toISOString().split('T')[0];

      const { data } = await axiosClient.get('/requests', { params });
      let exportRows = Array.isArray(data?.data || data) ? (data.data || data) : [];

      // Client-side date filter as safety net (covers the date range pickers)
      if (dateRange.startDate || dateRange.endDate) {
        exportRows = exportRows.filter(row => {
          const rowDate = new Date(row.date);
          const start = dateRange.startDate ? new Date(dateRange.startDate) : null;
          const end   = dateRange.endDate   ? new Date(dateRange.endDate)   : null;
          if (start) start.setHours(0, 0, 0, 0);
          if (end)   end.setHours(23, 59, 59, 999);
          if (start && end) return rowDate >= start && rowDate <= end;
          if (start) return rowDate >= start;
          if (end)   return rowDate <= end;
          return true;
        });
      }

      const header = ['ID', 'Employee Name', 'Employee Email', 'Date', 'Category', 'Company', 'Location', 'Amount', 'Currency', 'Status'];
      const csv = [header.join(',')]
        .concat(
          exportRows.map(r => [
            r.id ?? '',
            `"${(r.employeeName ?? '').replace(/"/g, '""')}"`,
            `"${(r.employeeEmail ?? '').replace(/"/g, '""')}"`,
            `"${r.date ? new Date(r.date).toLocaleDateString('en-GB') : ''}"`,
            `"${(r.category ?? '').replace(/"/g, '""')}"`,
            `"${(r.company ?? '').replace(/"/g, '""')}"`,
            `"${(r.location ?? '').replace(/"/g, '""')}"`,
            r.amount ?? 0,
            `"${(r.currency ?? 'GBP').replace(/"/g, '""')}"`,
            `"${(r.status ?? '').replace(/"/g, '""')}"`,
          ].join(','))
        )
        .join('\n');

      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      let filename = 'all_requests';
      if (dateRange.startDate || dateRange.endDate) {
        const start = dateRange.startDate ? new Date(dateRange.startDate).toISOString().split('T')[0] : 'start';
        const end   = dateRange.endDate   ? new Date(dateRange.endDate).toISOString().split('T')[0]   : 'end';
        filename = `requests_${start}_to_${end}`;
      }

      link.download = `${filename}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleDateChange = (date, type) => {
    setDateRange(prev => ({
      ...prev,
      [type]: date
    }));
  };

  const clearDateRange = () => {
    setDateRange({ startDate: null, endDate: null });
  };

  const filteredRows = useMemo(() => {
    // Since filtering is now done on the backend, we just return the rows as-is
    return rows;
  }, [rows]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
    fetchData(newPage, pagination.itemsPerPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setPagination(prev => ({ ...prev, itemsPerPage: newItemsPerPage, currentPage: 1 }));
    fetchData(1, newItemsPerPage);
  };

  const toggleSelectAll = (checked) => {
    if (checked) setSelected(filteredRows.map(r => r.id));
    else setSelected([]);
  };
  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>All Requests</Typography>
          <Typography variant="body2" color="text.secondary">Review and approve petty cash reimbursement requests</Typography>
        </Box>
        <Button variant="contained" color="primary" onClick={handleExportCSV}>
          Export CSV
        </Button>
      </Box>

      {/* Stat Cards */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <StatCard icon={<PlaylistAddCheckCircleIcon />} label="Total Requests" value={stats.total} color="info" />
        <StatCard icon={<AccessTimeOutlinedIcon />} label="Pending" value={stats.pending} color="warning" />
        <StatCard icon={<CheckCircleOutlineIcon />} label="Approved" value={stats.approved} color="success" />
        <StatCard icon={<CancelOutlinedIcon />} label="Rejected" value={stats.rejected} color="error" />
      </Box>

      {/* Filters Card */}
      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', p: { xs: 1.5, sm: 2 } }}>
          <TextField
            placeholder="Search by name, email, company or #ID..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="action"/></InputAdornment>) }}
            sx={{ width: { xs: '100%', sm: 300 } }}
          />
          <FormControl size="small" sx={{ minWidth: 140, width: { xs: '100%', sm: 'auto' } }}>
            <Select input={<OutlinedInput />} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
              <MenuItem value="intercompany">Intercompany</MenuItem>
              <MenuItem value="processed">Processed</MenuItem>
              <MenuItem value="payment done">Payment Done</MenuItem>
            </Select>
          </FormControl>
          
          {/* Date pickers — hidden on mobile to save space, shown on sm+ */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Stack direction="row" spacing={1} alignItems="center">
                <DatePicker
                  label="Export From"
                  value={dateRange.startDate}
                  onChange={(date) => handleDateChange(date, 'startDate')}
                  renderInput={(params) => (
                    <TextField {...params} size="small" sx={{ width: 140 }} InputLabelProps={{ shrink: true }} />
                  )}
                />
                <Typography variant="caption">to</Typography>
                <DatePicker
                  label="Export To"
                  value={dateRange.endDate}
                  onChange={(date) => handleDateChange(date, 'endDate')}
                  renderInput={(params) => (
                    <TextField {...params} size="small" sx={{ width: 140 }} InputLabelProps={{ shrink: true }} />
                  )}
                  minDate={dateRange.startDate}
                />
                {(dateRange.startDate || dateRange.endDate) && (
                  <Button size="small" onClick={clearDateRange} sx={{ minWidth: 'auto', px: 1 }}>Clear</Button>
                )}
              </Stack>
            </LocalizationProvider>
          </Box>
        </CardContent>
      </Card>

      {/* Table Card — desktop table / mobile cards */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : isMobile ? (
            /* ── Mobile: card list ── */
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {filteredRows.length === 0 ? (
                <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                  {error || 'No requests found'}
                </Typography>
              ) : filteredRows.map((r) => {
                const sc = statusColor(r.status);
                return (
                  <Card key={r.id} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box>
                          <Typography variant="caption" color="primary.main" fontWeight={700}>#{r.id}</Typography>
                          <Typography fontWeight={600} variant="body2" lineHeight={1.3}>{r.employeeName}</Typography>
                          <Typography variant="caption" color="text.secondary">{r.employeeEmail}</Typography>
                        </Box>
                        <Chip size="small" label={sc.label} color={sc.color} variant="outlined" sx={{ textTransform: 'lowercase', ml: 1, flexShrink: 0 }} />
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                        {r.category && <Chip label={r.category} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />}
                        {r.company && <Typography variant="caption" color="text.secondary">{r.company}</Typography>}
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" fontWeight={700} color="success.main">
                          {formatCurrency(r.amount, r.currency)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {r.date ? new Date(r.date).toLocaleDateString('en-GB') : '-'}
                          </Typography>
                          <IconButton size="small" onClick={() => navigate(`/requests/${r.id}`)}>
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          ) : (
            /* ── Desktop: full table ── */
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Request ID</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        {error || 'No requests found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => {
                      const sc = statusColor(r.status);
                      return (
                        <TableRow key={r.id || `${r.employeeName}-${r.createdAt}`} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="body2" fontWeight={700} color="primary.main">#{r.id}</Typography>
                          </TableCell>
                          <TableCell sx={{ minWidth: 200 }}>
                            <Typography fontWeight={600} lineHeight={1.2} variant="body2">{r.employeeName}</Typography>
                            <Typography variant="caption" color="text.secondary">{r.employeeEmail || ''}</Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {r.date ? new Date(r.date).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.company}</TableCell>
                          <TableCell>{r.location}</TableCell>
                          <TableCell align="right">{formatCurrency(r.amount, r.currency)}</TableCell>
                          <TableCell>
                            <Chip size="small" label={sc.label} color={sc.color} variant="outlined" sx={{ textTransform: 'lowercase' }} />
                          </TableCell>
                          <TableCell align="center" sx={{ minWidth: 80 }}>
                            <IconButton size="small" aria-label="view details" onClick={() => navigate(`/requests/${r.id}`)}>
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
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
  );
};

export default AllRequests;
