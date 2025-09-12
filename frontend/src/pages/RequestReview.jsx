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

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');
const FILE_BASE = API_BASE.replace(/\/api\/?$/, '');

const fmtMoney = (n, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n || 0));

const statusChip = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'approved': return { color: 'success', label: 'Approved' };
    case 'rejected': return { color: 'error', label: 'Rejected' };
    case 'intercompany': return { color: 'secondary', label: 'Intercompany' };
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
  const [submitting, setSubmitting] = useState(false);
  // Intercompany state
  const [icOpen, setIcOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [targetCompany, setTargetCompany] = useState('');
  const [icNote, setIcNote] = useState('');
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await axiosClient.get(`/requests/${id}`, { signal: controller.signal });
        setReq(data?.data || data);
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

  const onStatus = async (next) => {
    try {
      setSubmitting(true);
      // Using generic status update endpoint
      await axiosClient.put(`/requests/${id}/status`, {
        status: next,
      });
      // Refetch
      const { data } = await axiosClient.get(`/requests/${id}`);
      setReq(data?.data || data);
      setToast({ open: true, message: `Request ${next}`, severity: 'success' });
    } catch (e) {
      setError(e?.response?.data?.message || e.message || `Failed to ${next} request`);
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

  const currency = 'USD'; // If you store currency, swap here

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
                  onClick={() => onStatus('approved')}
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
                  onClick={() => onStatus('rejected')}
                >
                  Reject
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        {/* Employee Info */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Employee Information</Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ width: 36, height: 36 }}>{(req.employeeName || '?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()}</Avatar>
                  <Box>
                    <Typography fontWeight={600}>{req.employeeName}</Typography>
                    <Typography variant="body2" color="text.secondary">{req.employeeEmail}</Typography>
                  </Box>
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">Company</Typography>
                  <Typography>{req.company || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Submitted</Typography>
                  <Typography>{req.createdAt ? new Date(req.createdAt).toLocaleString() : '-'}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Request Details */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Request Details</Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Amount</Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ color: 'success.main' }}>
                    {fmtMoney(req.amount, currency)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Currency</Typography>
                  <Typography>{currency}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Category</Typography>
                  <Chip size="small" label={req.category || '-'} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Location</Typography>
                  <Typography>{req.location || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Description</Typography>
                  <Typography>{req.description || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Company</Typography>
                  <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {req.company || '-'}
                  </Typography>
                  {req.previousCompany && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Previous: {req.previousCompany}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Attachments */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptLongOutlinedIcon /> Attachments
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {Array.isArray(req.attachments) && req.attachments.length > 0 ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {req.attachments.map((f, idx) => (
                    <Button key={idx} component={Link} to={`${FILE_BASE}/uploads/${encodeURIComponent(f.filename || '')}`} target="_blank" rel="noopener" variant="outlined" size="small">
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

        {/* Meta */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box><Chip size="small" color={sc.color} label={sc.label} /></Box>
                </Grid>
                {req.previousCompany && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Previous Company</Typography>
                    <Typography variant="body2">{req.previousCompany}</Typography>
                  </Grid>
                )}
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Approved At</Typography>
                  <Typography variant="body2">{req.approvedAt ? new Date(req.approvedAt).toLocaleString() : '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Rejected At</Typography>
                  <Typography variant="body2">{req.rejectedAt ? new Date(req.rejectedAt).toLocaleString() : '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Date of Purchase</Typography>
                  <Typography variant="body2">{req.dateOfPurchase ? new Date(req.dateOfPurchase).toLocaleDateString() : '-'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
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
            <InputLabel shrink htmlFor="ic-note">Note (optional)</InputLabel>
            <OutlinedInput id="ic-note" value={icNote} onChange={(e) => setIcNote(e.target.value)} multiline minRows={2} placeholder="Add a note for the transfer..." />
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIcOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={onIntercompany} variant="contained" disabled={!targetCompany || submitting}>Approve & Transfer</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={toast.severity} onClose={() => setToast(prev => ({ ...prev, open: false }))} variant="filled">{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
