import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';
import axiosClient from '../api/axiosClient';
import { getFileUrl } from '../api/axiosClient';
import { useAuth } from '../contexts/AuthContext.jsx';

// Use getFileUrl from axiosClient for all file URLs
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const fmtMoney = (n, currency = 'GBP') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n || 0));

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
  // Reason dialogs
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  // Payment dialog state
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payReference, setPayReference] = useState('');
  // Initialize payAmount with null instead of empty string to distinguish between not loaded and zero amount
  const [payAmount, setPayAmount] = useState(null);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0,10));
  const [payNotes, setPayNotes] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [payments, setPayments] = useState([]);
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    company: '',
    category: '',
    location: '',
    amount: '',
    description: '',
    dateOfPurchase: ''
  });
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  
  // Handle opening the payment dialog
  const handlePayOpen = async () => {
    // Format the amount with the request's currency when opening the dialog
    if (req?.amount != null) {
      // Use the same formatting as in the onBlur handler
      const numValue = parseFloat(req.amount);
      if (!isNaN(numValue)) {
        setPayAmount(fmtMoney(numValue, req.currency || 'GBP'));
      } else {
        setPayAmount('');
      }
    } else {
      setPayAmount('');
    }
    
    // Load existing request attachments as File objects
    if (req?.attachments && Array.isArray(req.attachments) && req.attachments.length > 0) {
      try {
        const filePromises = req.attachments.map(async (attachment) => {
          const filename = attachment.filename || attachment.originalName;
          const fileUrl = getFileUrl(`/uploads/${filename}`);
          
          try {
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            // Create a File object from the blob with the original name
            const file = new File([blob], attachment.originalName || filename, {
              type: attachment.mimetype || blob.type || 'application/octet-stream'
            });
            // Add metadata to track this is an existing file
            file.isExisting = true;
            file.originalFilename = filename;
            return file;
          } catch (err) {
            console.error(`Failed to load attachment ${filename}:`, err);
            return null;
          }
        });
        
        const loadedFiles = (await Promise.all(filePromises)).filter(f => f !== null);
        setAttachments(loadedFiles);
      } catch (err) {
        console.error('Error loading request attachments:', err);
        setAttachments([]);
      }
    } else {
      setAttachments([]);
    }
    
    setPayOpen(true);
  };
  
  // Check if there are any payment receipts to show
  const hasPaymentReceipts = useMemo(() => {
    return payments && Array.isArray(payments) && payments.some(p => p.receipt_filename);
  }, [payments]);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await axiosClient.get(`/requests/${id}`, { signal: controller.signal });
        setReq(data?.data || data);
        
        // Initialize edit data
        const requestData = data?.data || data;
        setEditData({
          company: requestData.company || '',
          category: requestData.category || '',
          location: requestData.location || '',
          amount: requestData.amount || '',
          description: requestData.description || '',
          dateOfPurchase: requestData.dateOfPurchase ? new Date(requestData.dateOfPurchase).toISOString().slice(0, 10) : ''
        });
        
        try {
          const payRes = await axiosClient.get(`/requests/${id}/payments`, { signal: controller.signal });
          setPayments(Array.isArray(payRes?.data?.data) ? payRes.data.data : []);
        } catch {}
        // preload companies for intercompany transfer
        try {
          const { data: comps } = await axiosClient.get('/companies?all=true', { signal: controller.signal });
          setCompanies(Array.isArray(comps) ? comps : []);
          console.log('Companies loaded:', comps); // Debug log
        } catch (e) {
          console.error('Error loading companies:', e); // Debug log
          // non-blocking
        }
        // Load categories
        try {
          const { data: cats } = await axiosClient.get('/categories', { signal: controller.signal });
          setCategories(Array.isArray(cats) ? cats : []);
        } catch (e) {
          console.error('Error loading categories:', e);
        }
        // Load locations
        try {
          const { data: locs } = await axiosClient.get('/locations', { signal: controller.signal });
          setLocations(Array.isArray(locs) ? locs : []);
        } catch (e) {
          console.error('Error loading locations:', e);
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
      // Close any open dialogs first
      setApproveOpen(false);
      setRejectOpen(false);
      
      // Use the appropriate reason based on status
      const requestData = {
        status: next,
        [next === 'approved' ? 'approvalReason' : 'rejectionReason']: note || null,
        performedByEmail: user?.email || null,
        performedByName: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() : null,
      };
      
      // Make a single API call to update the status
      const { data } = await axiosClient.put(`/requests/${id}/status`, requestData);
      
      // Update local state with the response
      setReq(data?.data || data);
      
      // Show success message
      setToast({ 
        open: true, 
        message: `Request ${next} successfully`, 
        severity: 'success' 
      });
      
      // Reload page after a short delay to show the success message
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      console.error('Error updating request status:', e);
      setToast({ 
        open: true, 
        message: e?.response?.data?.message || e.message || `Failed to ${next} request`,
        severity: 'error' 
      });
      setSubmitting(false);
    }
  };

  const onProceedPayment = async () => {
    try {
      setSubmitting(true);
      
      // Create FormData to handle file uploads
      const formData = new FormData();
      formData.append('method', payMethod);
      formData.append('reference', payReference || '');
      formData.append('paidAmount', payAmount || '');
      formData.append('paidDate', payDate || '');
      formData.append('notes', payNotes || '');
      formData.append('adminEmail', user?.email || '');
      
      // Append each file to the form data
      attachments.forEach((file, index) => {
        formData.append('attachments', file);
      });

      const { data } = await axiosClient.post(`/requests/${id}/proceed-payment`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setReq(data?.data || data);
      
      // Refresh payments list to show the new payment record
      try {
        const payRes = await axiosClient.get(`/requests/${id}/payments`);
        setPayments(Array.isArray(payRes?.data?.data) ? payRes.data.data : []);
      } catch (payErr) {
        console.error('Error refreshing payments:', payErr);
      }
      
      setToast({ open: true, message: 'Payment initiated and team notified with attachments', severity: 'success' });
      setPayOpen(false);
      setPayNotes('');
      setPayReference('');
      setAttachments([]);
      
      // Reload page after a short delay to show the success message
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      setToast({ open: true, message: e?.response?.data?.message || e.message || 'Failed to proceed payment', severity: 'error' });
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
      setToast({ open: true, message: 'Request transferred to another company successfully', severity: 'success' });
      setIcOpen(false);
      setIcNote('');
      setTargetCompany('');
      
      // Reload page after a short delay to show the success message
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      setToast({ open: true, message: e?.response?.data?.message || e.message || 'Failed to transfer', severity: 'error' });
      setSubmitting(false);
    }
  };

  const onSaveEdit = async () => {
    try {
      setSubmitting(true);
      await axiosClient.put(`/requests/${id}`, {
        company: editData.company,
        category: editData.category,
        location: editData.location,
        amount: editData.amount,
        description: editData.description,
        dateOfPurchase: editData.dateOfPurchase
      });
      const { data } = await axiosClient.get(`/requests/${id}`);
      setReq(data?.data || data);
      setEditMode(false);
      setToast({ open: true, message: 'Request updated successfully', severity: 'success' });
      
      // Reload page after a short delay to show the success message
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      setToast({ open: true, message: e?.response?.data?.message || e.message || 'Failed to update request', severity: 'error' });
      setSubmitting(false);
    }
  };

  const onCancelEdit = () => {
    // Reset edit data to original request data
    setEditData({
      company: req.company || '',
      category: req.category || '',
      location: req.location || '',
      amount: req.amount || '',
      description: req.description || '',
      dateOfPurchase: req.dateOfPurchase ? new Date(req.dateOfPurchase).toISOString().slice(0, 10) : ''
    });
    setEditMode(false);
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

  // Use the currency from the request data, default to 'GBP' if not available
  const currency = req.currency || 'GBP';

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
      {String(req.status).toLowerCase() === 'pending' && user?.role === 'Admin' && (
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
                {!editMode ? (
                  <>
                    <Button
                      variant="outlined"
                      color="primary"
                      disabled={submitting}
                      onClick={() => setEditMode(true)}
                    >
                      Edit Request
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CheckOutlinedIcon />}
                      disabled={submitting}
                      onClick={() => setApproveOpen(true)}
                    >
                      Approve
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
                  </>
                ) : (
                  <>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={submitting}
                      onClick={onSaveEdit}
                    >
                      Save Changes
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      disabled={submitting}
                      onClick={onCancelEdit}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      {(String(req.status).toLowerCase() === 'approved' || String(req.status).toLowerCase() === 'intercompany') && user?.role === 'Admin' && (
        <Card variant="outlined" sx={{ borderLeft: 4, borderLeftColor: (theme) => theme.palette.success.main, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckOutlinedIcon color="success" /> Approved
                  {String(req.status).toLowerCase() === 'intercompany' && (
                    <Chip size="small" label="Intercompany" color="secondary" sx={{ ml: 1 }} />
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {req.sent_to_payment 
                    ? 'This request has been sent to payment team. Payment has been processed.'
                    : String(req.status).toLowerCase() === 'intercompany'
                    ? 'This request has been transferred to another company. You can proceed to payment.'
                    : 'This request has been approved. You can transfer to another company or proceed to payment.'
                  }
                </Typography>
              </Box>
              {!req.sent_to_payment && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  {String(req.status).toLowerCase() === 'approved' && (
                    <Button 
                      variant="outlined" 
                      color="secondary" 
                      startIcon={<ApartmentOutlinedIcon />} 
                      onClick={() => setIcOpen(true)}
                    >
                      Intercompany Transfer
                    </Button>
                  )}
                  <Button variant="contained" color="primary" onClick={handlePayOpen}>
                    Proceed to Payment
                  </Button>
                </Stack>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {String(req.status).toLowerCase() === 'payment done' && (
        <Card variant="outlined" sx={{ borderLeft: 4, borderLeftColor: (theme) => theme.palette.info.main, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckOutlinedIcon color="info" /> Payment Completed
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Payment has been marked as done. This request is now complete.
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Payment Role: Upload Payment Receipt */}
      {user?.role === 'Payment' && String(req.status).toLowerCase() === 'processed' && (
        <Card variant="outlined" sx={{ borderLeft: 4, borderLeftColor: (theme) => theme.palette.primary.main, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AttachMoneyIcon color="primary" /> Payment Processed
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This request is ready for payment. Upload the payment receipt to mark it as complete.
                </Typography>
              </Box>
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<ReceiptLongOutlinedIcon />}
                onClick={() => navigate(`/requests/${id}/upload-receipt`)}
              >
                Upload Payment Receipt
              </Button>
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
                    {req.currency || 'GBP'} ({new Intl.NumberFormat(undefined, { style: 'currency', currency: req.currency || 'GBP' }).format(1).replace(/[0-9.,\s]/g, '')})
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
        {/* <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Payment Details</Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => navigate(`/requests/${id}/upload-receipt`)}
                >
                  Upload Payment Receipt
                </Button>
              </Box>
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
                        
                        // Reload page after a short delay to show the success message
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      } catch(err){
                        setToast({ open: true, message: err?.response?.data?.message || err.message || 'Failed to upload receipt', severity: 'error' });
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
        </Grid> */}
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
                    {editMode ? (
                      <OutlinedInput
                        fullWidth
                        size="small"
                        type="number"
                        value={editData.amount}
                        onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                        sx={{ mt: 0.5 }}
                      />
                    ) : (
                      <Typography variant="h6" fontWeight={800} sx={{ color: 'success.main' }}>
                        {fmtMoney(req.amount, currency)}
                      </Typography>
                    )}
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
                    {editMode ? (
                      <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                        <Select
                          value={editData.category}
                          onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Select Category</em>
                          </MenuItem>
                          {categories.map((cat) => (
                            <MenuItem key={cat.id} value={cat.name}>{cat.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <Box sx={{ mt: 0.5 }}>
                        <Chip size="small" label={req.category || '-'} variant="outlined" />
                      </Box>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Location</Typography>
                    {editMode ? (
                      <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                        <Select
                          value={editData.location}
                          onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {locations.map((loc) => (
                            <MenuItem key={loc.id} value={loc.name}>{loc.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <Typography fontWeight={600}>{req.location || '-'}</Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Company</Typography>
                    {editMode ? (
                      <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                        <Select
                          value={editData.company}
                          onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Select Company</em>
                          </MenuItem>
                          {companies.map((comp) => (
                            <MenuItem key={comp.id} value={comp.name}>{comp.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <>
                        <Typography fontWeight={600}>{req.company || '-'}</Typography>
                        {req.previousCompany && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Previous: {req.previousCompany}
                          </Typography>
                        )}
                      </>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Date of Purchase</Typography>
                    {editMode ? (
                      <OutlinedInput
                        fullWidth
                        size="small"
                        type="date"
                        value={editData.dateOfPurchase}
                        onChange={(e) => setEditData({ ...editData, dateOfPurchase: e.target.value })}
                        sx={{ mt: 0.5 }}
                      />
                    ) : (
                      <Typography fontWeight={600}>{req.dateOfPurchase ? new Date(req.dateOfPurchase).toLocaleDateString() : '-'}</Typography>
                    )}
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
                    {editMode ? (
                      <OutlinedInput
                        fullWidth
                        multiline
                        minRows={3}
                        value={editData.description || ''}
                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        placeholder="Enter description (optional)"
                        sx={{ mt: 0.5 }}
                      />
                    ) : (
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
                    )}
                  </Box>
                </Grid>

                {/* Travel Details Section */}
                {req.travelDetails && (req.travelDetails.flight || req.travelDetails.accommodation) && (
                  <Grid item xs={12}>
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
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                                <strong>Price:</strong> {fmtMoney(req.travelDetails.flight.price, req.travelDetails.currency || req.currency)}
                              </Typography>
                            </Stack>
                          </Box>
                        )}

                        {/* Accommodation Details */}
                        {req.travelDetails.accommodation && (
                          <Box>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                                <strong>Price:</strong> {fmtMoney(req.travelDetails.accommodation.totalPrice, req.travelDetails.currency || req.currency)} 
                                ({fmtMoney(req.travelDetails.accommodation.pricePerNight, req.travelDetails.currency || req.currency)}/night)
                              </Typography>
                            </Stack>
                          </Box>
                        )}

                        {/* Total Cost */}
                        {req.travelDetails.totalCost && (
                          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              Total Travel Cost: {fmtMoney(req.travelDetails.totalCost, req.travelDetails.currency || req.currency)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Attachments & Receipts - Right column beside Request Details */}
        <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
              <Tabs 
                value={tabValue} 
                onChange={(e, newValue) => setTabValue(newValue)}
                variant="fullWidth"
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab icon={<ReceiptLongOutlinedIcon />} label="Attachments" />
                <Tab icon={<ReceiptIcon />} label="Payment Receipts" disabled={!hasPaymentReceipts} />
              </Tabs>
              
              <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
                {tabValue === 0 ? (
                  // Request Attachments Tab
                  <>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Request Attachments
                    </Typography>
                    {Array.isArray(req.attachments) && req.attachments.length > 0 ? (
                      <Stack spacing={1}>
                        {req.attachments.map((f, idx) => {
                          const name = f.originalName || f.filename || `file-${idx+1}`;
                          // Construct the file URL using the getFileUrl helper
                          const fileUrl = getFileUrl(f.filename ? `/uploads/${f.filename}` : '');
                          return (
                            <Box key={`req-${idx}`} sx={{ display: 'flex', gap: 1 }}>
                              <Button 
                                component="a"
                                href={fileUrl}
                                target="_blank" 
                                rel="noopener noreferrer"
                                variant="outlined" 
                                size="small"
                                sx={{ 
                                  flex: 1, 
                                  justifyContent: 'flex-start', 
                                  textAlign: 'left', 
                                  textTransform: 'none', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {name}
                              </Button>
                            </Box>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No request attachments found
                      </Typography>
                    )}
                  </>
                ) : (
                  // Payment Receipts Tab
                  <>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Payment Receipts
                    </Typography>
                    {hasPaymentReceipts ? (
                      <Stack spacing={1}>
                        {payments
                          .filter(p => p.receipt_filename)
                          .map((p, idx) => {
                            const name = p.receipt_originalname || p.receipt_filename || `receipt-${idx+1}`;
                            // Construct the file URL using the getFileUrl helper
                            const fileUrl = getFileUrl(`/uploads/${p.receipt_filename}`);
                            return (
                              <Box key={`receipt-${idx}`} sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  component="a"
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  variant="outlined"
                                  size="small"
                                  sx={{ 
                                    flex: 1, 
                                    justifyContent: 'flex-start', 
                                    textAlign: 'left', 
                                    textTransform: 'none', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {name}
                                </Button>
                              </Box>
                            );
                          })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No payment receipts uploaded yet
                      </Typography>
                    )}
                  </>
                )}
              </Box>
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
            Transfer this expense to another company. After transfer, you can proceed to payment for the new company.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="ic-company-label">Transfer to Company</InputLabel>
            <Select
              labelId="ic-company-label"
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              input={<OutlinedInput label="Transfer to Company" />}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 300,
                    overflow: 'auto',
                  },
                },
              }}
            >
              {companies
                .filter(c => (req?.company ? c.name !== req.company : true))
                .map((c) => (
                <MenuItem key={c.id} value={c.name}>{c.name}{c.code ? ` (${c.code})` : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mt: 2 }}>
           
            <OutlinedInput id="ic-note" value={icNote} onChange={(e) => setIcNote(e.target.value)} multiline minRows={2} placeholder="Add a note for the transfer (optional)..." />
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIcOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={onIntercompany} variant="contained" disabled={!targetCompany || submitting}>Transfer</Button>
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
              <OutlinedInput 
                fullWidth 
                size="small" 
                placeholder="Reference (optional)" 
                value={payReference} 
                onChange={(e) => setPayReference(e.target.value)} 
              />
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
                    setPayAmount(fmtMoney(numValue, req.currency || 'GBP'));
                  }
                }}
                readOnly={!!req?.amount}
                sx={req?.amount ? { '& .MuiOutlinedInput-input': { backgroundColor: 'action.hover' } } : {}}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <OutlinedInput 
                fullWidth 
                size="small" 
                placeholder="Paid Date" 
                type="date" 
                value={payDate} 
                onChange={(e) => setPayDate(e.target.value)} 
              />
            </Grid>
            <Grid item xs={12}>
              <OutlinedInput 
                fullWidth 
                size="small" 
                multiline 
                minRows={2} 
                placeholder="Notes (optional)" 
                value={payNotes} 
                onChange={(e) => setPayNotes(e.target.value)} 
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Attachments
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Files from the original request are pre-selected. You can add more or remove any.
                </Typography>
              </Box>
              
              <input
                accept="image/*,.pdf,.doc,.docx"
                style={{ display: 'none' }}
                id="payment-attachments"
                multiple
                type="file"
                onChange={(e) => {
                  const newFiles = Array.from(e.target.files);
                  setAttachments(prev => [...prev, ...newFiles]);
                  e.target.value = ''; // Reset input to allow re-selecting same file
                }}
              />
              <label htmlFor="payment-attachments">
                <Button 
                  variant="outlined" 
                  component="span"
                  startIcon={<AttachFileIcon />}
                  size="small"
                >
                  Add More Attachments
                </Button>
              </label>
              
              {attachments.length > 0 && (
                <Box sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                    {attachments.length} file(s) will be sent with payment notification
                  </Typography>
                  <List dense disablePadding>
                    {attachments.map((file, index) => (
                      <ListItem 
                        key={index}
                        secondaryAction={
                          <IconButton 
                            edge="end" 
                            size="small" 
                            onClick={() => {
                              const newAttachments = [...attachments];
                              newAttachments.splice(index, 1);
                              setAttachments(newAttachments);
                            }}
                            title="Remove attachment"
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        }
                        sx={{ 
                          py: 0.5, 
                          px: 1,
                          borderRadius: 1,
                          '&:hover': { bgcolor: 'action.hover' },
                          bgcolor: file.isExisting ? 'action.selected' : 'transparent'
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <InsertDriveFileIcon fontSize="small" color={file.isExisting ? 'primary' : 'action'} />
                        </ListItemIcon>
                        <ListItemText 
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" component="span">
                                {file.name}
                              </Typography>
                              {file.isExisting && (
                                <Chip 
                                  label="From Request" 
                                  size="small" 
                                  color="primary" 
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                              )}
                            </Box>
                          }
                          secondary={`${(file.size / 1024).toFixed(1)} KB`}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => { setPayOpen(false); setAttachments([]); }} color="inherit">Cancel</Button>
          <Button 
            onClick={onProceedPayment} 
            variant="contained" 
            disabled={submitting || !payMethod}
            startIcon={submitting ? <CircularProgress size={20} /> : null}
          >
            {submitting ? 'Processing...' : 'Send to Payments'}
          </Button>
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
