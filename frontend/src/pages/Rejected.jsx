import React, { useEffect, useMemo, useState } from 'react';
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

// Helper to format currency consistently
const formatCurrency = (value) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const timeRanges = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Year', value: 'year' },
];

const Rejected = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
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

  // Fetch rejected requests
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // If your backend supports filtering via query params, they are passed here
        const { data } = await axiosClient.get('/requests', {
          params: {
            status: 'rejected',
            q: search || undefined,
            company: company !== 'all' ? company : undefined,
            category: category !== 'all' ? category : undefined,
            range: range !== 'all' ? range : undefined,
          },
          signal: controller.signal,
        });

        // Expecting data to be an array of requests. If not present, fallback to empty array.
        // Example row shape used by the UI below:
        // { id, employeeName, company, category, amount, date, reason }
        const list = Array.isArray(data?.data || data) ? (data.data || data) : [];
        setRows(list);
      } catch (err) {
        // Non-fatal: show empty state but keep message
        setError(err?.response?.data?.message || err.message || 'Failed to load rejected requests');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [search, company, category, range]);

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
    const total = rows.length;
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const avg = total ? totalAmount / total : 0;
    const withReasons = rows.filter(r => r.reason && String(r.reason).trim().length > 0).length;
    return { total, totalAmount, avg, withReasons };
  }, [rows]);

  const filteredRows = useMemo(() => {
    // Client-side guard in case backend does not filter
    return rows
      .filter(r => (company === 'all' ? true : r.company === company))
      .filter(r => (category === 'all' ? true : r.category === category))
      .filter(r => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          String(r.employeeName || '').toLowerCase().includes(s) ||
          String(r.company || '').toLowerCase().includes(s) ||
          String(r.category || '').toLowerCase().includes(s) ||
          String(r.reason || '').toLowerCase().includes(s)
        );
      });
  }, [rows, company, category, search]);

  const handleExportCSV = () => {
    const header = ['ID', 'Employee', 'Company', 'Category', 'Amount', 'Date', 'Reason'];
    const csv = [header.join(',')] 
      .concat(
        filteredRows.map(r => [
          r.id ?? '',
          (r.employeeName ?? '').replaceAll(',', ' '),
          (r.company ?? '').replaceAll(',', ' '),
          (r.category ?? '').replaceAll(',', ' '),
          r.amount ?? 0,
          r.date ?? '',
          (r.reason ?? '').replaceAll('\n', ' ').replaceAll(',', ' '),
        ].join(','))
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rejected_requests.csv';
    link.click();
    URL.revokeObjectURL(url);
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
        <StatCard icon={<AttachMoneyIcon />} label="Total Amount" value={formatCurrency(stats.totalAmount)} color="success" />
        <StatCard icon={<ReportProblemOutlinedIcon />} label="Average Amount" value={formatCurrency(stats.avg)} color="warning" />
        <StatCard icon={<ChatBubbleOutlineOutlinedIcon />} label="With Reasons" value={stats.withReasons} color="secondary" />
      </Box>

      {/* Filters */}
      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search requests..."
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
                        {formatCurrency(r.amount)}
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
    </Box>
    
  );
};

export default Rejected;
