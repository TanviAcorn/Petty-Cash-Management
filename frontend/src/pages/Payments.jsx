import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  CircularProgress,
  Button,
  Tooltip,
} from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AttachEmailIcon from '@mui/icons-material/AttachEmail';
import axiosClient from '../api/axiosClient';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (value) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));

export default function Payments() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await axiosClient.get('/requests/payments/list');
      setRows(Array.isArray(data?.data) ? data.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const statusChip = (status) => {
    const statusValue = String(status || '').toLowerCase();
    const statusConfig = {
      'pending': { label: 'Pending', color: 'warning' },
      'in_progress': { label: 'In Progress', color: 'info' },
      'processing': { label: 'Processing', color: 'info' },
      'completed': { label: 'Completed', color: 'success' },
      'payment done': { label: 'Payment Done', color: 'success' },
      'failed': { label: 'Failed', color: 'error' },
      'declined': { label: 'Declined', color: 'error' },
      'cancelled': { label: 'Cancelled', color: 'error' },
      'refunded': { label: 'Refunded', color: 'secondary' },
    };

    const config = statusConfig[statusValue] || { label: statusValue || 'Unknown', color: 'default' };
    
    return (
      <Chip 
        size="small" 
        color={config.color} 
        label={config.label}
        sx={{ textTransform: 'capitalize' }}
      />
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5" fontWeight={700}>Payments</Typography>
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Request</TableCell>
                  <TableCell>Employee</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <CheckCircleOutlineIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">No payments found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p) => (
                    <TableRow key={p.paymentId} hover>
                      <TableCell>#{p.requestId}</TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>{p.employeeName}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.employeeEmail}</Typography>
                      </TableCell>
                      <TableCell>{p.company || '-'}</TableCell>
                      <TableCell>{p.category || '-'}</TableCell>
                      <TableCell>{formatCurrency(p.paidAmount || p.amount)}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{p.reference || '-'}</TableCell>
                      <TableCell>{statusChip(p.status)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Open request">
                          <Button size="small" onClick={() => navigate(`/requests/${p.requestId}`)} startIcon={<VisibilityOutlinedIcon/>}>
                            View
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
