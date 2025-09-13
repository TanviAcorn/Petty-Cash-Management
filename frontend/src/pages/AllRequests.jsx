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
} from '@mui/material';
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

  const filteredRows = useMemo(() => {
    let list = rows;
    if (statusFilter !== 'all') {
      list = list.filter(r => String(r.status).toLowerCase() === statusFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        String(r.employeeName || '').toLowerCase().includes(s) ||
        String(r.company || '').toLowerCase().includes(s) ||
        String(r.category || '').toLowerCase().includes(s) ||
        String(r.reason || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [rows, statusFilter, search]);

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
