// Corrected frontend code:

import React, { useEffect, useState } from 'react';
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
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSnackbar } from 'notistack';

const formatCurrency = (value) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));

export default function Payments() {
  const [loading, setLoading] = useState(true);
  const [processingPayments, setProcessingPayments] = useState({});
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const load = async () => {
    try {
      setLoading(true);
      // Corrected API endpoint with the /api prefix
      const { data } = await axios.get('/api/requests/payments/list');
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching payments list:', error);
      enqueueSnackbar('Failed to fetch payments list', { variant: 'error' });
      setRows([]);
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

  const handleProceedToPayment = async (requestId) => {
    try {
      setProcessingPayments(prev => ({ ...prev, [requestId]: true }));

      // Assuming axiosClient is properly configured
      await axios.post(`/requests/${requestId}/proceed-payment`, {
        method: 'Bank Transfer',
        adminEmail: localStorage.getItem('userEmail')
      });

      setRows(prevRows =>
        prevRows.map(row =>
          row.requestId === requestId
            ? { ...row, sent_to_payment: 1, status: 'processing' }
            : row
        )
      );

      enqueueSnackbar('Payment processed successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error processing payment:', error);
      enqueueSnackbar(error.response?.data?.message || 'Failed to process payment', { variant: 'error' });
    } finally {
      setProcessingPayments(prev => ({ ...prev, [requestId]: false }));
    }
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
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Tooltip title="Open request">
                            <Button
                              size="small"
                              onClick={() => navigate(`/requests/${p.requestId}`)}
                              startIcon={<VisibilityOutlinedIcon/>}
                              variant="outlined"
                            >
                              View
                            </Button>
                          </Tooltip>
                          {p.status === 'approved' && !p.sent_to_payment && (
                            <Tooltip title="Proceed to Payment">
                              <Button
                                size="small"
                                color="primary"
                                variant="contained"
                                disabled={processingPayments[p.requestId]}
                                onClick={() => handleProceedToPayment(p.requestId)}
                              >
                                {processingPayments[p.requestId] ? 'Processing...' : 'Proceed to Payment'}
                              </Button>
                            </Tooltip>
                          )}
                        </Box>
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