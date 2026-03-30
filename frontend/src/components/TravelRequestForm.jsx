import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Grid,
  Checkbox, FormControlLabel, FormGroup, Divider, MenuItem,
  ToggleButtonGroup, ToggleButton, Radio, RadioGroup,
  FormControl, FormLabel, IconButton, Button, Select, InputLabel,
  Snackbar, Alert
} from '@mui/material';
import axiosClient from '../api/axiosClient';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const defaultLeg = () => ({ fromCity: '', toCity: '', date: '', dateFlex: false, dateFlexFrom: '', dateFlexTo: '' , needsHotel: false, hotelFrom: '', hotelTo: '', hotelDays: '' });

const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format for min date

const TravelRequestForm = ({ formData, onChange, initialData }) => {
  const [travelType, setTravelType] = useState(initialData?.travelType || 'international');
  const [tripType, setTripType] = useState(initialData?.tripType || 'roundTrip');

  const [internationalRequirements, setInternationalRequirements] = useState(
    initialData?.requirements && initialData?.travelType === 'international'
      ? initialData.requirements
      : { flights: false, visa: false, rentedVehicle: false, carPark: false, food: false, baggage: false, accompanying: false }
  );

  const [domesticRequirements, setDomesticRequirements] = useState(
    initialData?.requirements && initialData?.travelType === 'domestic'
      ? initialData.requirements
      : { flights: false, rentedVehicle: false, carPark: false, food: false, overnightStay: false, baggage: false, accompanying: false }
  );

  const [carParkRequired, setCarParkRequired] = useState(initialData?.carParkRequired || 'no');
  const [carParkDuration, setCarParkDuration] = useState(initialData?.carParkDuration || '');
  const [carParkVehicleNumber, setCarParkVehicleNumber] = useState(initialData?.carParkVehicleNumber || '');
  const [carParkCarColor, setCarParkCarColor] = useState(initialData?.carParkCarColor || '');
  const [rentedVehicleRequired, setRentedVehicleRequired] = useState(initialData?.rentedVehicleRequired || 'no');
  const [rentedVehicleLegs, setRentedVehicleLegs] = useState(
    initialData?.rentedVehicleLegs?.length ? initialData.rentedVehicleLegs : [{ pickupPoint: '', dropOffPoint: '', vehicleType: 'Manual' }, { pickupPoint: '', dropOffPoint: '', vehicleType: 'Manual' }]
  );
  const [visaRequired, setVisaRequired] = useState(initialData?.visaRequired || 'no');
  const [baggageRequired, setBaggageRequired] = useState(initialData?.baggageRequired || 'no');
  const [accompanying, setAccompanying] = useState(initialData?.accompanying || 'no');
  const [accompanyingNames, setAccompanyingNames] = useState(initialData?.accompanyingNames || '');
  const [domesticHotel, setDomesticHotel] = useState(initialData?.domesticHotel || { needsHotel: false, hotelFrom: '', hotelTo: '', hotelDays: '' });
  const [domesticDateFlex, setDomesticDateFlex] = useState(false);
  const [domesticDateFlexFrom, setDomesticDateFlexFrom] = useState('');
  const [domesticDateFlexTo, setDomesticDateFlexTo] = useState('');

  const [visaTypes, setVisaTypes] = useState([]);
  const [passportInfo, setPassportInfo] = useState({ passport_number: '', nationality: '', passport_expiry: '', passport_name: '', passport_issue_date: '' });
  const [passportLoading, setPassportLoading] = useState(false);
  const [passportSnackbar, setPassportSnackbar] = useState({ open: false, type: 'success' });
  const [passportDirty, setPassportDirty] = useState(false);
  const [passportSaving, setPassportSaving] = useState(false);

  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  useEffect(() => {
    axiosClient.get('/locations')
      .then(res => setLocations(res.data || []))
      .catch(err => console.error('Failed to fetch locations:', err))
      .finally(() => setLocationsLoading(false));
  }, []);

  useEffect(() => {
    axiosClient.get('/visa-types')
      .then(res => setVisaTypes(res.data || []))
      .catch(err => console.error('Failed to fetch visa types:', err));
  }, []);

  const fetchPassportInfo = () => {
    setPassportLoading(true);
    axiosClient.get('/users/passport-info')
      .then(res => {
        const p = res.data || {};
        setPassportInfo({
          passport_number: p.passport_number || '',
          nationality: p.nationality || '',
          passport_expiry: p.passport_expiry ? p.passport_expiry.split('T')[0] : '',
          passport_name: p.passport_name || '',
          passport_issue_date: p.passport_issue_date ? p.passport_issue_date.split('T')[0] : ''
        });
      })
      .catch(err => console.error('Failed to fetch passport info:', err))
      .finally(() => setPassportLoading(false));
  };

  const [roundTrip, setRoundTrip] = useState(initialData?.roundTrip || {
    fromCity: '', toCity: '', departureDate: '', arrivalDate: '',
    departureDateFlexFrom: '', departureDateFlexTo: '',
    arrivalDateFlexFrom: '', arrivalDateFlexTo: '',
    needsHotel: false, hotelFrom: '', hotelTo: '', hotelDays: ''
  });
  const [rtDepartureFlex, setRtDepartureFlex] = useState(false);
  const [rtArrivalFlex, setRtArrivalFlex] = useState(false);

  const [multiCityLegs, setMultiCityLegs] = useState(
    initialData?.multiCityLegs?.length ? initialData.multiCityLegs : [defaultLeg(), defaultLeg()]
  );
  const [autoFilledLegs, setAutoFilledLegs] = useState(new Set());

  const [foodOptions, setFoodOptions] = useState(initialData?.foodOptions || {
    breakfastIncl: false, veg: false, vegan: false, nonVegan: false
  });

  const [travelData, setTravelData] = useState({
    travelType: initialData?.travelType || 'international',
    employeeName: formData.employeeName || '',
    department: formData.department || '',
    company: formData.company || '',
    countryOfTravel: initialData?.countryOfTravel || '',
    preferredDepartureAirport: initialData?.preferredDepartureAirport || '',
    destinationAirport: initialData?.destinationAirport || '',
    nationality: initialData?.nationality || '',
    visaType: initialData?.visaType || '',
    lengthOfVisa: initialData?.lengthOfVisa || '',
    dateOfTravel: initialData?.dateOfTravel || '',
    cityOfTravelDomestic: initialData?.cityOfTravelDomestic || '',
    departurePostcode: initialData?.departurePostcode || '',
    destinationPostcode: initialData?.destinationPostcode || '',
    placeOfStay: initialData?.placeOfStay || '',
    stayFrom: initialData?.stayFrom || '',
    stayTo: initialData?.stayTo || '',
    pickupPoint: initialData?.pickupPoint || '',
    dropOffPoint: initialData?.dropOffPoint || '',
    vehicleType: initialData?.vehicleType || 'Manual',
    hotelFrom: initialData?.hotelFrom || '',
    hotelTo: initialData?.hotelTo || '',
    hotelNumberOfDays: initialData?.hotelNumberOfDays || '',
    foodNumberOfDays: initialData?.foodNumberOfDays || '',
    carParkRequired: initialData?.carParkRequired || 'no',
    carParkDuration: initialData?.carParkDuration || '',
    reasonOfTravel: '',  // always start fresh — reason is trip-specific
    remarks: '',
    baggageCount: initialData?.baggageCount || '',
    baggageNotes: initialData?.baggageNotes || '',
    baggageWeight: initialData?.baggageWeight || '',
    baggageCabinBag: initialData?.baggageCabinBag || false,
    baggageCheckIn: initialData?.baggageCheckIn || false,
  });

  useEffect(() => {
    setTravelData(prev => ({
      ...prev,
      employeeName: formData.employeeName || '',
      department: formData.department || '',
      company: formData.company || ''
    }));
  }, [formData.employeeName, formData.department, formData.company]);

  const emit = (overrides = {}) => {
    const reqs = travelType === 'international' ? internationalRequirements : domesticRequirements;
    onChange({
      ...travelData, ...overrides,
      requirements: reqs, tripType, roundTrip, multiCityLegs, foodOptions,
      carParkRequired, carParkDuration, carParkVehicleNumber, carParkCarColor,
      rentedVehicleRequired, rentedVehicleLegs,
      domesticHotel, domesticDateFlex, domesticDateFlexFrom, domesticDateFlexTo,
      accompanying, accompanyingNames,
    });
  };

  const calcNights = (from, to) => {
    if (!from || !to) return '';
    const diff = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);
    return diff > 0 ? String(Math.round(diff)) : '';
  };

  const handleTravelTypeChange = (_e, val) => {
    if (!val) return;
    setTravelType(val);
    const nd = { ...travelData, travelType: val };
    setTravelData(nd);
    onChange({
      ...nd,
      requirements: val === 'international' ? internationalRequirements : domesticRequirements,
      tripType, roundTrip, multiCityLegs, foodOptions
    });
  };

  const handleIntlReqChange = (e) => {
    const { name, checked } = e.target;
    const nr = { ...internationalRequirements, [name]: checked };
    setInternationalRequirements(nr);
    onChange({ ...travelData, requirements: nr, tripType, roundTrip, multiCityLegs, foodOptions });
  };

  const handleDomReqChange = (e) => {
    const { name, checked } = e.target;
    const nr = { ...domesticRequirements, [name]: checked };
    setDomesticRequirements(nr);
    onChange({ ...travelData, requirements: nr, tripType, roundTrip, multiCityLegs, foodOptions });
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    const nd = { ...travelData, [name]: value };
    setTravelData(nd);
    const reqs = travelType === 'international' ? internationalRequirements : domesticRequirements;
    onChange({ ...nd, requirements: reqs, tripType, roundTrip, multiCityLegs, foodOptions });
  };

  const handleRoundTripChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...roundTrip, [name]: value };
    setRoundTrip(updated);
    emit({ roundTrip: updated });
  };

  const handleRoundTripCheckbox = (e) => {
    const { name, checked } = e.target;
    const updated = { ...roundTrip, [name]: checked };
    setRoundTrip(updated);
    emit({ roundTrip: updated });
  };

  const handleLegChange = (index, field, value) => {
    let updated = multiCityLegs.map((leg, i) => i === index ? { ...leg, [field]: value } : leg);
    setMultiCityLegs(updated);
    // Clear auto-filled highlight if user manually edits fromCity
    if (field === 'fromCity') {
      setAutoFilledLegs(prev => { const s = new Set(prev); s.delete(index); return s; });
    }
    // Auto-cascade date to next leg if next leg date is empty
    if (field === 'date' && value && index + 1 < updated.length) {
      if (!updated[index + 1].date) {
        updated = updated.map((leg, i) => i === index + 1 ? { ...leg, date: value } : leg);
        setMultiCityLegs(updated);
      }
    }
    emit({ multiCityLegs: updated });
  };

  // Called onBlur of To City — cascade to next leg's From City
  const handleToCityBlur = (index, value) => {
    if (!value.trim() || index + 1 >= multiCityLegs.length) return;
    const updated = multiCityLegs.map((leg, i) =>
      i === index + 1 ? { ...leg, fromCity: value.trim() } : leg
    );
    setMultiCityLegs(updated);
    setAutoFilledLegs(prev => new Set([...prev, index + 1]));
    emit({ multiCityLegs: updated });
  };

  const addLeg = () => {
    const lastLeg = multiCityLegs[multiCityLegs.length - 1];
    const newFromCity = lastLeg?.toCity?.trim() || '';
    const updated = [...multiCityLegs, { ...defaultLeg(), fromCity: newFromCity }];
    setMultiCityLegs(updated);
    // Sync rented vehicle legs
    const updatedVehicleLegs = [...rentedVehicleLegs, { pickupPoint: '', dropOffPoint: '', vehicleType: 'Manual' }];
    setRentedVehicleLegs(updatedVehicleLegs);
    if (newFromCity) setAutoFilledLegs(prev => new Set([...prev, updated.length - 1]));
    emit({ multiCityLegs: updated, rentedVehicleLegs: updatedVehicleLegs });
  };

  const removeLeg = (index) => {
    if (multiCityLegs.length <= 2) return;
    const updated = multiCityLegs.filter((_, i) => i !== index);
    setMultiCityLegs(updated);
    const updatedVehicleLegs = rentedVehicleLegs.filter((_, i) => i !== index);
    setRentedVehicleLegs(updatedVehicleLegs.length ? updatedVehicleLegs : [{ pickupPoint: '', dropOffPoint: '', vehicleType: 'Manual' }]);
    setAutoFilledLegs(prev => {
      const s = new Set();
      prev.forEach(i => { if (i < index) s.add(i); else if (i > index) s.add(i - 1); });
      return s;
    });
    emit({ multiCityLegs: updated });
  };

  const handleFoodChange = (e) => {
    const { name, checked } = e.target;
    const updated = { ...foodOptions, [name]: checked };
    setFoodOptions(updated);
    emit({ foodOptions: updated });
  };

  const handleTripTypeChange = (e) => {
    const val = e.target.value;
    setTripType(val);
    emit({ tripType: val });
  };

  return (
    <>
    <Snackbar
      open={passportSnackbar.open}
      autoHideDuration={3000}
      onClose={() => setPassportSnackbar(s => ({ ...s, open: false }))}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={() => setPassportSnackbar(s => ({ ...s, open: false }))}
        severity={passportSnackbar.type}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {passportSnackbar.type === 'success' ? 'Passport details updated successfully.' : 'Failed to update passport details.'}
      </Alert>
    </Snackbar>
    <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, borderColor: 'primary.main', borderWidth: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: 'primary.main' }}>
          TRAVEL POLICY – {travelType === 'international' ? 'INTERNATIONAL TRAVEL – AST07' : 'DOMESTIC TRAVEL – AST06'}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <ToggleButtonGroup value={travelType} exclusive onChange={handleTravelTypeChange} aria-label="travel type"
            sx={{ '& .MuiToggleButton-root': { px: 3, py: 1.5, textTransform: 'none', fontWeight: 600 } }}>
            <ToggleButton value="international"><FlightTakeoffIcon sx={{ mr: 1 }} />International Travel</ToggleButton>
            <ToggleButton value="domestic"><DirectionsCarIcon sx={{ mr: 1 }} />Domestic Travel</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          {/* Employee Info */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Employee Information</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Name of the Employee" name="employeeName" value={travelData.employeeName}
              onChange={handleFieldChange} size="small" disabled helperText="Auto-filled from your profile" />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Department" name="department" value={travelData.department}
              onChange={handleFieldChange} size="small" disabled helperText="Auto-filled from your profile" />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Company" name="company" value={travelData.company}
              onChange={handleFieldChange} size="small" disabled helperText="Auto-filled from your profile" />
          </Grid>

          {travelType === 'international' ? (
            <>
              {/* Travel Info */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>Travel Information</Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" required>
                  <InputLabel shrink>Country of Travel *</InputLabel>
                  <Select
                    name="countryOfTravel"
                    value={travelData.countryOfTravel}
                    onChange={handleFieldChange}
                    label="Country of Travel *"
                    displayEmpty
                    renderValue={(val) =>
                      locationsLoading
                        ? 'Loading locations...'
                        : val || <em style={{ color: '#aaa' }}>Select location</em>
                    }
                  >
                    <MenuItem value=""><em style={{ color: '#aaa' }}>Select location</em></MenuItem>
                    {locations.map(loc => (
                      <MenuItem key={loc.id} value={loc.name}>{loc.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Trip Type */}
              <Grid item xs={12}>
                <FormControl>
                  <FormLabel sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>Trip Type *</FormLabel>
                  <RadioGroup row value={tripType} onChange={handleTripTypeChange}>
                    <FormControlLabel value="roundTrip" control={<Radio />} label="Round Trip" />
                    <FormControlLabel value="multiCity" control={<Radio />} label="Multi-City" />
                    <FormControlLabel value="oneWay" control={<Radio />} label="One-Way" />
                  </RadioGroup>
                </FormControl>
              </Grid>

              {/* Round Trip */}
              {tripType === 'roundTrip' && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'primary.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'primary.main' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>Round Trip Details</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={3}>
                        <TextField fullWidth label="From City *" name="fromCity" value={roundTrip.fromCity}
                          onChange={handleRoundTripChange} size="small" required />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField fullWidth label="To City *" name="toCity" value={roundTrip.toCity}
                          onChange={handleRoundTripChange} size="small" required />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField fullWidth label="Departure Date" name="departureDate" type="date"
                          value={roundTrip.departureDate} onChange={handleRoundTripChange}
                          slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField fullWidth label="Arrival Date" name="arrivalDate" type="date"
                          value={roundTrip.arrivalDate} onChange={handleRoundTripChange}
                          slotProps={{ inputLabel: { shrink: true } }}
                          inputProps={{ min: roundTrip.departureDate || today }}
                          size="small"
                          error={!!(roundTrip.arrivalDate && roundTrip.departureDate && roundTrip.arrivalDate < roundTrip.departureDate)}
                          helperText={roundTrip.arrivalDate && roundTrip.departureDate && roundTrip.arrivalDate < roundTrip.departureDate ? 'Arrival date cannot be before departure date' : ''} />
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Flexible date?</Typography>
                          <RadioGroup row value={rtArrivalFlex ? 'yes' : 'no'} onChange={(e) => {
                            const isFlex = e.target.value === 'yes';
                            setRtArrivalFlex(isFlex);
                            const u = isFlex
                              ? { ...roundTrip, arrivalDate: '' }
                              : { ...roundTrip, arrivalDateFlexFrom: '', arrivalDateFlexTo: '' };
                            setRoundTrip(u); emit({ roundTrip: u });
                          }} sx={{ ml: 0.5 }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label={<Typography variant="caption">Yes</Typography>} />
                            <FormControlLabel value="no" control={<Radio size="small" />} label={<Typography variant="caption">No</Typography>} />
                          </RadioGroup>
                          {rtArrivalFlex && (
                            <Grid container spacing={1} sx={{ mt: 0.5 }}>
                              <Grid item xs={6}>
                                <TextField fullWidth label="From" name="arrivalDateFlexFrom" type="date"
                                  value={roundTrip.arrivalDateFlexFrom || ''} onChange={handleRoundTripChange}
                                  slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: roundTrip.departureDate || today }} size="small" />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField fullWidth label="To" name="arrivalDateFlexTo" type="date"
                                  value={roundTrip.arrivalDateFlexTo || ''} onChange={handleRoundTripChange}
                                  slotProps={{ inputLabel: { shrink: true } }}
                                  inputProps={{ min: roundTrip.arrivalDateFlexFrom || roundTrip.departureDate || today }}
                                  size="small"
                                  error={!!(roundTrip.arrivalDateFlexTo && roundTrip.arrivalDateFlexFrom && roundTrip.arrivalDateFlexTo < roundTrip.arrivalDateFlexFrom)}
                                  helperText={roundTrip.arrivalDateFlexTo && roundTrip.arrivalDateFlexFrom && roundTrip.arrivalDateFlexTo < roundTrip.arrivalDateFlexFrom ? 'End date cannot be before start date' : ''} />
                              </Grid>
                            </Grid>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 1.5 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            name="needsHotel"
                            checked={roundTrip.needsHotel || false}
                            onChange={handleRoundTripCheckbox}
                          />
                        }
                        label={<Typography variant="caption" fontWeight={500}>Hotel / Accommodation needed at {roundTrip.toCity || 'destination'}</Typography>}
                      />
                      {roundTrip.needsHotel && (
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                          <Grid item xs={12} md={4}>
                            <TextField fullWidth label="Check-in" type="date" name="hotelFrom"
                              value={roundTrip.hotelFrom || ''}
                              onChange={handleRoundTripChange}
                              slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField fullWidth label="Check-out" type="date" name="hotelTo"
                              value={roundTrip.hotelTo || ''}
                              onChange={handleRoundTripChange}
                              slotProps={{ inputLabel: { shrink: true } }}
                              inputProps={{ min: roundTrip.hotelFrom || today }}
                              size="small"
                              error={!!(roundTrip.hotelTo && roundTrip.hotelFrom && roundTrip.hotelTo < roundTrip.hotelFrom)}
                              helperText={roundTrip.hotelTo && roundTrip.hotelFrom && roundTrip.hotelTo < roundTrip.hotelFrom ? 'Check-out cannot be before check-in' : ''} />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField fullWidth label="No. of Nights" type="number" name="hotelDays"
                              value={calcNights(roundTrip.hotelFrom, roundTrip.hotelTo)}
                              InputProps={{ readOnly: true }}
                              size="small" placeholder="Auto-calculated" />
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  </Box>
                </Grid>
              )}

              {/* One-Way */}
              {tripType === 'oneWay' && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'primary.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'primary.main' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>One-Way Details</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="From City *" name="fromCity" value={roundTrip.fromCity}
                          onChange={handleRoundTripChange} size="small" required />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="To City *" name="toCity" value={roundTrip.toCity}
                          onChange={handleRoundTripChange} size="small" required />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="Departure Date" name="departureDate" type="date"
                          value={roundTrip.departureDate} onChange={handleRoundTripChange}
                          slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Flexible date?</Typography>
                          <RadioGroup row value={rtDepartureFlex ? 'yes' : 'no'} onChange={(e) => {
                            const isFlex = e.target.value === 'yes';
                            setRtDepartureFlex(isFlex);
                            const u = isFlex
                              ? { ...roundTrip, departureDate: '' }
                              : { ...roundTrip, departureDateFlexFrom: '', departureDateFlexTo: '' };
                            setRoundTrip(u); emit({ roundTrip: u });
                          }} sx={{ ml: 0.5 }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label={<Typography variant="caption">Yes</Typography>} />
                            <FormControlLabel value="no" control={<Radio size="small" />} label={<Typography variant="caption">No</Typography>} />
                          </RadioGroup>
                          {rtDepartureFlex && (
                            <Grid container spacing={1} sx={{ mt: 0.5 }}>
                              <Grid item xs={6}>
                                <TextField fullWidth label="From" name="departureDateFlexFrom" type="date"
                                  value={roundTrip.departureDateFlexFrom || ''} onChange={handleRoundTripChange}
                                  slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField fullWidth label="To" name="departureDateFlexTo" type="date"
                                  value={roundTrip.departureDateFlexTo || ''} onChange={handleRoundTripChange}
                                  slotProps={{ inputLabel: { shrink: true } }}
                                  inputProps={{ min: roundTrip.departureDateFlexFrom || today }}
                                  size="small"
                                  error={!!(roundTrip.departureDateFlexTo && roundTrip.departureDateFlexFrom && roundTrip.departureDateFlexTo < roundTrip.departureDateFlexFrom)}
                                  helperText={roundTrip.departureDateFlexTo && roundTrip.departureDateFlexFrom && roundTrip.departureDateFlexTo < roundTrip.departureDateFlexFrom ? 'End date cannot be before start date' : ''} />
                              </Grid>
                            </Grid>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 1.5 }}>
                      <FormControlLabel
                        control={
                          <Checkbox size="small" name="needsHotel"
                            checked={roundTrip.needsHotel || false}
                            onChange={handleRoundTripCheckbox} />
                        }
                        label={<Typography variant="caption" fontWeight={500}>Hotel / Accommodation needed at {roundTrip.toCity || 'destination'}</Typography>}
                      />
                      {roundTrip.needsHotel && (
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                          <Grid item xs={12} md={4}>
                            <TextField fullWidth label="Check-in" type="date" name="hotelFrom"
                              value={roundTrip.hotelFrom || ''} onChange={handleRoundTripChange}
                              slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField fullWidth label="Check-out" type="date" name="hotelTo"
                              value={roundTrip.hotelTo || ''} onChange={handleRoundTripChange}
                              slotProps={{ inputLabel: { shrink: true } }}
                              inputProps={{ min: roundTrip.hotelFrom || today }}
                              size="small"
                              error={!!(roundTrip.hotelTo && roundTrip.hotelFrom && roundTrip.hotelTo < roundTrip.hotelFrom)}
                              helperText={roundTrip.hotelTo && roundTrip.hotelFrom && roundTrip.hotelTo < roundTrip.hotelFrom ? 'Check-out cannot be before check-in' : ''} />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField fullWidth label="No. of Nights" type="number" name="hotelDays"
                              value={calcNights(roundTrip.hotelFrom, roundTrip.hotelTo)}
                              InputProps={{ readOnly: true }} size="small" placeholder="Auto-calculated" />
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  </Box>
                </Grid>
              )}

              {/* Multi-City */}
              {tripType === 'multiCity' && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'primary.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'primary.main' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>Multi-City Details</Typography>
                    {multiCityLegs.map((leg, index) => (
                      <Box key={index} sx={{ mb: index < multiCityLegs.length - 1 ? 2 : 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary">Leg {index + 1}</Typography>
                          {multiCityLegs.length > 2 && (
                            <IconButton size="small" onClick={() => removeLeg(index)} sx={{ ml: 1 }} color="error">
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              label="From City"
                              value={leg.fromCity}
                              onChange={(e) => handleLegChange(index, 'fromCity', e.target.value)}
                              size="small"
                              sx={autoFilledLegs.has(index) ? {
                                '& .MuiOutlinedInput-root': {
                                  bgcolor: 'primary.50',
                                  '& fieldset': { borderColor: 'primary.main', borderWidth: 2 },
                                }
                              } : {}}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              label="To City"
                              value={leg.toCity}
                              onChange={(e) => handleLegChange(index, 'toCity', e.target.value)}
                              onBlur={(e) => handleToCityBlur(index, e.target.value)}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField fullWidth label="Date" type="date" value={leg.date}
                              onChange={(e) => handleLegChange(index, 'date', e.target.value)}
                              slotProps={{ inputLabel: { shrink: true } }}
                              inputProps={{ min: index > 0 && multiCityLegs[index-1]?.date ? multiCityLegs[index-1].date : today }}
                              size="small"
                              error={!!(index > 0 && leg.date && multiCityLegs[index-1]?.date && leg.date < multiCityLegs[index-1].date)}
                              helperText={index > 0 && leg.date && multiCityLegs[index-1]?.date && leg.date < multiCityLegs[index-1].date ? `Cannot be before Leg ${index} date` : ''} />
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">Flexible date?</Typography>
                              <RadioGroup row value={leg.dateFlex ? 'yes' : 'no'} onChange={(e) => {
                                const isFlex = e.target.value === 'yes';
                                if (isFlex) {
                                  handleLegChange(index, 'date', '');
                                  handleLegChange(index, 'dateFlex', true);
                                } else {
                                  handleLegChange(index, 'dateFlexFrom', '');
                                  handleLegChange(index, 'dateFlexTo', '');
                                  handleLegChange(index, 'dateFlex', false);
                                }
                              }} sx={{ ml: 0.5 }}>
                                <FormControlLabel value="yes" control={<Radio size="small" />} label={<Typography variant="caption">Yes</Typography>} />
                                <FormControlLabel value="no" control={<Radio size="small" />} label={<Typography variant="caption">No</Typography>} />
                              </RadioGroup>
                              {leg.dateFlex && (
                                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                                  <Grid item xs={6}>
                                    <TextField fullWidth label="From" type="date" value={leg.dateFlexFrom || ''}
                                      onChange={(e) => handleLegChange(index, 'dateFlexFrom', e.target.value)}
                                      slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                                  </Grid>
                                  <Grid item xs={6}>
                                    <TextField fullWidth label="To" type="date" value={leg.dateFlexTo || ''}
                                      onChange={(e) => handleLegChange(index, 'dateFlexTo', e.target.value)}
                                      slotProps={{ inputLabel: { shrink: true } }}
                                      inputProps={{ min: leg.dateFlexFrom || today }}
                                      size="small"
                                      error={!!(leg.dateFlexTo && leg.dateFlexFrom && leg.dateFlexTo < leg.dateFlexFrom)}
                                      helperText={leg.dateFlexTo && leg.dateFlexFrom && leg.dateFlexTo < leg.dateFlexFrom ? 'End date cannot be before start date' : ''} />
                                  </Grid>
                                </Grid>
                              )}
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Per-leg hotel toggle */}
                        <Box sx={{ mt: 1.5 }}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={leg.needsHotel || false}
                                onChange={(e) => handleLegChange(index, 'needsHotel', e.target.checked)}
                              />
                            }
                            label={<Typography variant="caption" fontWeight={500}>Hotel / Accommodation needed at {leg.toCity || 'destination'}</Typography>}
                          />
                          {leg.needsHotel && (
                            <Grid container spacing={2} sx={{ mt: 0.5 }}>
                              <Grid item xs={12} md={4}>
                                <TextField fullWidth label="Check-in" type="date" value={leg.hotelFrom || ''}
                                  onChange={(e) => handleLegChange(index, 'hotelFrom', e.target.value)}
                                  slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <TextField fullWidth label="Check-out" type="date" value={leg.hotelTo || ''}
                                  onChange={(e) => handleLegChange(index, 'hotelTo', e.target.value)}
                                  slotProps={{ inputLabel: { shrink: true } }}
                                  inputProps={{ min: leg.hotelFrom || today }}
                                  size="small"
                                  error={!!(leg.hotelTo && leg.hotelFrom && leg.hotelTo < leg.hotelFrom)}
                                  helperText={leg.hotelTo && leg.hotelFrom && leg.hotelTo < leg.hotelFrom ? 'Check-out cannot be before check-in' : ''} />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <TextField fullWidth label="No. of Nights" type="number" value={calcNights(leg.hotelFrom, leg.hotelTo)}
                                  InputProps={{ readOnly: true }}
                                  size="small" placeholder="Auto-calculated" />
                              </Grid>
                            </Grid>
                          )}
                        </Box>

                        {index < multiCityLegs.length - 1 && <Divider sx={{ mt: 2 }} />}
                      </Box>
                    ))}
                    <Button startIcon={<AddIcon />} size="small" onClick={addLeg} variant="outlined" sx={{ mt: 2 }}>
                      Add Leg
                    </Button>
                  </Box>
                </Grid>
              )}

              {/* Travel Requirements */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Travel Requirements</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>Select all that apply</Typography>
                <FormGroup row>
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.flights} onChange={handleIntlReqChange} name="flights" />} label="1. Flights" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.visa} onChange={handleIntlReqChange} name="visa" />} label="2. Visa" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.rentedVehicle} onChange={handleIntlReqChange} name="rentedVehicle" />} label="3. Rented Vehicle" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.carPark} onChange={handleIntlReqChange} name="carPark" />} label="4. Airport Car Park" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.food} onChange={handleIntlReqChange} name="food" />} label="5. Food Preferance" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.baggage} onChange={handleIntlReqChange} name="baggage" />} label="6. Baggage Requirements" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.accompanying} onChange={handleIntlReqChange} name="accompanying" />} label="7. Anyone Accompanying?" />
                </FormGroup>
              </Grid>

              {/* All requirement detail sections — single xs={12} item forces full-width stacking */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {internationalRequirements.flights && (
                    <Box sx={{ bgcolor: 'primary.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'primary.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>1. Flights</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField fullWidth label="a. Preferred Departure Airport" name="preferredDepartureAirport"
                            value={travelData.preferredDepartureAirport} onChange={handleFieldChange} size="small" placeholder="e.g., LHR" />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {internationalRequirements.visa && (
                    <Box sx={{ bgcolor: 'success.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>2. Visa</Typography>
                      <Box sx={{ mb: visaRequired === 'yes' ? 2 : 0 }}>
                        <FormControl>
                          <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Visa required?</FormLabel>
                          <RadioGroup row value={visaRequired} onChange={(e) => {
                            const val = e.target.value;
                            setVisaRequired(val);
                            if (val === 'yes') fetchPassportInfo();
                            emit();
                          }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                          </RadioGroup>
                        </FormControl>
                      </Box>
                      {visaRequired === 'yes' && (
                        <Grid container spacing={2}>
                          {[
                            { label: 'a. Name as per Passport', field: 'passport_name',       type: 'text' },
                            { label: 'b. Passport Number',      field: 'passport_number',     type: 'text' },
                            { label: 'c. Nationality',          field: 'nationality',          type: 'text' },
                            { label: 'd. Passport Issue Date',  field: 'passport_issue_date', type: 'date' },
                            { label: 'e. Passport Expiry',      field: 'passport_expiry',     type: 'date' },
                          ].map(({ label, field, type }) => (
                            <Grid item xs={12} md={4} key={field}>
                              <TextField fullWidth label={label}
                                value={passportLoading ? '' : (passportInfo[field] || '')}
                                type={type}
                                onChange={(e) => { setPassportInfo(p => ({ ...p, [field]: e.target.value })); setPassportDirty(true); }}
                                size="small"
                                disabled={passportLoading}
                                slotProps={type === 'date' ? { inputLabel: { shrink: true } } : undefined}
                                helperText="Auto-filled from your profile" />
                            </Grid>
                          ))}
                          <Grid item xs={12} md={4}>
                            <TextField fullWidth label="f. Visa Type" name="visaType"
                              value={travelData.visaType} onChange={handleFieldChange}
                              size="small" placeholder="e.g. Business, Tourist, Student" />
                          </Grid>
                          {passportDirty && (
                            <Grid item xs={12}>
                              <Button
                                variant="contained"
                                size="small"
                                disabled={passportSaving}
                                onClick={() => {
                                  setPassportSaving(true);
                                  axiosClient.put('/users/passport-info', passportInfo)
                                    .then(() => { setPassportSnackbar({ open: true, type: 'success' }); setPassportDirty(false); })
                                    .catch(() => setPassportSnackbar({ open: true, type: 'error' }))
                                    .finally(() => setPassportSaving(false));
                                }}
                              >
                                {passportSaving ? 'Saving...' : 'Update Passport Details'}
                              </Button>
                            </Grid>
                          )}
                        </Grid>
                      )}
                    </Box>
                  )}

                  {internationalRequirements.rentedVehicle && (
                    <Box sx={{ bgcolor: 'warning.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>3. Rented Vehicle</Typography>
                      <FormControl sx={{ mb: 1.5 }}>
                        <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Rented vehicle required?</FormLabel>
                        <RadioGroup row value={rentedVehicleRequired} onChange={(e) => { setRentedVehicleRequired(e.target.value); emit({ rentedVehicleRequired: e.target.value }); }}>
                          <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                          <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                        </RadioGroup>
                      </FormControl>
                      {rentedVehicleRequired === 'yes' && (
                        <>
                          {(tripType === 'multiCity' ? multiCityLegs : multiCityLegs.slice(0, 1)).map((cityLeg, idx) => {
                            const vLeg = rentedVehicleLegs[idx] || { pickupPoint: '', dropOffPoint: '', vehicleType: 'Manual' };
                            return (
                              <Box key={idx} sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                {tripType === 'multiCity' && (
                                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                    Leg {idx + 1}: {cityLeg.fromCity || '?'} → {cityLeg.toCity || '?'}
                                  </Typography>
                                )}
                                <Grid container spacing={2}>
                                  <Grid item xs={12} md={4}>
                                    <TextField fullWidth label="Pick-up Point" size="small" value={vLeg.pickupPoint}
                                      onChange={(e) => { const u = rentedVehicleLegs.map((l,i) => i===idx ? {...l, pickupPoint: e.target.value} : l); while(u.length <= idx) u.push({ pickupPoint:'', dropOffPoint:'', vehicleType:'Manual' }); setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}
                                      placeholder="e.g., Airport, City Centre" />
                                  </Grid>
                                  <Grid item xs={12} md={4}>
                                    <TextField fullWidth label="Drop-off Point" size="small" value={vLeg.dropOffPoint}
                                      onChange={(e) => { const u = rentedVehicleLegs.map((l,i) => i===idx ? {...l, dropOffPoint: e.target.value} : l); while(u.length <= idx) u.push({ pickupPoint:'', dropOffPoint:'', vehicleType:'Manual' }); setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}
                                      placeholder="e.g., Hotel, Airport" />
                                  </Grid>
                                  <Grid item xs={12} md={4}>
                                    <TextField fullWidth select label="Manual/Automatic" size="small" value={vLeg.vehicleType || 'Manual'}
                                      onChange={(e) => { const u = rentedVehicleLegs.map((l,i) => i===idx ? {...l, vehicleType: e.target.value} : l); while(u.length <= idx) u.push({ pickupPoint:'', dropOffPoint:'', vehicleType:'Manual' }); setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}>
                                      <MenuItem value="Manual">Manual</MenuItem>
                                      <MenuItem value="Automatic">Automatic</MenuItem>
                                    </TextField>
                                  </Grid>
                                </Grid>
                              </Box>
                            );
                          })}
                        </>
                      )}
                    </Box>
                  )}

                  {internationalRequirements.carPark && (
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'grey.400' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>4. Airport Car Park</Typography>
                      <Box sx={{ mb: carParkRequired === 'yes' ? 2 : 0 }}>
                        <FormControl>
                          <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Car park required?</FormLabel>
                          <RadioGroup row value={carParkRequired} onChange={(e) => { setCarParkRequired(e.target.value); emit(); }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                          </RadioGroup>
                        </FormControl>
                      </Box>
                      {carParkRequired === 'yes' && (
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Vehicle Number *" value={carParkVehicleNumber}
                              onChange={(e) => { setCarParkVehicleNumber(e.target.value); emit(); }}
                              size="small" required placeholder="e.g. AB12 CDE"
                              error={!carParkVehicleNumber.trim()}
                              helperText={!carParkVehicleNumber.trim() ? 'Vehicle number is required' : ''} />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Car Color *" value={carParkCarColor}
                              onChange={(e) => { setCarParkCarColor(e.target.value); emit(); }}
                              size="small" required placeholder="e.g. Silver"
                              error={!carParkCarColor.trim()}
                              helperText={!carParkCarColor.trim() ? 'Car color is required' : ''} />
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  )}

                  {internationalRequirements.food && (
                    <Box sx={{ bgcolor: 'secondary.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'secondary.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>5. Food</Typography>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={8}>
                          <FormGroup row>
                            <FormControlLabel control={<Checkbox checked={foodOptions.breakfastIncl} onChange={handleFoodChange} name="breakfastIncl" size="small" />} label="Breakfast Incl." />
                            <FormControlLabel control={<Checkbox checked={foodOptions.veg} onChange={handleFoodChange} name="veg" size="small" />} label="Veg" />
                            <FormControlLabel control={<Checkbox checked={foodOptions.vegan} onChange={handleFoodChange} name="vegan" size="small" />} label="Vegan" />
                            <FormControlLabel control={<Checkbox checked={foodOptions.nonVegan} onChange={handleFoodChange} name="nonVegan" size="small" />} label="Non-Vegan" />
                          </FormGroup>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="Number of Days" name="foodNumberOfDays" type="number"
                            value={travelData.foodNumberOfDays || ''} onChange={handleFieldChange}
                            size="small" slotProps={{ htmlInput: { min: 1 } }} />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {internationalRequirements.baggage && (
                    <Box sx={{ bgcolor: 'warning.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>6. Baggage</Typography>
                      <Box sx={{ mb: baggageRequired === 'yes' ? 2 : 0 }}>
                        <FormControl>
                          <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Baggage required?</FormLabel>
                          <RadioGroup row value={baggageRequired} onChange={(e) => { setBaggageRequired(e.target.value); emit(); }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                          </RadioGroup>
                        </FormControl>
                      </Box>
                      {baggageRequired === 'yes' && (
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} md={4}>
                            <FormControlLabel
                              control={<Checkbox size="small" checked={travelData.baggageCabinBag || false}
                                onChange={(e) => handleFieldChange({ target: { name: 'baggageCabinBag', value: e.target.checked } })} />}
                              label="a. Cabin Bag" />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel shrink>b. No. of Check-in Bags</InputLabel>
                              <Select label="b. No. of Check-in Bags" name="baggageCheckIn"
                                displayEmpty
                                value={travelData.baggageCheckIn || ''} onChange={handleFieldChange}>
                                <MenuItem value=""><em style={{ color: '#aaa' }}>Select no.</em></MenuItem>
                                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                  <MenuItem key={n} value={n}>{n}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  )}

                  {internationalRequirements.accompanying && (
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'grey.400' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>7. Anyone Accompanying?</Typography>
                      <Box sx={{ mb: accompanying === 'yes' ? 2 : 0 }}>
                        <FormControl>
                          <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Is anyone accompanying?</FormLabel>
                          <RadioGroup row value={accompanying} onChange={(e) => {
                            setAccompanying(e.target.value);
                            if (e.target.value === 'no') { setAccompanyingNames(''); emit({ accompanying: 'no', accompanyingNames: '' }); }
                            else emit({ accompanying: 'yes', accompanyingNames });
                          }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                          </RadioGroup>
                        </FormControl>
                      </Box>
                      {accompanying === 'yes' && (
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <TextField fullWidth label="Name(s)" value={accompanyingNames}
                              onChange={(e) => { setAccompanyingNames(e.target.value); emit({ accompanying, accompanyingNames: e.target.value }); }}
                              size="small" placeholder="e.g. John Smith, Jane Doe" />
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  )}
                </Box>
              </Grid>
            </>
          ) : (
            <>
              {/* Domestic Travel Info */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>Travel Information</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Date of Travel" name="dateOfTravel" type="date" value={travelData.dateOfTravel}
                  onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                <Box sx={{ mt: 1 }}>
                  <FormControl>
                    <FormLabel sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 0.5 }}>Flexible date?</FormLabel>
                    <RadioGroup row value={domesticDateFlex ? 'yes' : 'no'}
                      onChange={(e) => {
                        const isYes = e.target.value === 'yes';
                        setDomesticDateFlex(isYes);
                        if (isYes) {
                          setTravelData(prev => ({ ...prev, dateOfTravel: '' }));
                          emit({ dateOfTravel: '', domesticDateFlex: true, domesticDateFlexFrom, domesticDateFlexTo });
                        } else {
                          setDomesticDateFlexFrom('');
                          setDomesticDateFlexTo('');
                          emit({ domesticDateFlex: false, domesticDateFlexFrom: '', domesticDateFlexTo: '' });
                        }
                      }}>
                      <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                      <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                    </RadioGroup>
                  </FormControl>
                  {domesticDateFlex && (
                    <Grid container spacing={1} sx={{ mt: 0.5 }}>
                      <Grid item xs={6}>
                        <TextField fullWidth label="From" type="date"
                          value={domesticDateFlexFrom}
                          onChange={(e) => { setDomesticDateFlexFrom(e.target.value); emit({ domesticDateFlex: true, domesticDateFlexFrom: e.target.value, domesticDateFlexTo }); }}
                          slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField fullWidth label="To" type="date"
                          value={domesticDateFlexTo}
                          onChange={(e) => { setDomesticDateFlexTo(e.target.value); emit({ domesticDateFlex: true, domesticDateFlexFrom, domesticDateFlexTo: e.target.value }); }}
                          slotProps={{ inputLabel: { shrink: true } }}
                          inputProps={{ min: domesticDateFlexFrom || today }}
                          size="small"
                          error={!!(domesticDateFlexTo && domesticDateFlexFrom && domesticDateFlexTo < domesticDateFlexFrom)}
                          helperText={domesticDateFlexTo && domesticDateFlexFrom && domesticDateFlexTo < domesticDateFlexFrom ? 'End date cannot be before start date' : ''} />
                      </Grid>
                    </Grid>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="City of Travel *" name="cityOfTravelDomestic" value={travelData.cityOfTravelDomestic}
                  onChange={handleFieldChange} size="small" required />
              </Grid>
              <Grid item xs={12}>
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth label="Departure Postcode *" name="departurePostcode" value={travelData.departurePostcode}
                        onChange={handleFieldChange} size="small" required />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth label="Destination Postcode *" name="destinationPostcode" value={travelData.destinationPostcode}
                        onChange={handleFieldChange} size="small" required />
                    </Grid>
                  </Grid>
                  {/* Hotel / Accommodation for Domestic */}
                  <Box sx={{ mt: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={domesticHotel.needsHotel}
                          onChange={(e) => {
                            const updated = { ...domesticHotel, needsHotel: e.target.checked };
                            setDomesticHotel(updated);
                            emit({ domesticHotel: updated });
                          }}
                        />
                      }
                      label={<Typography variant="caption" fontWeight={500}>Hotel / Accommodation needed at {travelData.cityOfTravelDomestic || 'destination'}</Typography>}
                    />
                    {domesticHotel.needsHotel && (
                      <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="Check-in" type="date"
                            value={domesticHotel.hotelFrom}
                            onChange={(e) => { const updated = { ...domesticHotel, hotelFrom: e.target.value }; setDomesticHotel(updated); emit({ domesticHotel: updated }); }}
                            slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="Check-out" type="date"
                            value={domesticHotel.hotelTo}
                            onChange={(e) => { const updated = { ...domesticHotel, hotelTo: e.target.value }; setDomesticHotel(updated); emit({ domesticHotel: updated }); }}
                            slotProps={{ inputLabel: { shrink: true } }}
                            inputProps={{ min: domesticHotel.hotelFrom || today }}
                            size="small"
                            error={!!(domesticHotel.hotelTo && domesticHotel.hotelFrom && domesticHotel.hotelTo < domesticHotel.hotelFrom)}
                            helperText={domesticHotel.hotelTo && domesticHotel.hotelFrom && domesticHotel.hotelTo < domesticHotel.hotelFrom ? 'Check-out cannot be before check-in' : ''} />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="No. of Nights" type="number"
                            value={calcNights(domesticHotel.hotelFrom, domesticHotel.hotelTo)}
                            InputProps={{ readOnly: true }}
                            size="small" placeholder="Auto-calculated" />
                        </Grid>
                      </Grid>
                    )}
                  </Box>
                </Box>
              </Grid>

              {/* Domestic Requirements Checkboxes */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Travel Requirements</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>Select all that apply</Typography>
                <FormGroup row>
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.flights} onChange={handleDomReqChange} name="flights" />} label="1. Flights" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.rentedVehicle} onChange={handleDomReqChange} name="rentedVehicle" />} label="2. Rented Vehicle" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.carPark} onChange={handleDomReqChange} name="carPark" />} label="3. Airport Car Park" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.food} onChange={handleDomReqChange} name="food" />} label="4. Food Preferance" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.overnightStay} onChange={handleDomReqChange} name="overnightStay" />} label="5. Overnight Stay" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.baggage} onChange={handleDomReqChange} name="baggage" />} label="6. Baggage Requirements" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.accompanying} onChange={handleDomReqChange} name="accompanying" />} label="7. Anyone Accompanying?" />
                </FormGroup>
              </Grid>

              {/* Domestic requirement detail sections — single xs={12} item forces full-width stacking */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {domesticRequirements.flights && (
                    <Box sx={{ bgcolor: 'primary.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'primary.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>1. Flights</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField fullWidth label="a. Preferred Departure Airport" name="preferredDepartureAirport"
                            value={travelData.preferredDepartureAirport} onChange={handleFieldChange} size="small" placeholder="e.g., LHR" />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {domesticRequirements.rentedVehicle && (
                    <Box sx={{ bgcolor: 'warning.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>2. Rented Vehicle</Typography>
                      <FormControl sx={{ mb: 1.5 }}>
                        <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Rented vehicle required?</FormLabel>
                        <RadioGroup row value={rentedVehicleRequired} onChange={(e) => { setRentedVehicleRequired(e.target.value); emit({ rentedVehicleRequired: e.target.value }); }}>
                          <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                          <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                        </RadioGroup>
                      </FormControl>
                      {rentedVehicleRequired === 'yes' && (
                        <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                              <TextField fullWidth label="Pick-up Point" size="small"
                                value={rentedVehicleLegs[0]?.pickupPoint || ''}
                                onChange={(e) => { const u = [{ ...rentedVehicleLegs[0], pickupPoint: e.target.value }]; setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}
                                placeholder="e.g., Airport, City Centre" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField fullWidth label="Drop-off Point" size="small"
                                value={rentedVehicleLegs[0]?.dropOffPoint || ''}
                                onChange={(e) => { const u = [{ ...rentedVehicleLegs[0], dropOffPoint: e.target.value }]; setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}
                                placeholder="e.g., Hotel, Station" />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField fullWidth select label="Manual/Automatic" size="small"
                                value={rentedVehicleLegs[0]?.vehicleType || 'Manual'}
                                onChange={(e) => { const u = [{ ...rentedVehicleLegs[0], vehicleType: e.target.value }]; setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}>
                                <MenuItem value="Manual">Manual</MenuItem>
                                <MenuItem value="Automatic">Automatic</MenuItem>
                              </TextField>
                            </Grid>
                          </Grid>
                        </Box>
                      )}
                    </Box>
                  )}

                  {domesticRequirements.carPark && (
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'grey.400' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>3. Airport Car Park</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', mb: carParkRequired === 'yes' ? 2 : 0 }}>
                        <FormControl>
                          <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Car park required?</FormLabel>
                          <RadioGroup row value={carParkRequired} onChange={(e) => { setCarParkRequired(e.target.value); emit(); }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                          </RadioGroup>
                        </FormControl>
                      </Box>
                      {carParkRequired === 'yes' && (
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Vehicle Number *" value={carParkVehicleNumber}
                              onChange={(e) => { setCarParkVehicleNumber(e.target.value); emit(); }}
                              size="small" required placeholder="e.g. AB12 CDE"
                              error={!carParkVehicleNumber.trim()}
                              helperText={!carParkVehicleNumber.trim() ? 'Vehicle number is required' : ''} />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Car Color *" value={carParkCarColor}
                              onChange={(e) => { setCarParkCarColor(e.target.value); emit(); }}
                              size="small" required placeholder="e.g. Silver"
                              error={!carParkCarColor.trim()}
                              helperText={!carParkCarColor.trim() ? 'Car color is required' : ''} />
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  )}

                  {domesticRequirements.food && (
                    <Box sx={{ bgcolor: 'secondary.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'secondary.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>4. Food</Typography>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={8}>
                          <FormGroup row>
                            <FormControlLabel control={<Checkbox checked={foodOptions.breakfastIncl} onChange={handleFoodChange} name="breakfastIncl" size="small" />} label="Breakfast Incl." />
                            <FormControlLabel control={<Checkbox checked={foodOptions.veg} onChange={handleFoodChange} name="veg" size="small" />} label="Veg" />
                            <FormControlLabel control={<Checkbox checked={foodOptions.vegan} onChange={handleFoodChange} name="vegan" size="small" />} label="Vegan" />
                            <FormControlLabel control={<Checkbox checked={foodOptions.nonVegan} onChange={handleFoodChange} name="nonVegan" size="small" />} label="Non-Vegan" />
                          </FormGroup>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="Number of Days" name="foodNumberOfDays" type="number"
                            value={travelData.foodNumberOfDays || ''} onChange={handleFieldChange}
                            size="small" slotProps={{ htmlInput: { min: 1 } }} />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {domesticRequirements.overnightStay && (
                    <Box sx={{ bgcolor: 'info.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>5. Overnight Stay</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="Place of Stay" name="placeOfStay" value={travelData.placeOfStay}
                            onChange={handleFieldChange} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="From" name="stayFrom" type="date" value={travelData.stayFrom}
                            onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} inputProps={{ min: today }} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="To" name="stayTo" type="date" value={travelData.stayTo}
                            onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }}
                            inputProps={{ min: travelData.stayFrom || today }}
                            size="small"
                            error={!!(travelData.stayTo && travelData.stayFrom && travelData.stayTo < travelData.stayFrom)}
                            helperText={travelData.stayTo && travelData.stayFrom && travelData.stayTo < travelData.stayFrom ? 'End date cannot be before start date' : ''} />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {domesticRequirements.baggage && (
                    <Box sx={{ bgcolor: 'warning.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>6. Baggage</Typography>
                      <Box sx={{ mb: baggageRequired === 'yes' ? 2 : 0 }}>
                        <FormControl>
                          <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Baggage required?</FormLabel>
                          <RadioGroup row value={baggageRequired} onChange={(e) => { setBaggageRequired(e.target.value); emit(); }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                          </RadioGroup>
                        </FormControl>
                      </Box>
                      {baggageRequired === 'yes' && (
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} md={4}>
                            <FormControlLabel
                              control={<Checkbox size="small" checked={travelData.baggageCabinBag || false}
                                onChange={(e) => handleFieldChange({ target: { name: 'baggageCabinBag', value: e.target.checked } })} />}
                              label="a. Cabin Bag" />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel shrink>b. No. of Check-in Bags</InputLabel>
                              <Select label="b. No. of Check-in Bags" name="baggageCheckIn"
                                displayEmpty
                                value={travelData.baggageCheckIn || ''} onChange={handleFieldChange}>
                                <MenuItem value=""><em style={{ color: '#aaa' }}>Select no.</em></MenuItem>
                                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                  <MenuItem key={n} value={n}>{n}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  )}

                  {domesticRequirements.accompanying && (
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'grey.400' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>7. Anyone Accompanying?</Typography>
                      <Box sx={{ mb: accompanying === 'yes' ? 2 : 0 }}>
                        <FormControl>
                          <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Is anyone accompanying?</FormLabel>
                          <RadioGroup row value={accompanying} onChange={(e) => {
                            setAccompanying(e.target.value);
                            if (e.target.value === 'no') { setAccompanyingNames(''); emit({ accompanying: 'no', accompanyingNames: '' }); }
                            else emit({ accompanying: 'yes', accompanyingNames });
                          }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                          </RadioGroup>
                        </FormControl>
                      </Box>
                      {accompanying === 'yes' && (
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <TextField fullWidth label="Name(s)" value={accompanyingNames}
                              onChange={(e) => { setAccompanyingNames(e.target.value); emit({ accompanying, accompanyingNames: e.target.value }); }}
                              size="small" placeholder="e.g. John Smith, Jane Doe" />
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  )}
                </Box>
              </Grid>
            </>
          )}

          {/* Reason of Travel */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Reason of Travel *</Typography>
            <TextField
              fullWidth
              name="reasonOfTravel"
              value={travelData.reasonOfTravel}
              onChange={handleFieldChange}
              multiline
              rows={4}
              size="small"
              required
              placeholder="Please provide a detailed reason for your travel request (minimum 20 words)..."
              error={travelData.reasonOfTravel.trim().length > 0 && travelData.reasonOfTravel.trim().split(/\s+/).filter(Boolean).length < 20}
              helperText={(() => {
                const words = travelData.reasonOfTravel.trim().split(/\s+/).filter(Boolean).length;
                if (!travelData.reasonOfTravel.trim()) return 'Minimum 20 words required';
                if (words < 20) return `${words}/20 words — please add ${20 - words} more word${20 - words === 1 ? '' : 's'}`;
                return `✓ ${words} words`;
              })()}
              FormHelperTextProps={{
                sx: {
                  color: (() => {
                    const words = travelData.reasonOfTravel.trim().split(/\s+/).filter(Boolean).length;
                    if (!travelData.reasonOfTravel.trim()) return 'text.secondary';
                    return words >= 20 ? 'success.main' : 'error.main';
                  })()
                }
              }}
            />
          </Grid>

          {/* Remarks */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Remarks</Typography>
            <TextField fullWidth name="remarks" value={travelData.remarks} onChange={handleFieldChange}
              multiline rows={3} size="small"
              placeholder="Any additional remarks or special requirements..." />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
    </>
  );
};

export default TravelRequestForm;


