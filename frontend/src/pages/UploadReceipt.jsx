import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient, { getFileUrl } from '../api/axiosClient';
import { useAuth } from '../contexts/AuthContext';
import AttachmentButton from '../components/AttachmentButton';
import {
  Button,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  CircularProgress,
  FormHelperText,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
  Stack,
  Avatar,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  InputAdornment,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { styled } from '@mui/material/styles';

const fmtMoney = (n, currency = 'GBP') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n || 0));

const statusChip = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'approved': return { color: 'success', label: 'Approved' };
    case 'rejected': return { color: 'error', label: 'Rejected' };
    case 'intercompany': return { color: 'secondary', label: 'Intercompany' };
    case 'paid': return { color: 'success', label: 'Paid' };
    case 'payment done': return { color: 'success', label: 'Payment Done' };
    case 'processed': return { color: 'info', label: 'Processed' };
    case 'in_progress': return { color: 'info', label: 'In Progress' };
    case 'pending': return { color: 'warning', label: 'Pending' };
    default: return { color: 'default', label: status || 'Unknown' };
  }
};

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const UploadReceipt = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // We're no longer using useSnackbar, so it should be removed
  // const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [request, setRequest] = useState(null);
  const [payment, setPayment] = useState(null);
  const [payments, setPayments] = useState([]);

  // Fetch request and payment details
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [requestRes, paymentRes] = await Promise.all([
          axiosClient.get(`/requests/${id}`),
          axiosClient.get(`/requests/${id}/payments`)
        ]);

        const reqData = Array.isArray(requestRes.data) ? requestRes.data[0] : requestRes.data?.data || requestRes.data;
        setRequest(reqData);
        
        // Leave paid amount empty for manual entry
        setPaidAmount('');

        // Get all payments and sort by created_at in descending order
        const payData = Array.isArray(paymentRes.data)
          ? paymentRes.data.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
          : paymentRes.data?.data?.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)) || [];

        setPayments(payData);
        // Only set the most recent payment
        if (payData.length > 0) {
          setPayment(payData[0]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // Using alert for error message
        alert(error.response?.data?.message || 'Failed to load request details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]); // Removed enqueueSnackbar from dependency array

  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);

      const validTypes = [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      const invalidFiles = newFiles.filter(file => !validTypes.includes(file.type));

      if (invalidFiles.length > 0) {
        // Using alert for warning message
        alert('Invalid file type. Please upload only images, PDFs, or Word documents.');
        return;
      }

      if (files.length + newFiles.length > 5) {
        // Using alert for warning message
        alert('You can upload a maximum of 5 files');
        return;
      }

      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formDataToSend = new FormData();
      files.forEach((file) => {
        formDataToSend.append('receipts', file);
      });
      
      // Add paid amount to form data
      if (paidAmount) {
        formDataToSend.append('paidAmount', paidAmount);
      }

      const response = await axiosClient.post(
        `/requests/${id}/payment-done`,
        formDataToSend,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Use alert for success message from backend
      alert(response.data.message || 'Receipts uploaded successfully!');
      
      // Reload the page to show updated status
      window.location.reload();

    } catch (err) {
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });

      // Use alert for error message from backend
      alert(
        err.response?.data?.message || 'Failed to upload receipt. Please check console for details.'
      );

    } finally {
      setSubmitting(false);
    }
  };

  const handleBackNavigation = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(user?.role === 'Admin' ? '/dashboard' : '/my-requests');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!request) {
    return (
      <Box p={3} maxWidth="1200px" mx="auto">
        <Button startIcon={<ArrowBackIcon />} onClick={handleBackNavigation} sx={{ mb: 2 }}>
          Back
        </Button>
        <Typography variant="h6" color="error">Request not found</Typography>
      </Box>
    );
  }

  const sc = statusChip(request.status);
  const paymentSc = payment ? statusChip(payment.status) : { color: 'default', label: 'N/A' };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%', p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBackNavigation} size="small" color="inherit">
          Back
        </Button>
        <Typography variant="h5" fontWeight={800}>Upload Payment Receipt</Typography>
        <Chip size="small" color={sc.color} label={sc.label} sx={{ ml: 'auto' }} />
      </Box>

      <Grid container spacing={3} mb={4}>
        {/* Request Details */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Request Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Amount</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: 'success.main' }}>
                      {fmtMoney(request.amount, request.currency || 'GBP')}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Request ID</Typography>
                    <Typography>#{request.id}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Date</Typography>
                    <Typography>{request.createdAt ? new Date(request.createdAt).toLocaleString() : '-'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Description</Typography>
                    <Typography sx={{
                      mt: 0.5,
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      bgcolor: 'background.paper',
                      borderColor: 'divider',
                    }}>
                      {request.description || request.purpose || 'No description provided'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Information */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Payment Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {payments.length > 0 ? (
                <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <Table size="small" sx={{ minWidth: 500 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Payment ID</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Receipt</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payments.map((pay) => (
                        <TableRow key={pay.id}>
                          <TableCell>#{pay.id}</TableCell>
                          <TableCell>{pay.paidDate ? new Date(pay.paidDate).toLocaleString() : '-'}</TableCell>
                          <TableCell>{pay.method || 'N/A'}</TableCell>
                          <TableCell>{pay.reference || '-'}</TableCell>
                          <TableCell>{fmtMoney(pay.paidAmount || request.amount, request.currency || 'GBP')}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={statusChip(pay.status).color}
                              label={statusChip(pay.status).label}
                            />
                          </TableCell>
                          <TableCell>
                            {pay.receiptFilename ? (
                              <AttachmentButton
                                fileUrl={getFileUrl(pay.receiptFilename)}
                                label="View"
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">No receipt</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">No payment records found</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Upload Section */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Upload Receipt
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <form onSubmit={handleSubmit}>
            {/* Paid Amount Field */}
            <Box mb={3}>
              <TextField
                label="Paid Amount"
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                fullWidth
                required
                inputProps={{ 
                  step: "0.01",
                  min: "0"
                }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">{request?.currency || 'GBP'}</InputAdornment>,
                }}
                helperText="Enter the actual amount paid to the employee"
              />
            </Box>

            <Box mb={3}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                fullWidth
                sx={{ py: 2, mb: 1 }}
              >
                Click to select files
                <VisuallyHiddenInput
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                />
              </Button>
              <Typography variant="caption" display="block" textAlign="center" color="text.secondary">
                Supported formats: JPG, PNG, PDF (max 5 files, 10MB each)
              </Typography>
              {files.length === 0 && (
                <FormHelperText error sx={{ textAlign: 'center', mt: 1 }}>
                  Please select at least one file to upload
                </FormHelperText>
              )}
            </Box>

            {files.length > 0 && (
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>Selected Files:</Typography>
                <List dense>
                  {files.map((file, index) => (
                    <ListItem
                      key={index}
                      sx={{
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        mb: 1,
                        '&:last-child': { mb: 0 }
                      }}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          onClick={() => handleRemoveFile(index)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemIcon>
                        <AttachFileIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={`${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                        primaryTypographyProps={{ noWrap: true }}
                        sx={{ pr: 4 }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <Box display="flex" justifyContent="flex-end" gap={2} mt={4}>
              <Button
                variant="outlined"
                onClick={handleBackNavigation}
                disabled={submitting}
                startIcon={<ArrowBackIcon />}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={submitting || files.length === 0}
                startIcon={submitting ? <CircularProgress size={20} /> : null}
              >
                {submitting ? 'Uploading...' : 'Upload Receipts'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

const DetailItem = ({ label, value, fullWidth = false, bold = false }) => (
  <Grid item xs={12} sm={fullWidth ? 12 : 6}>
    <Typography
      variant="caption"
      color="textSecondary"
      display="block"
      sx={{
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        lineHeight: 1.2,
        mb: 0.5
      }}
    >
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{
        fontWeight: bold ? 600 : 'normal',
        wordBreak: 'break-word',
        fontSize: '0.9rem'
      }}
    >
      {value || '-'}
    </Typography>
  </Grid>
);

export default UploadReceipt;