import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, Button, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

const MyRequests = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h1">My Requests</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          component={Link}
          to="/new-request"
        >
          New Request
        </Button>
      </Box>

      <Paper sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 6 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1 }}>No requests found</Typography>
            <Typography variant="body2">{error || 'Create a new petty cash request to get started.'}</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Company</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.date ? new Date(r.date).toLocaleString() : '-'}</TableCell>
                  <TableCell>{r.category}</TableCell>
                  <TableCell>{r.company}</TableCell>
                  <TableCell align="right">{fmtMoney(r.amount)}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{r.status}</TableCell>
                  <TableCell>{r.reason || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
};

export default MyRequests;
