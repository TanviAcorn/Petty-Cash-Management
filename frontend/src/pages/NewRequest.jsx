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
  ListItemSecondaryAction,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Divider
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import TravelRequestForm from '../components/TravelRequestForm';
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

const NewRequest = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Get the request ID from the URL if in edit mode
  const restrictedLocations = ["Unit 2B", "Hitchin", "TFC", "TFC - Office"];
  const restrictedCategory = "Amenities";
  const restrictedBudget = 30;
  
  // Format date to YYYY-MM-DD for the date input
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return ''; // Return empty string for invalid dates
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    dateOfPurchase: formatDateForInput(new Date()),
    category: '',
    company: '',
    location: '',
    description: '',
    amount: '',
    currency: 'USD',
    selectedLocation: null,
    attachments: ''
  });
  
  // Fetch request data if in edit mode
  useEffect(() => {
    if (id) {
      const fetchRequest = async () => {
        try {
          const { data } = await axiosClient.get(`/requests/${id}`);
          const request = data?.data || data;
          
          setFormData({
            dateOfPurchase: formatDateForInput(request.dateOfPurchase) || formatDateForInput(new Date()),
            category: request.category || '',
            company: request.company || '',
            location: request.location || '',
            description: request.description || '',
            amount: request.amount || '',
            currency: request.currency || 'USD',
            selectedLocation: request.location ? { name: request.location } : null
          });
          
          // Handle existing attachments if any
          if (request.attachments && request.attachments.length > 0) {
            // Note: You might need to handle existing attachments differently
            // This is just a placeholder
            console.log('Existing attachments:', request.attachments);
          }
        } catch (error) {
          console.error('Failed to fetch request:', error);
          alert('Failed to load request details');
        }
      };
      
      fetchRequest();
    }
  }, [id]);

  const [errors, setErrors] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTravelForm, setShowTravelForm] = useState(false);
  const [travelFormData, setTravelFormData] = useState(null);

  // Dynamic state for categories, companies, and locations
  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  
  // Exchange rates for currency conversion (simplified - in a real app, fetch from an API)
  const exchangeRates = {
    'GBP': 1,
    'USD': 1.3,
    'EUR': 1.1,
    'INR': 100
  };
  
  // Format currency based on selected currency
  const formatCurrency = (amount, currency = 'GBP') => {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(amount);
  };
  
  // Helper function to get currency symbol
  const getCurrencySymbol = (currency = 'GBP') => {
    return currencies.find(c => c.code === currency)?.symbol || '£';
  };

  // Convert amount to GBP
  const convertToGBP = (amount, fromCurrency) => {
    const rate = exchangeRates[fromCurrency] || 1;
    return amount / rate;
  };

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
        // Handle paginated companies response - extract data array
        const companiesData = Array.isArray(companiesRes.data?.data) ? companiesRes.data.data : companiesRes.data;
        setCompanies(Array.isArray(companiesData) ? companiesData : []);
        setLocations(locationsRes.data);
        setDataError('');
      } catch (err) {
        console.error('Failed to fetch dynamic data:', err);
        setDataError('Failed to load required data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
  
    let newFormData = { ...formData, [name]: value };
  
    // If location is changed, also store full location object
    if (name === "location") {
      const selectedLocation = locations.find(loc => loc.name === value) || null;
      newFormData.selectedLocation = selectedLocation;
    }

    // Check budget rule
    if (name === "amount" || name === "category" || name === "location") {
      // Check if category is "Travel Request"
      if (name === "category") {
        const isTravelRequest = value === "Travel Request";
        setShowTravelForm(isTravelRequest);
        if (!isTravelRequest) {
          setTravelFormData(null);
        }
      }
      
      // Clear any existing amount errors when changing category or location
      if (name !== "amount") {
        setErrors(prev => ({ ...prev, amount: "" }));
      }
      
      if (
        newFormData.location &&
        restrictedLocations.includes(newFormData.location) &&
        newFormData.category === restrictedCategory
      ) {
        const amount = parseFloat(newFormData.amount);
        if (newFormData.amount !== '' && !isNaN(amount) && amount > restrictedBudget) {
          setErrors(prev => ({
            ...prev,
            amount: `Maximum allowed is £${restrictedBudget} for ${restrictedCategory} in ${newFormData.location}`
          }));
        } else if (errors.amount) {
          // Clear error if amount is now valid
          setErrors(prev => ({ ...prev, amount: "" }));
        }
      } else if (errors.amount && errors.amount.includes('Maximum allowed')) {
        // Clear the budget restriction error if conditions are no longer met
        setErrors(prev => ({ ...prev, amount: "" }));
      }
    }
  
    setFormData(newFormData);
  };

  const handleTravelFormChange = (data) => {
    setTravelFormData(data);
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
    
    // For travel requests, amount is optional (will be set to 0 or calculated later)
    // For regular requests, amount is required
    if (!showTravelForm) {
      if (!formData.amount || isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
        newErrors.amount = 'Please enter a valid amount';
      }
    
      // Budget restriction check (only for non-travel requests)
      if (
        formData.location &&
        restrictedLocations.includes(formData.location) &&
        formData.category === restrictedCategory &&
        formData.amount &&
        !isNaN(parseFloat(formData.amount)) &&
        parseFloat(formData.amount) > restrictedBudget
      ) {
        newErrors.amount = `You cannot request more than £${restrictedBudget} for ${restrictedCategory} in ${formData.location}`;
      }
    }

    // For travel requests, validate travel form data instead of description
    if (showTravelForm) {
      if (!travelFormData || !travelFormData.reasonOfTravel) {
        newErrors.description = 'Please fill out the travel request form completely, including the reason for travel';
      }
    }
  
    if (attachments.length === 0) {
      newErrors.attachments = 'At least one attachment is required';
    }
  
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        setSubmitting(true);
        const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();

        const formDataToSend = new FormData();
        const employeeName = user.name ||
          (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null) ||
          user.email?.split('@')[0] || 'User';

        // Format the date to ISO string for the backend
        const formattedDate = formData.dateOfPurchase ? 
          new Date(formData.dateOfPurchase).toISOString() : 
          new Date().toISOString();

        formDataToSend.append('employeeName', employeeName);
        formDataToSend.append('employeeEmail', user.email || '');
        formDataToSend.append('company', formData.company);
        formDataToSend.append('category', formData.category);
        formDataToSend.append('location', formData.location);
        
        // For travel requests, set amount to 0 (will be updated later)
        // For regular requests, use the entered amount
        const amountValue = showTravelForm ? '0' : formData.amount;
        formDataToSend.append('amount', amountValue);
        
        formDataToSend.append('currency', formData.currency);
        formDataToSend.append('dateOfPurchase', formattedDate);
        
        // For travel requests, use reason from travel form; otherwise use description
        const descriptionText = showTravelForm && travelFormData?.reasonOfTravel 
          ? travelFormData.reasonOfTravel 
          : formData.description;
        formDataToSend.append('description', descriptionText);

        // Add travel form data if this is a travel request
        if (showTravelForm && travelFormData) {
          formDataToSend.append('isTravelRequest', 'true');
          formDataToSend.append('travelFormData', JSON.stringify(travelFormData));
        }

        // Add existing attachments if any (for edit mode)
        if (id) {
          formDataToSend.append('_method', 'PUT'); // For Laravel's API to handle as PUT request
        }

        // Add new attachments
        attachments.forEach((file) => {
          formDataToSend.append('attachments', file);
        });

        const endpoint = id ? `/requests/${id}` : '/requests';
        const method = id ? 'post' : 'post'; // Using POST with _method=PUT for Laravel
        
        await axiosClient({
          method,
          url: endpoint,
          data: formDataToSend,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        alert(id ? 'Request updated successfully!' : 'Request submitted successfully!');
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
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      p: 3, 
      m: 0, 
      maxWidth: '100%', 
      overflowX: 'hidden',
      backgroundColor: 'background.default'
    }}>
      <Box sx={{ 
        mb: 3,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'background.paper',
        p: 2,
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <Typography variant="h5" fontWeight={800}>New Petty Cash Request</Typography>
        <Typography variant="body2" color="text.secondary">Submit a new reimbursement request for your business expenses</Typography>
      </Box>
      <form onSubmit={handleSubmit} style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        width: '100%',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        <Grid container spacing={3} sx={{ 
          m: 0, 
          width: '100%',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          alignContent: 'flex-start'
        }}>
          {/* Left column: form sections */}
          <Grid size={{ xs: 12, lg: 8 }} sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            '& > *': {
              flexShrink: 0
            },
            '& > :last-child': {
              mb: 2,
              flex: 1,
              minHeight: '200px',
              overflow: 'auto'
            }
          }}>
            <Card variant="outlined" sx={{ flex: 1, mb: 2, borderRadius: 2, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
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
                  {/* First row: Date, Category, Company, Location */}
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Date of Purchase *"
                      name="dateOfPurchase"
                      type="date"
                      value={formData.dateOfPurchase || ''}
                      onChange={handleChange}
                      error={!!errors.dateOfPurchase}
                      helperText={errors.dateOfPurchase}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      inputProps={{
                        max: formatDateForInput(new Date()) // Prevent future dates
                      }}
                      size="small"
                      sx={{ mb: 2 }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <FormControl fullWidth error={!!errors.category} size="small" sx={{ mb: 2 }}>
                      <InputLabel id="category-label">Category *</InputLabel>
                      <Select
                        labelId="category-label"
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        label="Category *"
                        sx={{
                          '& .MuiSelect-select': {
                            minWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            paddingRight: '32px !important'
                          },
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'divider'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'primary.main'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderWidth: '1px',
                            borderColor: 'primary.main'
                          }
                        }}
                        disabled={loading}
                      >
                        <MenuItem value="">
                          <em style={{ color: '#aaa' }}>Select category</em>
                        </MenuItem>
                        {loading ? (
                          <MenuItem disabled>
                            <CircularProgress size={20} sx={{ mr: 1 }} /> Loading...
                          </MenuItem>
                        ) : (
                          categories.map((category) => (
                            <MenuItem key={category.id} value={category.name}>
                              {category.name}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                      <FormHelperText>{errors.category || dataError}</FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth error={!!errors.company} size="small">
                      <InputLabel id="company-label">Company *</InputLabel>
                      <Select
                        labelId="company-label"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        label="Company *"
                        sx={{
                          '& .MuiSelect-select': {
                            minWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            paddingRight: '32px !important'
                          },
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'divider'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'primary.main'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderWidth: '1px',
                            borderColor: 'primary.main'
                          }
                        }}
                        renderValue={(value) => value || 'Select company'}
                        disabled={loading}
                      >
                        <MenuItem value="">
                          <em style={{ color: '#aaa' }}>Select company</em>
                        </MenuItem>
                        {loading ? (
                          <MenuItem disabled><CircularProgress size={20} sx={{ mr: 1 }} /> Loading...</MenuItem>
                        ) : (
                          companies.map((company) => (
                            <MenuItem key={company.id} value={company.name}>
                              {company.name}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                      <FormHelperText>{errors.company || dataError}</FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel id="location-label">Location *</InputLabel>
                      <Select
                        labelId="location-label"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        label="Location"
                        sx={{
                          '& .MuiSelect-select': {
                            minWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            paddingRight: '32px !important'
                          },
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'divider'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'primary.main'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderWidth: '1px',
                            borderColor: 'primary.main'
                          }
                        }}
                      >
                        <MenuItem value="">
                          <em style={{ color: '#aaa' }}>Select location</em>
                        </MenuItem>
                        {locations.map((location) => (
                          <MenuItem key={location.id} value={location.name}>
                            {location.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {formData.selectedLocation &&
                        restrictedLocations.includes(formData.location) &&
                        formData.category === restrictedCategory && (
                        <Box sx={{ 
                          mt: 1, 
                          p: 1.5, 
                          bgcolor: 'grey.50', 
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Budget:</Typography>
                            <Typography variant="caption" fontWeight="medium">
                              {formatCurrency(30, 'GBP')}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Used:</Typography>
                            <Typography variant="caption" fontWeight="medium">
                              {formatCurrency(formData.selectedLocation.usedAmount || 0, 'GBP')}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Remaining:</Typography>
                            <Typography 
                              variant="caption" 
                              fontWeight="bold"
                              color={formData.selectedLocation.remainingAmount > 0 ? 'success.main' : 'error.main'}
                            >
                              {formatCurrency(formData.selectedLocation.remainingAmount || 30, 'GBP')}
                            </Typography>
                          </Box>
                          {formData.amount && !isNaN(formData.amount) && formData.currency && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">After this request:</Typography>
                                <Typography 
                                  variant="caption" 
                                  fontWeight="bold"
                                  color={
                                    (formData.selectedLocation.remainingAmount - convertToGBP(Number(formData.amount), formData.currency)) >= 0 
                                      ? 'success.main' 
                                      : 'error.main'
                                  }
                                >
                                  {formatCurrency(
                                    formData.selectedLocation.remainingAmount - convertToGBP(Number(formData.amount), formData.currency), 
                                    'GBP'
                                  )}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        </Box>
                      )}
                    </FormControl>
                  </Grid>
                  
                  {/* Description field - full width - Hide for Travel Request */}
                  {!showTravelForm && (
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        label="Description *"
                        name="description"
                        multiline
                        rows={4}
                        value={formData.description}
                        onChange={handleChange}
                        error={!!errors.description}
                        helperText={errors.description || "Provide a detailed description of the expense"}
                        placeholder="Enter expense description..."
                        size="small"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            alignItems: 'flex-start',
                          },
                          '& .MuiInputBase-multiline': {
                            '& textarea': {
                              minHeight: '25px',
                              resize: 'vertical'
                            }
                          }
                        }}
                      />
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
            
            {/* Amount Information - Hide for Travel Request */}
            {!showTravelForm && (
              <Card variant="outlined" sx={{ flex: 1, mb: 2, borderRadius: 2, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
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
                    <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Amount *"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      error={!!errors.amount}
                      helperText={
                        errors.amount || 
                        (formData.location && 
                        restrictedLocations.includes(formData.location) && 
                        formData.category === restrictedCategory
                          ? `Note: Maximum £${restrictedBudget} allowed for ${restrictedCategory} in ${formData.location}`
                          : '')
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {getCurrencySymbol(formData.currency)}
                          </InputAdornment>
                        ),
                        inputProps: { 
                          min: 0, 
                          step: 0.01,
                          max: formData.location && 
                              restrictedLocations.includes(formData.location) && 
                              formData.category === restrictedCategory 
                            ? restrictedBudget 
                            : undefined
                        }
                      }}
                      margin="normal"
                      FormHelperTextProps={{
                        style: {
                          color: formData.location && 
                                restrictedLocations.includes(formData.location) && 
                                formData.category === restrictedCategory 
                            ? '#1976d2' // Blue color for informational message
                            : '#d32f2f' // Red color for error message
                        }
                      }}
                    />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl fullWidth size="small">
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
            )}

            {/* Travel Request Form - Show when Travel Request category is selected */}
            {showTravelForm && (
              <TravelRequestForm
                formData={formData}
                onChange={handleTravelFormChange}
              />
            )}

            <Card variant="outlined" sx={{ flex: 1, mb: 2, borderRadius: 2, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AttachFile sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={700}>
                    Attachments
                  </Typography>
                </Box>
                <Typography variant="body2" color={errors.attachments ? 'error' : 'text.secondary'} sx={{ mb: 1 }}>
                  Upload receipts and supporting documents (PDF, JPG, PNG, DOC, DOCX, ZIP - max 10MB each) *
                </Typography>
                {errors.attachments && (
                  <Typography variant="caption" color="error" sx={{ mb: 2 }}>
                    {errors.attachments}
                  </Typography>
                )}
                <Box
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  sx={{
                    border: `2px dashed ${errors.attachments ? 'error.main' : dragActive ? 'primary.main' : 'divider'}`,
                    borderRadius: 3,
                    p: 4,
                    textAlign: 'center',
                    bgcolor: dragActive ? 'action.hover' : 'background.default',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      bgcolor: 'action.hover',
                      borderColor: errors.attachments ? 'error.main' : 'primary.light',
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
                  <Button variant="outlined" component="span" size="small">
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
          </Grid>

          {/* Right column: summary and actions */}
          <Grid size={{ xs: 12, lg: 4 }} sx={{
            position: 'sticky',
            top: 0,
            alignSelf: 'flex-start',
            height: 'fit-content',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: '3px',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.2)'
              }
            }
          }}>
            <Card variant="outlined" sx={{ 
              borderRadius: 2, 
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
              '&:hover': {
                boxShadow: '0 6px 24px rgba(0,0,0,0.08)'
              },
              transition: 'box-shadow 0.3s ease-in-out'
            }}>
              <CardContent sx={{ 
                p: 3,
                '& > *:not(:last-child)': {
                  mb: 2
                }
              }}>
                {/* Request Summary Section */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Info sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={700}>
                    Request Summary
                  </Typography>
                </Box>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 3, width: '100%' }}>
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '60%' }} />
                    </colgroup>
                    <TableBody>
                      <TableRow>
                        <TableCell variant="head" sx={{ 
                          fontWeight: 500, 
                          borderRight: '1px solid', 
                          borderColor: 'divider', 
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          py: 1.25
                        }}>
                          Date of Purchase
                        </TableCell>
                        <TableCell align="left" sx={{ py: 1.25, color: 'text.primary' }}>
                          {formData.dateOfPurchase || 'Not specified'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell variant="head" sx={{ 
                          fontWeight: 500, 
                          borderRight: '1px solid', 
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          py: 1.25
                        }}>
                          Category
                        </TableCell>
                        <TableCell align="left" sx={{ py: 1.25, color: 'text.primary' }}>
                          {formData.category || 'Not specified'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell variant="head" sx={{ 
                          fontWeight: 500, 
                          borderRight: '1px solid', 
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          py: 1.25
                        }}>
                          Company
                        </TableCell>
                        <TableCell align="left" sx={{ py: 1.25, color: 'text.primary' }}>
                          {formData.company || 'Not specified'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell variant="head" sx={{ 
                          fontWeight: 500, 
                          borderRight: '1px solid', 
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          py: 1.25
                        }}>
                          Location
                        </TableCell>
                        <TableCell align="left" sx={{ py: 1.25, color: 'text.primary' }}>
                          {formData.location || 'Not specified'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell variant="head" sx={{ 
                          fontWeight: 500, 
                          borderRight: '1px solid', 
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          py: 1.25
                        }}>
                          Description
                        </TableCell>
                        <TableCell align="left" sx={{ py: 1.25 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: 'text.primary'
                            }}>
                            {formData.description || 'No description'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell variant="head" sx={{ 
                          fontWeight: 500, 
                          borderRight: '1px solid', 
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          py: 1.25
                        }}>
                          Amount
                        </TableCell>
                        <TableCell align="left" sx={{ py: 1.25 }}>
                          <Typography variant="body2" color="primary.main" fontWeight="bold">
                            {formData.amount
                              ? `${currencies.find(c => c.code === formData.currency)?.symbol || '$'}${parseFloat(formData.amount).toFixed(2)}`
                              : 'Not specified'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell variant="head" sx={{ 
                          fontWeight: 500, 
                          borderRight: '1px solid', 
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          py: 1.25
                        }}>
                          currency
                        </TableCell>
                        <TableCell align="left" sx={{ py: 1.25 }}>
                          <Typography variant="body2" color="primary.main" fontWeight="bold">
                            {formData.currency || 'Not specified'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell variant="head" sx={{ 
                          fontWeight: 500, 
                          borderRight: '1px solid', 
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          py: 1.25
                        }}>
                          view attachments
                        </TableCell>
                        <TableCell align="left" sx={{ py: 1.25 }}>
                          <Typography variant="body2" color="primary.main" fontWeight="bold">
                            {attachments.length > 0 ? (
                              <Box>
                                {attachments.map((file, index) => (
                                  <Typography key={index} variant="body2" component="div">
                                    • {file.name}
                                  </Typography>
                                ))}
                              </Box>
                            ) : 'No attachments'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Buttons Section */}
                <Box sx={{ display: 'flex', gap: 2, width: '100%', pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    onClick={() => navigate('/my-requests')} 
                    size="small" 
                    sx={{ 
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 500,
                      py: 1,
                      '&:hover': {
                        borderWidth: '1.5px'
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    variant="contained" 
                    disabled={submitting} 
                    size="small" 
                    fullWidth 
                    sx={{ 
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 500,
                      py: 1,
                      boxShadow: 'none',
                      '&:hover': {
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                      },
                      '&.Mui-disabled': {
                        backgroundColor: 'action.disabledBackground',
                        color: 'action.disabled'
                      }
                    }}
                  >
                    {submitting ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <CircularProgress size={16} color="inherit" />
                        Submitting...
                      </Box>
                    ) : 'Submit Request'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default NewRequest;