import React, { useEffect, useMemo, useState } from 'react';
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
  Button,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Avatar,
  IconButton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import axiosClient from '../api/axiosClient';

const formatCurrency = (value) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));

const timeRanges = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Year', value: 'year' },
];

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('all');
  const [category, setCategory] = useState('all');
  const [range, setRange] = useState('all');

  const companies = useMemo(() => ['all', ...Array.from(new Set(rows.map(r => r.company).filter(Boolean)))] , [rows]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(rows.map(r => r.category).filter(Boolean)))] , [rows]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axiosClient.get('/requests', {
          params: {
            status: 'approved',
            q: search || undefined,
            company: company !== 'all' ? company : undefined,
            category: category !== 'all' ? category : undefined,
            range: range !== 'all' ? range : undefined,
          },
          signal: controller.signal,
        });
        const list = Array.isArray(data?.data || data) ? (data.data || data) : [];
        setRows(list);
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Failed to load approved requests');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [search, company, category, range]);

  const stats = useMemo(() => {
    const total = rows.length;
    const totalAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const avg = total ? totalAmount / total : 0;
    const intercompany = 0; // placeholder if you track it later
    return { total, totalAmount, avg, intercompany };
  }, [rows]);

  const filteredRows = useMemo(() => {
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
    const header = ['ID', 'Employee', 'Company', 'Category', 'Amount', 'Approved Date', 'Reason'];
    const csv = [header.join(',')]
      .concat(
        filteredRows.map(r => [
          r.id ?? '',
          (r.employeeName ?? '').replaceAll(',', ' '),
          (r.company ?? '').replaceAll(',', ' '),
          (r.category ?? '').replaceAll(',', ' '),
          r.amount ?? 0,
          r.approvedAt ?? '',
          (r.reason ?? '').replaceAll('\n', ' ').replaceAll(',', ' '),
        ].join(','))
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'approved_requests.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1200, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Approved Requests</Typography>
          <Typography variant="body2" color="text.secondary">
            View and manage all approved petty cash requests
          </Typography>
        </Box>
        <Button variant="contained" color="primary" onClick={handleExportCSV}>
          Export CSV
        </Button>
      </Box>

      {/* Stat Cards */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <StatCard icon={<CheckCircleOutlineIcon />} label="Total Approved" value={stats.total} color="success" />
        <StatCard icon={<AttachMoneyIcon />} label="Total Amount" value={formatCurrency(stats.totalAmount)} color="success" />
        <StatCard icon={<TrendingUpIcon />} label="Average Amount" value={formatCurrency(stats.avg)} color="info" />
        <StatCard icon={<ApartmentOutlinedIcon />} label="Intercompany" value={stats.intercompany} color="secondary" />
      </Box>

      {/* Filters & List */}
      <Card variant="outlined">
        <CardContent>
          {/* List header */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Approved Requests</Typography>
            <Typography variant="body2" color="text.secondary">
              All approved petty cash reimbursement requests
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
              <Select input={<OutlinedInput />} value={company} onChange={(e) => setCompany(e.target.value)}>
                {companies.map((c) => (
                  <MenuItem key={c} value={c}>{c === 'all' ? 'All Companies' : c}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select input={<OutlinedInput />} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>{c === 'all' ? 'All Categories' : c}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select input={<OutlinedInput />} value={range} onChange={(e) => setRange(e.target.value)}>
                {timeRanges.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Divider sx={{ my: 2 }} />

          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : filteredRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 6 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1 }}>No approved requests found</Typography>
              <Typography variant="body2">{error || 'No requests have been approved yet.'}</Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Date Approved</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.map((r) => (
                    <TableRow key={r.id || `${r.employeeName}-${r.approvedAt}`} hover>
                      <TableCell sx={{ minWidth: 260 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 28, height: 28 }}>{(r.employeeName || '?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()}</Avatar>
                          <Box>
                            <Typography fontWeight={600} lineHeight={1.2}>{r.employeeName}</Typography>
                            <Typography variant="caption" color="text.secondary">{r.employeeEmail || ''}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.approvedAt ? new Date(r.approvedAt).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell>{r.company}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>{formatCurrency(r.amount)}</TableCell>
                      <TableCell sx={{ maxWidth: 360 }}>
                        <Typography sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.reason || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ minWidth: 80 }}>
                        <IconButton size="small" aria-label="view details">
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

export default Approved;
