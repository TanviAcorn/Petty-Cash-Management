import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import TravelRequestForm from '../components/TravelRequestForm';
import {
  Info,
  AttachFile,
  CloudUpload,
  Delete,
  InsertDriveFile,
  FlightTakeoff,
  History,
} from '@mui/icons-material';

const NewTravelRequest = () => {
  const navigate = useNavigate();

  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState(() => {
    const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const employeeName = user.name ||
      (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null) ||
      user.email?.split('@')[0] || '';
    return {
      dateOfPurchase: formatDateForInput(new Date()),
      category: 'Travel Request',
      company: user.company || '',
      location: '',
      description: '',
      amount: '',
      currency: 'GBP',
      selectedLocation: null,
      employeeName,
      department: user.department || '',
    };
  });

  const [errors, setErrors] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [travelFormData, setTravelFormData] = useState(null);

  // Last trip recommendation
  const [lastTrip, setLastTrip] = useState(null);
  const [showRecommendation, setShowRecommendation] = useState(false);

  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
        const [companiesRes, locationsRes, lastTripRes] = await Promise.all([
          axiosClient.get('/companies'),
          axiosClient.get('/locations'),
          user.email ? axiosClient.get(`/l1-approvals/last-trip?email=${encodeURIComponent(user.email)}`).catch(() => ({ data: { data: null } })) : Promise.resolve({ data: { data: null } }),
        ]);
        const companiesData = Array.isArray(companiesRes.data?.data) ? companiesRes.data.data : companiesRes.data;
        setCompanies(Array.isArray(companiesData) ? companiesData : []);
        setLocations(locationsRes.data);

        if (lastTripRes.data?.data) {
          setLastTrip(lastTripRes.data.data);
          setShowRecommendation(true);
        }
        setDataError('');
      } catch (err) {
        console.error('Failed to fetch data:', err);
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
    if (name === 'location') {
      const selectedLocation = locations.find(loc => loc.name === value) || null;
      newFormData.selectedLocation = selectedLocation;
    }
    setFormData(newFormData);
  };

  const handleTravelFormChange = (data) => {
    setTravelFormData(data);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleFiles = (files) => {
    const validFiles = Array.from(files).filter(file => {
      const validTypes = [
        'application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
      ];
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024;
    });
    setAttachments(prev => [...prev, ...validFiles.slice(0, 5 - prev.length)]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.dateOfPurchase) newErrors.dateOfPurchase = 'Date is required';
    if (!formData.company) newErrors.company = 'Company is required';
    if (!travelFormData || !travelFormData.reasonOfTravel) {
      newErrors.travelForm = 'Please fill out the travel request form completely, including the reason for travel';
    }
    // Reason of Travel minimum 20 words
    if (travelFormData?.reasonOfTravel) {
      const wordCount = travelFormData.reasonOfTravel.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < 20) {
        newErrors.travelForm = `Reason of Travel must be at least 20 words (currently ${wordCount})`;
      }
    }
    // Car Park: vehicle number and car color required when car park is yes
    if (travelFormData?.carParkRequired === 'yes') {
      if (!travelFormData?.carParkVehicleNumber?.trim()) {
        newErrors.travelForm = 'Vehicle number is required when Car Park is selected';
      }
      if (!travelFormData?.carParkCarColor?.trim()) {
        newErrors.travelForm = 'Car color is required when Car Park is selected';
      }
    }
    // Note: attachments are optional
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
      const formDataToSend = new FormData();
      const employeeName = user.name ||
        (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null) ||
        user.email?.split('@')[0] || 'User';

      const formattedDate = formData.dateOfPurchase
        ? new Date(formData.dateOfPurchase).toISOString()
        : new Date().toISOString();

      formDataToSend.append('employeeName', employeeName);
      formDataToSend.append('employeeEmail', user.email || '');
      formDataToSend.append('company', formData.company);
      formDataToSend.append('category', 'Travel Request');
      formDataToSend.append('location', formData.location || '');
      formDataToSend.append('amount', '0');
      formDataToSend.append('currency', formData.currency);
      formDataToSend.append('dateOfPurchase', formattedDate);
      formDataToSend.append('description', travelFormData?.reasonOfTravel || '');
      formDataToSend.append('isTravelRequest', 'true');
      formDataToSend.append('travelFormData', JSON.stringify(travelFormData));

      attachments.forEach(file => formDataToSend.append('attachments', file));

      await axiosClient({
        method: 'post',
        url: '/requests',
        data: formDataToSend,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert('Travel request submitted successfully!');
      navigate('/my-requests');
    } catch (err) {
      console.error('Submit failed', err);
      alert(err?.response?.data?.message || 'Failed to submit travel request');
    } finally {
      setSubmitting(false);
    }
  };

  // Build a readable summary of last trip for display
  const buildLastTripSummary = (td) => {
    if (!td) return [];
    const items = [];
    items.push({ label: 'Travel Type', value: td.travelType === 'domestic' ? 'Domestic' : 'International' });
    if (td.countryOfTravel) items.push({ label: 'Country', value: td.countryOfTravel });
    if (td.cityOfTravelDomestic) items.push({ label: 'City', value: td.cityOfTravelDomestic });
    if (td.tripType) items.push({ label: 'Trip Type', value: td.tripType === 'roundTrip' ? 'Round Trip' : td.tripType === 'multiCity' ? 'Multi-City' : 'One Way' });
    if (td.roundTrip?.fromCity) items.push({ label: 'Route', value: `${td.roundTrip.fromCity} → ${td.roundTrip.toCity}` });
    if (td.roundTrip?.departureDate) items.push({ label: 'Departure', value: td.roundTrip.departureDate });
    if (td.roundTrip?.arrivalDate) items.push({ label: 'Return', value: td.roundTrip.arrivalDate });
    const reqs = td.requirements || {};
    const reqLabels = { flights: 'Flights', visa: 'Visa', rentedVehicle: 'Rented Vehicle', carPark: 'Airport Car Park', food: 'Food Preferance', baggage: 'Baggage Requirements' };
    const selected = Object.entries(reqs).filter(([, v]) => v).map(([k]) => reqLabels[k] || k);
    if (selected.length) items.push({ label: 'Requirements', value: selected.join(', ') });
    if (td.reasonOfTravel) {
      const words = td.reasonOfTravel.trim().split(/\s+/);
      items.push({ label: 'Reason', value: words.length > 10 ? words.slice(0, 10).join(' ') + '…' : td.reasonOfTravel });
    }
    return items;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', p: 3, backgroundColor: 'background.default' }}>

      {/* ── Last Trip Recommendation Dialog ── */}
      <Dialog open={showRecommendation} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <History color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>Welcome back!</Typography>
            <Typography variant="caption" color="text.secondary">
              We found your last trip — Trip #{lastTrip?.id} on {lastTrip?.createdAt ? new Date(lastTrip.createdAt).toLocaleDateString() : ''}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Here are the details from your last travel request. Would you like to use them again?
          </Typography>
          <Table size="small">
            <TableBody>
              {buildLastTripSummary(lastTrip?.travelData).map(row => (
                <TableRow key={row.label}>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', width: '40%', bgcolor: 'action.hover', fontSize: '0.8rem', py: 1 }}>{row.label}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', py: 1 }}>{row.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => { setShowRecommendation(false); setLastTrip(null); }}
          >
            No, start fresh
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setTravelFormData(lastTrip.travelData);
              setShowRecommendation(false);
            }}
          >
            Yes, use last trip details
          </Button>
        </DialogActions>
      </Dialog>
      <Box sx={{ mb: 3, p: 2, borderRadius: 2, backgroundColor: 'background.paper', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FlightTakeoff sx={{ color: 'primary.main' }} />
          <Typography variant="h5" fontWeight={800}>New Travel Request</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">Submit a travel request for approval before your trip</Typography>
      </Box>

      <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Grid container spacing={3} sx={{ m: 0, width: '100%', alignContent: 'flex-start' }}>
          {/* Left column */}
          <Grid size={{ xs: 12, lg: 8 }} sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* Basic Info */}
            <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, borderColor: 'divider' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Info sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={700}>Basic Information</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Date *"
                      name="dateOfPurchase"
                      type="date"
                      value={formData.dateOfPurchase || ''}
                      onChange={handleChange}
                      error={!!errors.dateOfPurchase}
                      helperText={errors.dateOfPurchase}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ max: formatDateForInput(new Date()) }}
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth error={!!errors.company} size="small">
                      <InputLabel>Company *</InputLabel>
                      <Select name="company" value={formData.company} onChange={handleChange} label="Company *" disabled={loading}>
                        <MenuItem value=""><em style={{ color: '#aaa' }}>Select company</em></MenuItem>
                        {loading ? (
                          <MenuItem disabled><CircularProgress size={20} sx={{ mr: 1 }} /> Loading...</MenuItem>
                        ) : (
                          companies.map(c => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)
                        )}
                      </Select>
                      <FormHelperText>{errors.company || dataError}</FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Location</InputLabel>
                      <Select name="location" value={formData.location} onChange={handleChange} label="Location">
                        <MenuItem value=""><em style={{ color: '#aaa' }}>Select location</em></MenuItem>
                        {locations.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Travel Form */}
            {errors.travelForm && (
              <Typography variant="caption" color="error" sx={{ mb: 1, px: 1 }}>{errors.travelForm}</Typography>
            )}
            <TravelRequestForm formData={formData} onChange={handleTravelFormChange} initialData={travelFormData} />

            {/* Attachments */}
            <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, borderColor: 'divider' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AttachFile sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={700}>Supporting Documents</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Please upload any relevant documents including travel itinerary, invitation letters, or other supporting evidence (PDF, JPG, PNG, DOC, DOCX, ZIP — max 10MB each)
                </Typography>
                {errors.attachments && (
                  <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>{errors.attachments}</Typography>
                )}
                <Box
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                  sx={{
                    border: `2px dashed ${dragActive ? 'primary.main' : '#ccc'}`,
                    borderRadius: 3, p: 4, textAlign: 'center',
                    bgcolor: dragActive ? 'action.hover' : 'background.default',
                    cursor: 'pointer', transition: 'all 0.3s ease',
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.light' }
                  }}
                  onClick={() => document.getElementById('travel-file-input').click()}
                >
                  <input id="travel-file-input" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.zip" onChange={handleFileInput} style={{ display: 'none' }} />
                  <CloudUpload sx={{ fontSize: 48, color: '#1976d2', mb: 2 }} />
                  <Typography variant="body1" sx={{ mb: 0.5, color: '#444', fontWeight: 500 }}>
                    Drag and drop your documents here
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                    Invitation letters, itinerary, visa support, hotel bookings, etc.
                  </Typography>
                  <Button variant="outlined" component="span" size="small">Choose Files</Button>
                </Box>
                {attachments.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>Uploaded Files ({attachments.length})</Typography>
                    <List>
                      {attachments.map((file, index) => (
                        <ListItem key={index} sx={{ bgcolor: '#f5f5f5', mb: 1, borderRadius: 1 }}>
                          <ListItemIcon><InsertDriveFile sx={{ color: '#1976d2' }} /></ListItemIcon>
                          <ListItemText primary={file.name} secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`} />
                          <ListItemSecondaryAction>
                            <IconButton edge="end" onClick={() => removeAttachment(index)} color="error" size="small">
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

          {/* Right column: summary */}
          <Grid size={{ xs: 12, lg: 4 }} sx={{ position: 'sticky', top: 0, alignSelf: 'flex-start', height: 'fit-content' }}>
            <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Info sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={700}>Request Summary</Typography>
                </Box>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
                  <Table size="small">
                    <TableBody>
                      {(() => {
                        const tf = travelFormData;
                        const rows = [];

                        // Basic
                        rows.push({ label: 'Date', value: formData.dateOfPurchase || '—' });
                        rows.push({ label: 'Company', value: formData.company || '—' });
                        rows.push({ label: 'Location', value: formData.location || '—' });

                        if (tf) {
                          // Travel type
                          rows.push({ label: 'Travel Type', value: tf.travelType === 'domestic' ? 'Domestic' : 'International' });

                          if (tf.travelType === 'international') {
                            rows.push({ label: 'Country', value: tf.countryOfTravel || '—' });
                            // Trip type
                            const tripLabel = tf.tripType === 'roundTrip' ? 'Round Trip' : tf.tripType === 'multiCity' ? 'Multi-City' : 'One Way';
                            rows.push({ label: 'Trip Type', value: tripLabel });

                            if (tf.tripType === 'roundTrip' && tf.roundTrip) {
                              const rt = tf.roundTrip;
                              if (rt.fromCity || rt.toCity) rows.push({ label: 'Route', value: `${rt.fromCity || '—'} → ${rt.toCity || '—'}` });
                              if (rt.departureDate) rows.push({ label: 'Departure', value: rt.departureDate });
                              if (rt.arrivalDate) rows.push({ label: 'Return', value: rt.arrivalDate });
                              if (rt.needsHotel) {
                                rows.push({ label: 'Hotel', value: `${rt.hotelFrom || '—'} to ${rt.hotelTo || '—'}${rt.hotelDays ? ` (${rt.hotelDays} days)` : ''}` });
                              }
                            }

                            if (tf.tripType === 'multiCity' && tf.multiCityLegs?.length) {
                              tf.multiCityLegs.forEach((leg, i) => {
                                rows.push({ label: `Leg ${i + 1}`, value: `${leg.fromCity || '—'} → ${leg.toCity || '—'}${leg.date ? ` | ${leg.date}` : ''}` });
                                if (leg.needsHotel) {
                                  rows.push({ label: `  Hotel ${i + 1}`, value: `${leg.hotelFrom || '—'} to ${leg.hotelTo || '—'}${leg.hotelDays ? ` (${leg.hotelDays} days)` : ''}` });
                                }
                              });
                            }
                          }

                          if (tf.travelType === 'domestic') {
                            rows.push({ label: 'City', value: tf.cityOfTravelDomestic || '—' });
                            rows.push({ label: 'Date', value: tf.dateOfTravel || '—' });
                            if (tf.departurePostcode || tf.destinationPostcode) {
                              rows.push({ label: 'Postcodes', value: `${tf.departurePostcode || '—'} → ${tf.destinationPostcode || '—'}` });
                            }
                            if (tf.domesticHotel?.needsHotel) {
                              const dh = tf.domesticHotel;
                              rows.push({ label: 'Hotel', value: `${dh.hotelFrom || '—'} to ${dh.hotelTo || '—'}${dh.hotelDays ? ` (${dh.hotelDays} days)` : ''}` });
                            }
                          }

                          // Requirements
                          const reqs = tf.requirements || {};
                          const reqLabels = {
                            flights: 'Flights', visa: 'Visa', rentedVehicle: 'Rented Vehicle',
                            carPark: 'Airport Car Park', food: 'Food Preferance', overnightStay: 'Overnight Stay', baggage: 'Baggage Requirements'
                          };
                          const selectedReqs = Object.entries(reqs).filter(([, v]) => v).map(([k]) => reqLabels[k] || k);
                          if (selectedReqs.length) rows.push({ label: 'Requirements', value: selectedReqs.join(', ') });

                          // Car Park details
                          if (tf.carParkRequired === 'yes') {
                            rows.push({ label: 'Car Park', value: `${tf.carParkDuration || '—'} | ${tf.carParkVehicleNumber || '—'} | ${tf.carParkCarColor || '—'}` });
                          }

                          // Departure airport
                          if (tf.preferredDepartureAirport) rows.push({ label: 'Departure Airport', value: tf.preferredDepartureAirport });

                          // Reason
                          if (tf.reasonOfTravel) {
                            const words = tf.reasonOfTravel.trim().split(/\s+/).filter(Boolean);
                            rows.push({ label: 'Reason', value: words.length > 12 ? words.slice(0, 12).join(' ') + '…' : tf.reasonOfTravel });
                          }
                        }

                        rows.push({ label: 'Documents', value: attachments.length > 0 ? `${attachments.length} file(s)` : 'None' });

                        return rows.map(row => (
                          <TableRow key={row.label}>
                            <TableCell variant="head" sx={{ fontWeight: 500, borderRight: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', color: 'text.secondary', fontSize: '0.8125rem', py: 1.25, width: '42%', verticalAlign: 'top' }}>
                              {row.label}
                            </TableCell>
                            <TableCell sx={{ py: 1.25, color: 'text.primary', fontSize: '0.8125rem', wordBreak: 'break-word' }}>{row.value}</TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ display: 'flex', gap: 2, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button variant="outlined" fullWidth onClick={() => navigate('/my-requests')} size="small" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 500, py: 1 }}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" disabled={submitting} size="small" fullWidth sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 500, py: 1, boxShadow: 'none' }}>
                    {submitting ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} color="inherit" />
                        Submitting...
                      </Box>
                    ) : 'Submit Travel Request'}
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

export default NewTravelRequest;
