import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Divider,
  Grid,
  Stack,
  Avatar,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Snackbar,
  Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../contexts/AuthContext.jsx';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5005/api');
const FILE_BASE = API_BASE.replace(/\/api\/?$/, '');

const fmtMoney = (n, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n || 0));

const statusChip = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'approved': return { color: 'success', label: 'Approved' };
    case 'rejected': return { color: 'error', label: 'Rejected' };
    case 'intercompany': return { color: 'secondary', label: 'Intercompany' };
    case 'processing': return { color: 'warning', label: 'Processing' };
    case 'payment done': return { color: 'success', label: 'Payment Done' };
    default: return { color: 'warning', label: 'Pending' };
  }
};

export default function RequestReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [req, setReq] = useState(null);
  console.log("=======================:", req)
  const [submitting, setSubmitting] = useState(false);
  // Intercompany state
  const [icOpen, setIcOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [targetCompany, setTargetCompany] = useState('');
  const [icNote, setIcNote] = useState('');
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  // Reason dialogs
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  // Payment dialog state
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payReference, setPayReference] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0,10));
  const [payNotes, setPayNotes] = useState('');

  // Set the payment amount when the dialog opens
  const handlePayOpen = () => {
    if (req?.amount) {
      // Format the amount with the request's currency
      const formattedAmount = fmtMoney(req.amount, req.currency || 'USD');
      setPayAmount(formattedAmount);
    }
    setPayOpen(true);
  };
  const [payments, setPayments] = useState([]);
  const [receiptUploading, setReceiptUploading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await axiosClient.get(`/requests/${id}`, { signal: controller.signal });
        setReq(data?.data || data);
        try {
          const payRes = await axiosClient.get(`/requests/${id}/payments`, { signal: controller.signal });
          setPayments(Array.isArray(payRes?.data?.data) ? payRes.data.data : []);
        } catch {}
        // preload companies for intercompany transfer
        try {
          const { data: comps } = await axiosClient.get('/companies', { signal: controller.signal });
          setCompanies(Array.isArray(comps) ? comps : []);
        } catch (e) {
          // non-blocking
        }
      } catch (e) {
        // Ignore cancellations triggered by StrictMode/unmount
        if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.message === 'canceled') {
          return;
        }
        setError(e?.response?.data?.message || e.message || 'Failed to load request');
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [id]);

  const sc = useMemo(() => statusChip(req?.status), [req]);

  const onStatus = async (next, note) => {
    try {
      setSubmitting(true);
      // Using generic status update endpoint
      await axiosClient.put(`/requests/${id}/status`, {
        status: next,
        note: note || null,
        performedByEmail: user?.email || null,
        performedByName: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() : null,
      });
      // Refetch
      const { data } = await axiosClient.get(`/requests/${id}`);
      setReq(data?.data || data);
      try {
        const payRes = await axiosClient.get(`/requests/${id}/payments`);
        setPayments(Array.isArray(payRes?.data?.data) ? payRes.data.data : []);
      } catch {}
      setToast({ open: true, message: `Request ${next}`, severity: 'success' });
    } catch (e) {
      setError(e?.response?.data?.message || e.message || `Failed to ${next} request`);
    } finally {
      setSubmitting(false);
    }
  };

  const onProceedPayment = async () => {
    try {
      setSubmitting(true);
      await axiosClient.post(`/requests/${id}/proceed-payment`, {
        method: payMethod,
        reference: payReference || null,
        paidAmount: payAmount || null,
        paidDate: payDate || null,
        notes: payNotes || null,
        adminEmail: user?.email || null,
      });
      const { data } = await axiosClient.get(`/requests/${id}`);
      setReq(data?.data || data);
      setToast({ open: true, message: 'Payment initiated and team notified', severity: 'success' });
      setPayOpen(false);
      setPayNotes('');
      setPayReference('');
    } catch (e) {
      setToast({ open: true, message: e?.response?.data?.message || e.message || 'Failed to proceed payment', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const onIntercompany = async () => {
    if (!targetCompany) return;
    try {
      setSubmitting(true);
      await axiosClient.put(`/requests/${id}/intercompany`, {
        company: targetCompany,
        performedByEmail: user?.email || null,
        performedByName: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() : null,
        note: icNote || null,
      });
      const { data } = await axiosClient.get(`/requests/${id}`);
      setReq(data?.data || data);
      setToast({ open: true, message: 'Approved with intercompany transfer', severity: 'success' });
      setIcOpen(false);
      setIcNote('');
      setTargetCompany('');
    } catch (e) {
      setToast({ open: true, message: e?.response?.data?.message || e.message || 'Failed to transfer', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>
        <Card variant="outlined">
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!req) return null;

  // Use the currency from the request data, default to 'USD' if not available
  const currency = req.currency || 'USD';

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mr: 1 }} size="small" color="inherit">Back</Button>
        <Typography variant="h5" fontWeight={800}>Request Review</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Request ID: {req.id}</Typography>
        <Chip size="small" color={sc.color} label={sc.label} sx={{ ml: 'auto', textTransform: 'none' }} />
      </Box>

      {/* Status action callout */}
      {String(req.status).toLowerCase() === 'pending' && (
        <Card variant="outlined" sx={{ borderLeft: 4, borderLeftColor: (theme) => theme.palette.warning.main, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTimeOutlinedIcon color="warning" /> Pending Approval
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This request requires your review and approval
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckOutlinedIcon />}
                  disabled={submitting}
                  onClick={() => setApproveOpen(true)}
                >
                  Approve
                </Button>
                {/* Placeholder for intercompany transfer action */}
                <Button variant="outlined" color="info" startIcon={<ApartmentOutlinedIcon />} onClick={() => setIcOpen(true)}>
                  Approve with Intercompany Transfer
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CloseOutlinedIcon />}
                  disabled={submitting}
                  onClick={() => setRejectOpen(true)}
                >
                  Reject
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      {(String(req.status).toLowerCase() === 'approved' || String(req.status).toLowerCase() === 'intercompany') && (
        <Card variant="outlined" sx={{ borderLeft: 4, borderLeftColor: (theme) => theme.palette.success.main, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckOutlinedIcon color="success" /> Approved
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {req.sent_to_payment 
                    ? 'This request has been sent for payment processing.'
                    : 'This request has been approved. You can proceed to payment.'
                  }
                </Typography>
              </Box>
              {!req.sent_to_payment && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="contained" color="primary" onClick={handlePayOpen}>
                    Proceed to Payment
                  </Button>
                </Stack>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2} alignItems="stretch">
        {/* Employee Information - Full width to match Request Details */}
        <Grid
          item
          xs={12}
          md={8}
          sx={{
            display: 'flex',
            // Explicitly enforce 8/12 width at md+ to match Request Details
            flexBasis: { md: '66.6667%' },
            maxWidth: { md: '66.6667%' },
          }}
        >
          <Card variant="outlined" sx={{ flex: '1 1 auto', height: '100%', width: '100%', maxWidth: 'none' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Employee Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ width: 36, height: 36 }}>
                    {(req.employeeName || '?')
                      .split(' ')
                      .map(p => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={600}>{req.employeeName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {req.employeeEmail}
                    </Typography>
                  </Box>
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Company
                  </Typography>
                  <Typography>{req.company || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Currency
                  </Typography>
                  <Typography fontWeight={600}>
                    {req.currency || 'USD'} ({new Intl.NumberFormat(undefined, { style: 'currency', currency: req.currency || 'USD' }).format(1).replace(/[0-9.,\s]/g, '')})
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Submitted
                  </Typography>
                  <Typography>
                    {req.createdAt ? new Date(req.createdAt).toLocaleString() : '-'}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Details - Full width */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Payment Details</Typography>
              <Divider sx={{ mb: 2 }} />
              {payments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No payment records yet.</Typography>
              ) : (
                <Stack spacing={1}>
                  {payments.map((p) => (
                    <Box key={p.id} sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 1, alignItems: 'center' }}>
                      <Typography variant="body2"><strong>Method:</strong> {p.method}</Typography>
                      <Typography variant="body2"><strong>Ref:</strong> {p.reference || '-'}</Typography>
                      <Typography variant="body2"><strong>Paid:</strong> {p.paid_amount ?? '-'}</Typography>
                      <Typography variant="body2"><strong>Date:</strong> {p.paid_date ? new Date(p.paid_date).toLocaleDateString() : '-'}</Typography>
                      <Typography variant="body2"><strong>Status:</strong> {String(p.status||'pending')}</Typography>
                      <Typography variant="body2"><strong>Receipt:</strong> {p.receipt_filename ? 'Attached' : '-'}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
              {payments[0] && String(payments[0].status).toLowerCase() !== 'done' && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="body2">Mark latest payment as done by uploading receipt:</Typography>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={async (e)=>{
                      const file = e.target.files?.[0];
                      if(!file) return;
                      try{
                        setReceiptUploading(true);
                        const form = new FormData();
                        form.append('receipt', file);
                        await axiosClient.post(`/requests/${id}/payment-done`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
                        const payRes = await axiosClient.get(`/requests/${id}/payments`);
                        setPayments(Array.isArray(payRes?.data?.data) ? payRes.data.data : []);
                        setToast({ open: true, message: 'Payment marked as done', severity: 'success' });
                      } catch(err){
                        setToast({ open: true, message: err?.response?.data?.message || err.message || 'Failed to upload receipt', severity: 'error' });
                      } finally {
                        setReceiptUploading(false);
                        e.target.value = '';
                      }
                    }}
                    disabled={receiptUploading}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        {/* Right spacer to keep row width consistent with below 8/4 layout */}
        <Grid item xs={12} md={4} sx={{ display: { xs: 'none', md: 'block' } }}>
          <Box />
        </Grid>

        {/* Request Details - Left column */}
        <Grid item xs={12} md={8} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ flex: 1, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Request Details</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Amount</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: 'success.main' }}>
                      {fmtMoney(req.amount, currency)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Currency</Typography>
                    <Typography fontWeight={600}>{currency}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Category</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip size="small" label={req.category || '-'} variant="outlined" />
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Location</Typography>
                    <Typography fontWeight={600}>{req.location || '-'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Company</Typography>
                    <Typography fontWeight={600}>{req.company || '-'}</Typography>
                    {req.previousCompany && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Previous: {req.previousCompany}
                      </Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Date of Purchase</Typography>
                    <Typography fontWeight={600}>{req.dateOfPurchase ? new Date(req.dateOfPurchase).toLocaleDateString() : '-'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip size="small" color={sc.color} label={sc.label} />
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Description</Typography>
                    <Typography sx={(theme)=>({
                      mt: 0.5,
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      // Use theme tokens so it looks good in both light and dark
                      bgcolor: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'grey.50',
                      borderColor: theme.palette.divider,
                    })}>
                      {req.description || '-'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Attachments - Right column beside Request Details */}
        <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ flex: 1, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptLongOutlinedIcon /> Attachments
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {Array.isArray(req.attachments) && req.attachments.length > 0 ? (
                <Stack spacing={1}>
                  {req.attachments.map((f, idx) => (
                    <Button 
                      key={idx} 
                      component={Link} 
                      to={`${FILE_BASE}/uploads/${encodeURIComponent(f.filename || '')}`} 
                      target="_blank" 
                      rel="noopener" 
                      variant="outlined" 
                      size="small"
                      fullWidth
                      sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                    >
                      {f.originalName || f.filename || `file-${idx+1}`}
                    </Button>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No attachments</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Meta Information - Full width */}
        {/* <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Request History</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Approved At</Typography>
                  <Typography variant="body2">{req.approvedAt ? new Date(req.approvedAt).toLocaleString() : '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Rejected At</Typography>
                  <Typography variant="body2">{req.rejectedAt ? new Date(req.rejectedAt).toLocaleString() : '-'}</Typography>
                </Grid>
                {req.previousCompany && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Previous Company</Typography>
                    <Typography variant="body2">{req.previousCompany}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid> */}
      </Grid>

      {/* Intercompany Transfer Dialog */}
      <Dialog open={icOpen} onClose={() => setIcOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Intercompany Transfer</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Approve this request and transfer the expense to another company. Both the employee and accounting will be notified.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="ic-company-label">Transfer to Company</InputLabel>
            <Select
              labelId="ic-company-label"
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              input={<OutlinedInput label="Transfer to Company" />}
            >
              {companies
                .filter(c => (req?.company ? c.name !== req.company : true))
                .map((c) => (
                <MenuItem key={c.id} value={c.name}>{c.name}{c.code ? ` (${c.code})` : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mt: 2 }}>
           
            <OutlinedInput id="ic-note" value={icNote} onChange={(e) => setIcNote(e.target.value)} multiline minRows={2} placeholder="Add a note for the transfer..." />
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIcOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={onIntercompany} variant="contained" disabled={!targetCompany || submitting}>Approve & Transfer</Button>
        </DialogActions>
      </Dialog>

      {/* Proceed to Payment Dialog */}
      <Dialog open={payOpen} onClose={() => setPayOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Proceed to Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter payment details to notify the payments team.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel id="pay-method-label">Method</InputLabel>
                <Select labelId="pay-method-label" label="Method" value={payMethod} onChange={(e)=>setPayMethod(e.target.value)}>
                  <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                  <MenuItem value="Cash">Cash</MenuItem>
                  <MenuItem value="UPI">UPI</MenuItem>
                  <MenuItem value="Cheque">Cheque</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <OutlinedInput fullWidth size="small" placeholder="Reference (optional)" value={payReference} onChange={(e)=>setPayReference(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <OutlinedInput 
                fullWidth 
                size="small" 
                placeholder="Paid Amount" 
                type="text" 
                value={payAmount} 
                onChange={(e) => {
                  // Allow only numbers and decimal point
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setPayAmount(value);
                }}
                onBlur={(e) => {
                  // Format the number with the request's currency when input loses focus
                  const numValue = parseFloat(e.target.value.replace(/[^0-9.]/g, ''));
                  if (!isNaN(numValue)) {
                    setPayAmount(fmtMoney(numValue, req.currency || 'USD'));
                  }
                }}
                readOnly={!!req?.amount}
                sx={req?.amount ? { '& .MuiOutlinedInput-input': { backgroundColor: 'action.hover' } } : {}}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <OutlinedInput fullWidth size="small" placeholder="Paid Date" type="date" value={payDate} onChange={(e)=>setPayDate(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <OutlinedInput fullWidth size="small" multiline minRows={2} placeholder="Notes (optional)" value={payNotes} onChange={(e)=>setPayNotes(e.target.value)} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setPayOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={onProceedPayment} variant="contained" disabled={submitting}>Send to Payments</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={toast.severity} onClose={() => setToast(prev => ({ ...prev, open: false }))} variant="filled">{toast.message}</Alert>
      </Snackbar>

      {/* Approve Reason Dialog */}
      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Please provide a reason or note for approval. This will be recorded in the request history.
          </Typography>
          <OutlinedInput value={approveNote} onChange={(e)=>setApproveNote(e.target.value)} multiline minRows={2} fullWidth placeholder="Reason for approval (required)" />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setApproveOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={async ()=>{ if(!approveNote.trim()) return; await onStatus('approved', approveNote.trim()); setApproveOpen(false); setApproveNote(''); }} variant="contained" disabled={submitting || !approveNote.trim()}>Approve</Button>
        </DialogActions>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Please provide a reason for rejection. This will be visible to the requester.
          </Typography>
          <OutlinedInput value={rejectNote} onChange={(e)=>setRejectNote(e.target.value)} multiline minRows={2} fullWidth placeholder="Reason for rejection (required)" />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setRejectOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={async ()=>{ if(!rejectNote.trim()) return; await onStatus('rejected', rejectNote.trim()); setRejectOpen(false); setRejectNote(''); }} variant="contained" color="error" disabled={submitting || !rejectNote.trim()}>Reject</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
