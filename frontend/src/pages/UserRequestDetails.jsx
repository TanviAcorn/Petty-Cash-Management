import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Avatar,
  CircularProgress,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import axiosClient from '../api/axiosClient';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');
const FILE_BASE = API_BASE.replace(/\/api\/?$/, '');

const fmtMoney = (n, currency = 'USD') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n || 0));

const statusChip = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'approved': return { color: 'success', label: 'Approved' };
    case 'rejected': return { color: 'error', label: 'Rejected' };
    case 'intercompany': return { color: 'secondary', label: 'Intercompany' };
    default: return { color: 'warning', label: 'Pending' };
  }
};

export default function UserRequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [req, setReq] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await axiosClient.get(`/requests/${id}`, { signal: controller.signal });
        setReq(data?.data || data);
      } catch (e) {
        if (e?.code === 'ERR_CANCELED') return;
        setError(e?.response?.data?.message || e.message || 'Failed to load request');
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [id]);

  const sc = useMemo(() => statusChip(req?.status), [req]);

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
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }} color="inherit">Back</Button>
        <Card variant="outlined"><CardContent><Typography color="error">{error}</Typography></CardContent></Card>
      </Box>
    );
  }

  if (!req) return null;

  const currency = 'USD';

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="small" color="inherit">Back</Button>
        <Typography variant="h5" fontWeight={800}>Request Details</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Request ID: {req.id}</Typography>
        <Chip size="small" color={sc.color} label={sc.label} sx={{ ml: 'auto', textTransform: 'none' }} />
      </Box>

      <Grid container spacing={2}>
        {/* Request Information */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Request Information</Typography>
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
                  <Typography variant="caption" color="text.secondary">Company</Typography>
                  <Typography>{req.company || '-'}</Typography>
                  {req.previousCompany && (
                    <Typography variant="caption" color="text.secondary" display="block">Previous: {req.previousCompany}</Typography>
                  )}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Description</Typography>
                  <Typography>{req.description || '-'}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Timeline */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Timeline</Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Purchase Date</Typography>
                  <Typography>{req.dateOfPurchase ? new Date(req.dateOfPurchase).toLocaleDateString() : '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Request Submitted</Typography>
                  <Typography>{req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-'}</Typography>
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
      </Grid>
    </Box>
  );
}
