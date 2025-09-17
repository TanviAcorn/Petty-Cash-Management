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
  Checkbox,
  Chip,
  Avatar,
  IconButton,
  CircularProgress,
  Button,
  Stack,
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
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import axiosClient from '../api/axiosClient';
import { alpha } from '@mui/material/styles';

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
    case 'payment done': return { color: 'success', label: 'payment done' };
    default: return { color: 'warning', label: 'pending' };
  }
};

const AllRequests = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null
  });
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axiosClient.get('/requests', { signal: controller.signal });
        const list = Array.isArray(data?.data || data) ? (data.data || data) : [];
        setRows(list);
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Failed to load requests');
        setRows([]);
      } finally { setLoading(false); }
    };
    fetchData();
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter(r => String(r.status).toLowerCase() === 'pending').length;
    const approved = rows.filter(r => String(r.status).toLowerCase() === 'approved').length;
    const rejected = rows.filter(r => String(r.status).toLowerCase() === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [rows]);

  const handleExportCSV = () => {
    // Filter rows by date range for export
    let exportRows = [...filteredRows];
    
    if (dateRange.startDate || dateRange.endDate) {
      exportRows = exportRows.filter(row => {
        const rowDate = new Date(row.date);
        const startDate = dateRange.startDate ? new Date(dateRange.startDate) : null;
        const endDate = dateRange.endDate ? new Date(dateRange.endDate) : null;
        
        if (startDate && endDate) {
          return rowDate >= startDate && rowDate <= endDate;
        } else if (startDate) {
          return rowDate >= startDate;
        } else if (endDate) {
          return rowDate <= endDate;
        }
        return true;
      });
    }

    const header = ['Employee name', 'Date', 'Category', 'Company', 'Location', 'Amount', 'Status'];
    const csv = [header.join(',')] 
      .concat(
        exportRows.map(r => [
          `"${(r.employeeName ?? '').replace(/"/g, '""')}"`,
          `"${r.date || ''}"`,
          `"${(r.category ?? '').replace(/"/g, '""')}"`,
          `"${(r.company ?? '').replace(/"/g, '""')}"`,
          `"${(r.location ?? '').replace(/"/g, '""')}"`,
          r.amount ?? 0,
          `"${(r.status ?? '').replace(/"/g, '""')}"`,
        ].join(','))
      )
      .join('\n');
      
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with date range if specified
    let filename = 'all_requests';
    if (dateRange.startDate || dateRange.endDate) {
      const start = dateRange.startDate ? new Date(dateRange.startDate).toISOString().split('T')[0] : '';
      const end = dateRange.endDate ? new Date(dateRange.endDate).toISOString().split('T')[0] : '';
      filename = `requests_${start || 'start'}_to_${end || 'end'}`;
    }
    
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    let list = rows;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      list = list.filter(r => String(r.status).toLowerCase() === statusFilter);
    }
    
    // Apply search filter
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        String(r.employeeName || '').toLowerCase().includes(s) ||
        String(r.company || '').toLowerCase().includes(s) ||
        String(r.category || '').toLowerCase().includes(s) ||
        String(r.reason || '').toLowerCase().includes(s)
      );
    }
    
    // Apply date range filter
    if (dateRange.startDate || dateRange.endDate) {
      list = list.filter(row => {
        if (!row.date) return false;
        
        const rowDate = new Date(row.date);
        const startDate = dateRange.startDate ? new Date(dateRange.startDate) : null;
        const endDate = dateRange.endDate ? new Date(dateRange.endDate) : null;
        
        // Set time to start/end of day for proper date comparison
        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999);
        
        if (startDate && endDate) {
          return rowDate >= startDate && rowDate <= endDate;
        } else if (startDate) {
          return rowDate >= startDate;
        } else if (endDate) {
          return rowDate <= endDate;
        }
        return true;
      });
    }
    
    return list;
  }, [rows, statusFilter, search, dateRange]);

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

      {/* Filters Card - compact like Approved */}
      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search requests..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="action"/></InputAdornment>) }}
            sx={{ width: 320, maxWidth: '100%' }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select input={<OutlinedInput />} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
              <MenuItem value="intercompany">Intercompany</MenuItem>
            </Select>
          </FormControl>
          
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack direction="row" spacing={1} alignItems="center">
              <DatePicker
                label="From Date"
                value={dateRange.startDate}
                onChange={(date) => handleDateChange(date, 'startDate')}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    size="small" 
                    sx={{ width: 150 }} 
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
              <Typography>to</Typography>
              <DatePicker
                label="To Date"
                value={dateRange.endDate}
                onChange={(date) => handleDateChange(date, 'endDate')}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    size="small" 
                    sx={{ width: 150 }} 
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                minDate={dateRange.startDate}
              />
              {(dateRange.startDate || dateRange.endDate) && (
                <Button 
                  size="small" 
                  onClick={clearDateRange}
                  sx={{ minWidth: 'auto', padding: '6px 8px' }}
                >
                  Clear
                </Button>
              )}
            </Stack>
          </LocalizationProvider>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
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
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        {error || 'No requests found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => {
                      const sc = statusColor(r.status);
                      return (
                        <TableRow key={r.id || `${r.employeeName}-${r.createdAt}`} hover>
                          <TableCell sx={{ minWidth: 260 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box>
                                <Typography fontWeight={600} lineHeight={1.2}>{r.employeeName}</Typography>
                                <Typography variant="caption" color="text.secondary">{r.employeeEmail || ''}</Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {r.date ? new Date(r.date).toLocaleDateString() : '-'}
                            <Typography variant="caption" color="text.secondary" display="block">Requested: {r.date ? new Date(r.date).toLocaleDateString() : '-'}</Typography>
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.company}</TableCell>
                          <TableCell>{r.location}</TableCell>
                          <TableCell align="right">{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(r.amount || 0))}</TableCell>
                          <TableCell>
                            <Chip size="small" label={sc.label} color={sc.color} variant="outlined" sx={{ textTransform: 'lowercase' }} />
                          </TableCell>
                          <TableCell align="center" sx={{ minWidth: 120 }}>
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
    </Box>
  );
};

export default AllRequests;
