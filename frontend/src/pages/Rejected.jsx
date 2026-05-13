import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  OutlinedInput,
  Button,
  Chip,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { alpha } from '@mui/material/styles';
import axiosClient from '../api/axiosClient';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import Pagination from '../components/Pagination';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/currency';

const timeRanges = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Year', value: 'year' },
];

const Rejected = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0,
  });
  const navigate = useNavigate();

  // Filters
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('all');
  const [category, setCategory] = useState('all');
  const [range, setRange] = useState('all');

  // Options – if backend endpoints exist, these can be fetched. For now will be derived from data.
  const companies = useMemo(() => {
    const s = new Set(rows.map(r => r.company).filter(Boolean));
    return ['all', ...Array.from(s)];
  }, [rows]);
  const categories = useMemo(() => {
    const s = new Set(rows.map(r => r.category).filter(Boolean));
    return ['all', ...Array.from(s)];
  }, [rows]);

  const fetchData = useCallback(async (page = pagination.currentPage, limit = pagination.itemsPerPage) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit,
        status: 'rejected',
      };
      
      // Add user role and company for Payment users
      if (user) {
        params.userRole = user.role;
        if (user.role === 'Payment' && user.company) {
          params.assignedCompany = user.company;
        }
      }
      
      // Add search if present
      if (search.trim()) {
        params.q = search.trim();
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
      const list = Array.isArray(data?.data || data) ? (data.data || data) : [];
      setRows(list);
      
      // Update pagination state if pagination data is available
      if (data?.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load rejected requests');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, company, category, range, pagination.currentPage, pagination.itemsPerPage, user]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData();
    return () => controller.abort();
  }, [fetchData]);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [search, company, category, range]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
    fetchData(newPage, pagination.itemsPerPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setPagination(prev => ({ ...prev, itemsPerPage: newItemsPerPage, currentPage: 1 }));
    fetchData(1, newItemsPerPage);
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

  // Derived stats
  const stats = useMemo(() => {
    const total = pagination.totalItems;
    // For other stats, we'd need to fetch them separately or calculate from filtered data
    // For now, using the current page data
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const avg = rows.length ? totalAmount / rows.length : 0;
    const withReasons = rows.filter(r => r.reason && String(r.reason).trim().length > 0).length;
    return { total, totalAmount, avg, withReasons };
  }, [rows, pagination.totalItems]);

  const filteredRows = useMemo(() => {
    // Since filtering is now done on the backend, we just return the rows as-is
    return rows;
  }, [rows]);

  const handleExportCSV = async () => {
    try {
      // Fetch ALL matching records (no pagination) for export
      const params = {
        limit: 100000,
        page: 1,
        status: 'rejected',
      };

      if (user) {
        params.userRole = user.role;
        if (user.role === 'Payment' && user.company) {
          params.assignedCompany = user.company;
        }
      }
      if (search.trim())    params.q        = search.trim();
      if (company !== 'all') params.company  = company;
      if (category !== 'all') params.category = category;
      if (range !== 'all')  params.range    = range;

      const { data } = await axiosClient.get('/requests', { params });
      const exportRows = Array.isArray(data?.data || data) ? (data.data || data) : [];

      const header = ['ID', 'Employee Name', 'Employee Email', 'Date Rejected', 'Category', 'Company', 'Location', 'Amount', 'Currency', 'Rejection Reason'];
      const csv = [header.join(',')]
        .concat(
          exportRows.map(r => [
            r.id ?? '',
            `"${(r.employeeName ?? '').replace(/"/g, '""')}"`,
            `"${(r.employeeEmail ?? '').replace(/"/g, '""')}"`,
            `"${r.rejectedAt ? new Date(r.rejectedAt).toLocaleDateString('en-GB') : ''}"`,
            `"${(r.category ?? '').replace(/"/g, '""')}"`,
            `"${(r.company ?? '').replace(/"/g, '""')}"`,
            `"${(r.location ?? '').replace(/"/g, '""')}"`,
            r.amount ?? 0,
            `"${(r.currency ?? 'GBP').replace(/"/g, '""')}"`,
            `"${(r.reason ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          ].join(','))
        )
        .join('\n');

      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Build filename with active range filter
      const rangeLabel = range !== 'all' ? `_${range}` : '';
      link.download = `rejected_requests${rangeLabel}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Reusable stat card
  const StatCard = ({ icon, label, value, color = 'primary' }) => (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, bgcolor: 'background.paper', borderColor: 'divider' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 2.5 }}>
        <Box sx={(theme)=>({
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          bgcolor: alpha(theme.palette[color].main, 0.15),
          color: theme.palette[color].main,
        })}>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Rejected Requests</Typography>
          <Typography variant="body2" color="text.secondary">
            View and analyze all rejected petty cash requests
          </Typography>
        </Box>
        <Button variant="contained" color="primary" onClick={handleExportCSV}>
          Export CSV
        </Button>
      </Box>

      {/* Stat Cards */}
      <Box sx={{
        display: 'grid',
        gap: 2.5,
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
      }}>
        <StatCard icon={<CancelOutlinedIcon />} label="Total Rejected" value={stats.total} color="error" />
        <StatCard icon={<AttachMoneyIcon />} label="Total Amount" value={stats.totalAmount} color="success" />
        <StatCard icon={<ReportProblemOutlinedIcon />} label="Average Amount" value={stats.avg} color="warning" />
        <StatCard icon={<ChatBubbleOutlineOutlinedIcon />} label="With Reasons" value={stats.withReasons} color="secondary" />
      </Box>

      {/* Filters */}
      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search by name, email, company or #ID..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 220 }}
          />

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              input={<OutlinedInput />}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              {companies.map((c) => (
                <MenuItem key={c} value={c}>{c === 'all' ? 'All Companies' : c}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              input={<OutlinedInput />}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <MenuItem key={c} value={c}>{c === 'all' ? 'All Categories' : c}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              input={<OutlinedInput />}
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              {timeRanges.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Table */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : filteredRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 6 }}>
              <CancelOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
              <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1 }}>No rejected requests found</Typography>
              <Typography variant="body2">{error || 'No requests have been rejected yet.'}</Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Date Rejected</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.map((r) => (
                    <TableRow key={r.id || `${r.employeeName}-${r.date}`} hover>
                      <TableCell sx={{ minWidth: 260 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box>
                            <Typography fontWeight={600} lineHeight={1.2}>{r.employeeName}</Typography>
                            <Typography variant="caption" color="text.secondary">{r.employeeEmail || ''}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={formatDate(r.rejectedAt)}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EventAvailableIcon color="error" fontSize="small" />
                            <Typography variant="body2">
                              {r.rejectedAt && r.status === 'rejected'
                                ? new Date(r.rejectedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                  })
                                : 'N/A'}
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell>{r.company}</TableCell>
                      <TableCell>{r.location}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main', fontWeight: 700 }}>
                        {formatCurrency(r.amount, r.currency)}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 360 }}>
                        <Typography sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.reason || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ minWidth: 80 }}>
                        <IconButton size="small" aria-label="view details" onClick={() => navigate(`/requests/${r.id}`)}>
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
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

export default Rejected;
