import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

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
  Chip
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { styled } from '@mui/material/styles';

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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5005/api';

const UploadReceipt = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState([]);
  const [request, setRequest] = useState(null);
  const [payment, setPayment] = useState(null);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Fetch request and payment details
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [requestRes, paymentRes] = await Promise.all([
          axios.get(`${API_BASE}/requests/${id}`),
          axios.get(`${API_BASE}/requests/${id}/payments`)
        ]);
        
        setRequest(Array.isArray(requestRes.data) ? requestRes.data[0] : requestRes.data);
        
        if (paymentRes.data && paymentRes.data.length > 0) {
          setPayment(Array.isArray(paymentRes.data) ? paymentRes.data[0] : paymentRes.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        enqueueSnackbar('Failed to load request details', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, enqueueSnackbar]);

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
        enqueueSnackbar('Invalid file type. Please upload only images, PDFs, or Word documents.', {
          variant: 'error'
        });
        return;
      }

      if (files.length + newFiles.length > 5) {
        enqueueSnackbar('You can upload a maximum of 5 files', {
          variant: 'warning'
        });
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
    console.log('Starting form submission...');
  
    setSubmitting(true);
    console.log('Form data prepared, sending to server...');
  
    try {
      const formDataToSend = new FormData();
      files.forEach((file) => {
        formDataToSend.append('receipts', file);
        console.log('Added file:', file.name);
      });
  
      console.log('Sending request to:', `/requests/${id}/upload-receipts`);
      
      const response = await axios.post(
        `http://localhost:5176/api/requests/${id}/upload-receipts`,
        formDataToSend,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
  
      console.log('Server response:', response.data);
      enqueueSnackbar('Receipt uploaded successfully!', { variant: 'success' });
      setTimeout(() => navigate('/my-requests'), 1500);
    } catch (err) {
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: {
          url: err.config?.url,
          method: err.config?.method
        }
      });
      enqueueSnackbar(
        err.response?.data?.message || 'Failed to upload receipt. Please check console for details.',
        { variant: 'error' }
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3} maxWidth="1200px" mx="auto">
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1">Upload Payment Receipt</Typography>
      </Box>

      <Grid container spacing={3} mb={4}>
        {/* Payment Details Card */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Box sx={{ width: 4, height: 24, bgcolor: 'primary.main', mr: 1.5 }} />
                <Typography variant="h6" fontWeight="medium">Payment Details</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <DetailItem label="Transaction ID" value={payment?.id || 'N/A'} />
                <DetailItem label="Payment Date" value={formatDate(payment?.paidDate)} />
                <DetailItem label="Amount" value={formatCurrency(payment?.paidAmount || request?.amount)} bold />
                <DetailItem label="Payment Method" value={payment?.method || 'N/A'} />
                <DetailItem label="Status" value={
                  <Chip 
                    label={payment?.status || 'Pending'} 
                    size="small" 
                    color={
                      payment?.status?.toLowerCase() === 'paid' ? 'success' : 
                      payment?.status?.toLowerCase() === 'pending' ? 'warning' : 'default'
                    }
                  />
                } />
                <DetailItem label="Reference" value={payment?.reference || 'N/A'} fullWidth />
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Request Details Card */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Box sx={{ width: 4, height: 24, bgcolor: 'primary.main', mr: 1.5 }} />
                <Typography variant="h6" fontWeight="medium">Request Details</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <DetailItem label="Request ID" value={request?.id || 'N/A'} />
                <DetailItem label="Requested On" value={formatDate(request?.createdAt)} />
                <DetailItem label="Requested By" value={request?.requestedBy || 'N/A'} />
                <DetailItem label="Department" value={request?.department || 'N/A'} />
                <DetailItem label="Project" value={request?.project || 'N/A'} />
                <DetailItem label="Status" value={
                  <Chip 
                    label={request?.status || 'Pending'} 
                    size="small" 
                    color={
                      request?.status?.toLowerCase() === 'approved' ? 'success' : 
                      request?.status?.toLowerCase() === 'rejected' ? 'error' : 'warning'
                    }
                  />
                } />
                <DetailItem label="Purpose" value={request?.purpose || 'N/A'} fullWidth />
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <form onSubmit={handleSubmit}>
          <Box mb={3}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{ py: 2 }}
            >
              Click to select files
              <VisuallyHiddenInput
                type="file"
                multiple
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx"
              />
            </Button>
            <Typography variant="caption" display="block" textAlign="center" mt={1} color="text.secondary">
              Supported formats: JPG, PNG, PDF, DOC, DOCX (max 5 files)
            </Typography>
            {files.length === 0 && (
              <FormHelperText error sx={{ mt: 1, textAlign: 'center' }}>
                Please upload at least one file
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
                      secondary={`${(file.size / 1024).toFixed(2)} KB`}
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
              onClick={() => navigate(-1)}
              disabled={submitting}
            >
              Cancel
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
      </Paper>
    </Box>
  );
};

// Reusable DetailItem component
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