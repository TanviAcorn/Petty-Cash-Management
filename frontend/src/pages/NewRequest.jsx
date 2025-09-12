import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  Grid,
  MenuItem,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  CircularProgress,
  ListItemSecondaryAction
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { 
  AttachMoney, 
  Info,
  AttachFile,
  CloudUpload,
  Delete,
  InsertDriveFile
} from '@mui/icons-material';

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
];

const locations = [
  'Unit 2B',
  'Hitchin',
  'TFC',
  'TFC - Office',
  'Acme',
  'USA Site 1',
  'USA Site 2',
  'NL',
  'PL',
  'BE',
  'Germany'
];

const NewRequest = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    dateOfPurchase: new Date().toISOString().split('T')[0],
    category: '',
    company: '',
    location: '',
    description: '',
    amount: '',
    currency: 'USD'
  });
  
  const [errors, setErrors] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dynamic state for categories and companies
  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');

  // Use useEffect to fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [categoriesRes, companiesRes, locationsRes] = await Promise.all([
          axiosClient.get('/categories'),
          axiosClient.get('/companies'),
          axiosClient.get('/locations')
        ]);
        setCategories(categoriesRes.data);
        setCompanies(companiesRes.data);
        setLocations(locationsRes.data);
        setDataError('');
      } catch (err) {
        console.error('Failed to fetch dynamic data:', err);
        setDataError('Failed to load categories and companies. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files) => {
    const validFiles = Array.from(files).filter(file => {
      const validTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip'
      ];
      const maxSize = 10 * 1024 * 1024; // 10MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });

    setAttachments(prev => [...prev, ...validFiles.slice(0, 5 - prev.length)]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.dateOfPurchase) newErrors.dateOfPurchase = 'Date of purchase is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.company) newErrors.company = 'Company is required';
    if (!formData.amount || isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        setSubmitting(true);
        const user = (() => { try { return JSON.parse(localStorage.getItem('user')||'{}'); } catch { return {}; } })();
        
        const formDataToSend = new FormData();
        const employeeName = user.name || 
                               (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null) ||
                               user.email?.split('@')[0] || 'User';
                               
        formDataToSend.append('employeeName', employeeName);
        formDataToSend.append('employeeEmail', user.email || '');
        formDataToSend.append('company', formData.company);
        formDataToSend.append('category', formData.category);
        formDataToSend.append('location', formData.location);
        formDataToSend.append('amount', formData.amount);
        formDataToSend.append('dateOfPurchase', formData.dateOfPurchase);
        formDataToSend.append('description', formData.description);
        
        attachments.forEach((file) => {
          formDataToSend.append('attachments', file);
        });
        
        await axiosClient.post('/requests', formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        alert('Request submitted successfully!');
        navigate('/my-requests');
      } catch (err) {
        console.error('Submit failed', err);
        alert(err?.response?.data?.message || 'Failed to submit request');
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1200, mx: 'auto', width: '100%' }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>New Petty Cash Request</Typography>
        <Typography variant="body2" color="text.secondary">Submit a new reimbursement request for your business expenses</Typography>
      </Box>
      <form onSubmit={handleSubmit}>
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Info sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={700}>
                Basic Information
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Provide the basic details of your expense
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Date of Purchase *"
                  name="dateOfPurchase"
                  type="date"
                  value={formData.dateOfPurchase}
                  onChange={handleChange}
                  error={!!errors.dateOfPurchase}
                  helperText={errors.dateOfPurchase}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              {/* The category dropdown now takes the full width, moving it to a new line */}
              <Grid item xs={12}>
                <FormControl fullWidth error={!!errors.category}>
                  <InputLabel>Category *</InputLabel>
                  <Select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    label="Category *"
                    displayEmpty
                    disabled={loading} // Disable while loading
                  >
                    <MenuItem value=""><em>Select category</em></MenuItem>
                    {loading ? (
                      <MenuItem disabled><CircularProgress size={20} sx={{ mr: 1 }} /> Loading...</MenuItem>
                    ) : (
                      categories.map((category) => (<MenuItem key={category.id} value={category.name}>{category.name}</MenuItem>))
                    )}
                  </Select>
                  <FormHelperText>{errors.category || dataError}</FormHelperText>
                </FormControl>
              </Grid>
              {/* The company dropdown also takes the full width, moving it below the category dropdown */}
              <Grid item xs={12}>
                <FormControl fullWidth error={!!errors.company}>
                  <InputLabel>Company *</InputLabel>
                  <Select
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    label="Company *"
                    displayEmpty
                    disabled={loading} // Disable while loading
                  >
                    <MenuItem value=""><em>Select company</em></MenuItem>
                    {loading ? (
                      <MenuItem disabled><CircularProgress size={20} sx={{ mr: 1 }} /> Loading...</MenuItem>
                    ) : (
                      companies.map((company) => (<MenuItem key={company.id} value={company.name}>{company.name}</MenuItem>))
                    )}
                  </Select>
                  <FormHelperText>{errors.company || dataError}</FormHelperText>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Location</InputLabel>
                  <Select
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    label="Location"
                    displayEmpty
                  >
                    <MenuItem value=""><em>Select location</em></MenuItem>
                    {locations.map((location) => (
                      <MenuItem key={location} value={location}>{location}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description *"
                  name="description"
                  multiline
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  error={!!errors.description}
                  helperText={errors.description}
                  placeholder="Provide a detailed description of the expense..."
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AttachMoney sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={700}>
                Amount Information
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Specify the amount and currency for your expense
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Amount *"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  error={!!errors.amount}
                  helperText={errors.amount}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {currencies.find(c => c.code === formData.currency)?.symbol || '$'}
                      </InputAdornment>
                    ),
                  }}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    label="Currency"
                  >
                    {currencies.map((currency) => (<MenuItem key={currency.code} value={currency.code}>{currency.code} ({currency.symbol})</MenuItem>))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AttachFile sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={700}>
                Attachments
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Upload receipts and supporting documents (PDF, JPG, PNG, DOC, DOCX, ZIP - max 10MB each)
            </Typography>
            <Box
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              sx={{
                border: `2px dashed ${dragActive ? '#1976d2' : '#e0e0e0'}`,
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: dragActive ? '#e3f2fd' : '#fafafa',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: '#e3f2fd',
                  borderColor: '#1976d2',
                }
              }}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.zip"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
              <CloudUpload sx={{ fontSize: 48, color: '#1976d2', mb: 2 }} />
              <Typography variant="body1" sx={{ mb: 1, color: '#666' }}>
                Drag and drop files here, or click to select
              </Typography>
              <Button variant="outlined" component="span">
                Choose Files
              </Button>
            </Box>
            {attachments.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Uploaded Files ({attachments.length})
                </Typography>
                <List>
                  {attachments.map((file, index) => (
                    <ListItem key={index} sx={{ bgcolor: '#f5f5f5', mb: 1, borderRadius: 1 }}>
                      <ListItemIcon>
                        <InsertDriveFile sx={{ color: '#1976d2' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => removeAttachment(index)}
                          color="error"
                          size="small"
                        >
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: '#e3f2fd', border: '1px solid #bbdefb', mb: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>Request Summary</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Date of Purchase:</Typography>
                <Typography variant="body1" fontWeight="medium">{formData.dateOfPurchase || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Category:</Typography>
                <Typography variant="body1" fontWeight="medium">{formData.category || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Company:</Typography>
                <Typography variant="body1" fontWeight="medium">{formData.company || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Location:</Typography>
                <Typography variant="body1" fontWeight="medium">{formData.location || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Amount:</Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formData.amount ? `${currencies.find(c => c.code === formData.currency)?.symbol || '$'}${formData.amount}` : 'Not specified'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Description:</Typography>
                <Typography variant="body1" fontWeight="medium">{formData.description || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Attachments:</Typography>
                <Typography variant="body1" fontWeight="medium">{attachments.length} file(s) uploaded</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/my-requests')}
            size="large"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            size="large"
            sx={{ minWidth: 150 }}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default NewRequest;