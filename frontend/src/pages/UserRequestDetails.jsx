import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  CircularProgress,
  Button,
  Alert,
  Snackbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import axiosClient, { getFileUrl } from '../api/axiosClient';
import AttachmentButton from '../components/AttachmentButton';

const fmtMoney = (n, currency) => {
  try {
    const safeCurrency = currency && typeof currency === 'string' && /^[A-Z]{3}$/.test(currency.trim())
      ? currency.trim()
      : 'USD';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: safeCurrency }).format(Number(n || 0));
  } catch (error) {
    return `$${(Number(n) || 0).toFixed(2)}`;
  }
};

const statusChip = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'approved': return { color: 'success', label: 'Approved' };
    case 'rejected': return { color: 'error', label: 'Rejected' };
    case 'intercompany': return { color: 'secondary', label: 'Intercompany' };
    case 'processed': return { color: 'info', label: 'Processed' };
    case 'payment done': return { color: 'success', label: 'Payment Done' };
    default: return { color: 'warning', label: 'Pending' };
  }
};

export default function UserRequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [req, setReq] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

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

  // Re-upload a single missing attachment
  const handleReplace = async (attachmentIndex, file) => {
    const formData = new FormData();
    formData.append('attachments', file);
    const { data } = await axiosClient.post(`/requests/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    // Refresh request data so the new fileUrl is reflected
    const refreshed = await axiosClient.get(`/requests/${id}`);
    setReq(refreshed.data?.data || refreshed.data);
    setToast({ open: true, message: `"${file.name}" uploaded successfully`, severity: 'success' });
  };

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

  const currency = req.currency || 'USD';

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

                {/* Travel Details */}
                {req.travelDetails && (req.travelDetails.flight || req.travelDetails.accommodation) && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Travel Itinerary
                    </Typography>
                    <Box sx={(theme)=>({
                      mt: 0.5,
                      p: 2,
                      borderRadius: 1,
                      border: '1px solid',
                      bgcolor: theme.palette.mode === 'dark' ? theme.palette.background.paper : 'grey.50',
                      borderColor: theme.palette.divider,
                    })}>
                      {/* Flight Details */}
                      {req.travelDetails.flight && (
                        <Box sx={{ mb: req.travelDetails.accommodation ? 2 : 0 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                            ✈️ Flight
                          </Typography>
                          <Stack spacing={0.5}>
                            <Typography variant="body2">
                              <strong>Airline:</strong> {req.travelDetails.flight.airline} ({req.travelDetails.flight.flightNumber})
                            </Typography>
                            <Typography variant="body2">
                              <strong>Route:</strong> {req.travelDetails.flight.origin} → {req.travelDetails.flight.destination}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Departure:</strong> {new Date(req.travelDetails.flight.departureTime).toLocaleString()}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Arrival:</strong> {new Date(req.travelDetails.flight.arrivalTime).toLocaleString()}
                            </Typography>
                            {req.travelDetails.flight.returnDepartureTime && (
                              <>
                                <Typography variant="body2">
                                  <strong>Return Departure:</strong> {new Date(req.travelDetails.flight.returnDepartureTime).toLocaleString()}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Return Arrival:</strong> {new Date(req.travelDetails.flight.returnArrivalTime).toLocaleString()}
                                </Typography>
                              </>
                            )}
                            <Typography variant="body2">
                              <strong>Duration:</strong> {req.travelDetails.flight.duration} | <strong>Stops:</strong> {req.travelDetails.flight.stops}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
                              <strong>Price:</strong> {fmtMoney(req.travelDetails.flight.price, req.travelDetails.currency || currency)}
                            </Typography>
                          </Stack>
                        </Box>
                      )}

                      {/* Accommodation Details */}
                      {req.travelDetails.accommodation && (
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                            🏨 Accommodation
                          </Typography>
                          <Stack spacing={0.5}>
                            <Typography variant="body2">
                              <strong>Hotel:</strong> {req.travelDetails.accommodation.name}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Address:</strong> {req.travelDetails.accommodation.address}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Rating:</strong> {'⭐'.repeat(req.travelDetails.accommodation.starRating)} ({req.travelDetails.accommodation.guestRating}/10)
                            </Typography>
                            <Typography variant="body2">
                              <strong>Check-in:</strong> {new Date(req.travelDetails.accommodation.checkInDate).toLocaleDateString()}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Check-out:</strong> {new Date(req.travelDetails.accommodation.checkOutDate).toLocaleDateString()}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Nights:</strong> {req.travelDetails.accommodation.nights} | <strong>Guests:</strong> {req.travelDetails.accommodation.guests}
                            </Typography>
                            {req.travelDetails.accommodation.amenities && req.travelDetails.accommodation.amenities.length > 0 && (
                              <Typography variant="body2">
                                <strong>Amenities:</strong> {req.travelDetails.accommodation.amenities.join(', ')}
                              </Typography>
                            )}
                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
                              <strong>Price:</strong> {fmtMoney(req.travelDetails.accommodation.totalPrice, req.travelDetails.currency || currency)} 
                              ({fmtMoney(req.travelDetails.accommodation.pricePerNight, req.travelDetails.currency || currency)}/night)
                            </Typography>
                          </Stack>
                        </Box>
                      )}

                      {/* Total Cost */}
                      {req.travelDetails.totalCost && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            Total Travel Cost: {fmtMoney(req.travelDetails.totalCost, req.travelDetails.currency || currency)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
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
                    <AttachmentButton
                      key={idx}
                      fileUrl={f.fileUrl || getFileUrl(f.filename || '')}
                      label={f.originalName || f.filename || `file-${idx+1}`}
                      onReplace={(file) => handleReplace(idx, file)}
                    />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No attachments</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast(p => ({ ...p, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
