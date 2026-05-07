import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Grid,
  Checkbox, FormControlLabel, FormGroup, Divider, MenuItem,
  ToggleButtonGroup, ToggleButton, Radio, RadioGroup,
  FormControl, FormLabel, IconButton, Button, Select, InputLabel,
  Snackbar, Alert
} from '@mui/material';
import axiosClient from '../api/axiosClient';
import useSortedItems from '../hooks/useSortedItems';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const defaultLeg = () => ({ fromCity: '', toCity: '', date: '', dateFlex: false, dateFlexFrom: '', dateFlexTo: '' , needsHotel: false, hotelFrom: '', hotelTo: '', hotelDays: '' });

const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format for min date

// ── Accompanying Persons Picker ───────────────────────────────────────────────
// Renders a list of accompanying persons. Each person can be:
//   - An employee selected from the dropdown (email auto-filled, read-only)
//   - "Other" — free-text name + email inputs
const AccompanyingPersonsPicker = ({ persons, employees, onChange }) => {
  const addPerson = () => onChange([...persons, { employeeId: '', name: '', email: '', isOther: false }]);

  const updatePerson = (idx, patch) => {
    const updated = persons.map((p, i) => i === idx ? { ...p, ...patch } : p);
    onChange(updated);
  };

  const removePerson = (idx) => onChange(persons.filter((_, i) => i !== idx));

  const handleSelect = (idx, value) => {
    if (value === '__other__') {
      updatePerson(idx, { employeeId: '__other__', name: '', email: '', isOther: true });
    } else {
      const emp = employees.find(e => String(e.id) === String(value));
      updatePerson(idx, {
        employeeId: value,
        name: emp ? `${emp.firstName} ${emp.lastName}`.trim() : '',
        email: emp?.email || '',
        isOther: false,
      });
    }
  };

  return (
    <Box>
      {persons.map((person, idx) => (
        <Box key={idx} sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Grid container spacing={1.5} alignItems="flex-start">
            {/* Employee dropdown */}
            <Grid item xs={12} sm={person.isOther ? 12 : 6}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Person</InputLabel>
                <Select
                  value={person.employeeId || ''}
                  label="Select Person"
                  onChange={(e) => handleSelect(idx, e.target.value)}
                >
                  <MenuItem value=""><em>— Select —</em></MenuItem>
                  {employees.map(emp => (
                    <MenuItem key={emp.id} value={String(emp.id)}>
                      {emp.firstName} {emp.lastName}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ({emp.email})
                      </Typography>
                    </MenuItem>
                  ))}
                  <MenuItem value="__other__">
                    <em>Other (enter manually)</em>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Auto-filled email for employee selection */}
            {!person.isOther && person.employeeId && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small"
                  label="Email"
                  value={person.email}
                  InputProps={{ readOnly: true }}
                  sx={{ bgcolor: 'action.hover' }}
                  helperText="Auto-filled from employee profile"
                />
              </Grid>
            )}

            {/* Manual name + email for "Other" */}
            {person.isOther && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small"
                    label="Full Name *"
                    value={person.name}
                    onChange={(e) => updatePerson(idx, { name: e.target.value })}
                    placeholder="e.g. John Smith"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small"
                    label="Email Address"
                    type="email"
                    value={person.email}
                    onChange={(e) => updatePerson(idx, { email: e.target.value })}
                    placeholder="e.g. john@example.com"
                  />
                </Grid>
              </>
            )}

            {/* Remove button */}
            <Grid item xs="auto" sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton size="small" color="error" onClick={() => removePerson(idx)} title="Remove person">
                <RemoveIcon fontSize="small" />
              </IconButton>
            </Grid>
          </Grid>
        </Box>
      ))}

      <Button
        size="small"
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={addPerson}
        sx={{ mt: 0.5 }}
      >
        Add Person
      </Button>

      {persons.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Click "Add Person" to add someone accompanying on this trip.
        </Typography>
      )}
    </Box>
  );
};

const TravelRequestForm = ({ formData, onChange, initialData }) => {
  // Always show the user's own profile company, not the top-level dropdown selection
  const profileCompany = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').company || ''; } catch { return ''; }
  })();

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
  const [carParkVehicleNumber, setCarParkVehicleNumber] = useState((initialData?.carParkVehicleNumber || '').toUpperCase());
  const [carParkCarColor, setCarParkCarColor] = useState(initialData?.carParkCarColor || '');
  const [carParkVehicleMake, setCarParkVehicleMake] = useState(initialData?.carParkVehicleMake || '');
  const [carParkCarModel, setCarParkCarModel] = useState(initialData?.carParkCarModel || '');
  const [rentedVehicleRequired, setRentedVehicleRequired] = useState(initialData?.rentedVehicleRequired || 'no');
  const [rentedVehicleLegs, setRentedVehicleLegs] = useState(
    initialData?.rentedVehicleLegs?.length ? initialData.rentedVehicleLegs : [{ pickupPoint: '', dropOffPoint: '', vehicleType: 'Automatic' }, { pickupPoint: '', dropOffPoint: '', vehicleType: 'Automatic' }]
  );
  const [visaRequired, setVisaRequired] = useState(initialData?.visaRequired || 'no');
  const [baggageRequired, setBaggageRequired] = useState(initialData?.baggageRequired || 'no');
  const [accompanying, setAccompanying] = useState(initialData?.accompanying || 'no');
  const [accompanyingNames, setAccompanyingNames] = useState(initialData?.accompanyingNames || '');
  // New: structured list of accompanying persons
  const [accompanyingPersons, setAccompanyingPersons] = useState(
    initialData?.accompanyingPersons?.length ? initialData.accompanyingPersons : []
  );
  const [allEmployees, setAllEmployees] = useState([]);
  const [domesticHotel, setDomesticHotel] = useState(initialData?.domesticHotel || { needsHotel: false, hotelFrom: '', hotelTo: '', hotelDays: '' });
  const [domesticDateFlex, setDomesticDateFlex] = useState(initialData?.domesticDateFlex || false);
  const [domesticDateFlexFrom, setDomesticDateFlexFrom] = useState(initialData?.domesticDateFlexFrom || '');
  const [domesticDateFlexTo, setDomesticDateFlexTo] = useState(initialData?.domesticDateFlexTo || '');

  const [visaTypes, setVisaTypes] = useState([]);
  const [passportInfo, setPassportInfo] = useState({ passport_number: '', nationality: '', passport_expiry: '', passport_name: '', passport_issue_date: '' });
  const [passportLoading, setPassportLoading] = useState(false);
  const [passportSnackbar, setPassportSnackbar] = useState({ open: false, type: 'success' });
  const [passportDirty, setPassportDirty] = useState(false);
  const [passportSaving, setPassportSaving] = useState(false);

  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const { sorted: sortedLocations, asc: locAsc, toggle: toggleLoc } = useSortedItems(locations);

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

  // Fetch all employees for the accompanying persons dropdown
  useEffect(() => {
    axiosClient.get('/users/managers')
      .then(res => setAllEmployees(res.data || []))
      .catch(() => setAllEmployees([]));
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
  const [rtDepartureFlex, setRtDepartureFlex] = useState(
    !!(initialData?.roundTrip?.departureDateFlexFrom)
  );
  const [rtArrivalFlex, setRtArrivalFlex] = useState(
    !!(initialData?.roundTrip?.arrivalDateFlexFrom)
  );

  const [multiCityLegs, setMultiCityLegs] = useState(
    initialData?.multiCityLegs?.length ? initialData.multiCityLegs : [defaultLeg(), defaultLeg()]
  );
  const [autoFilledLegs, setAutoFilledLegs] = useState(new Set());

  const [foodOptions, setFoodOptions] = useState(initialData?.foodOptions || {
    breakfastIncl: false, veg: false, vegan: false, nonVegan: false
  });

  const [travelData, setTravelData] = useState({
    travelType: initialData?.travelType || 'international',
    tripType: initialData?.tripType || 'roundTrip',
    employeeName: formData.employeeName || '',
    department: formData.department || '',
    company: profileCompany,
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
    vehicleType: initialData?.vehicleType || 'Automatic',
    hotelFrom: initialData?.hotelFrom || '',
    hotelTo: initialData?.hotelTo || '',
    hotelNumberOfDays: initialData?.hotelNumberOfDays || '',
    foodNumberOfDays: initialData?.foodNumberOfDays || '',
    carParkRequired: initialData?.carParkRequired || 'no',
    carParkDuration: initialData?.carParkDuration || '',
    reasonOfTravel: initialData?.reasonOfTravel || '',  // pre-populated in edit mode
    remarks: initialData?.remarks || '',
    baggageCount: initialData?.baggageCount || '',
    baggageNotes: initialData?.baggageNotes || '',
    baggageWeight: initialData?.baggageWeight || '',
    baggageCabinBag: initialData?.baggageCabinBag || false,
    baggageCheckIn: initialData?.baggageCheckIn || false,
    clientName: initialData?.clientName || '',
    clientCompany: initialData?.clientCompany || '',
  });

  useEffect(() => {
    setTravelData(prev => ({
      ...prev,
      employeeName: formData.employeeName || '',
      department: formData.department || '',
      company: profileCompany
    }));
  }, [formData.employeeName, formData.department]);

  const emit = (overrides = {}) => {
    const reqs = travelType === 'international' ? internationalRequirements : domesticRequirements;
    // Use overrides.tripType first, then local tripType state, then travelData.tripType as fallback
    const currentTripType = overrides.tripType ?? tripType;
    onChange({
      ...travelData,
      requirements: reqs, tripType: currentTripType, roundTrip, multiCityLegs, foodOptions,
      carParkRequired, carParkDuration, carParkVehicleNumber, carParkCarColor,
      carParkVehicleMake, carParkCarModel,
      rentedVehicleRequired, rentedVehicleLegs,
      domesticHotel, domesticDateFlex, domesticDateFlexFrom, domesticDateFlexTo,
      accompanying, accompanyingNames, accompanyingPersons,
      ...overrides,
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
      tripType: nd.tripType, roundTrip, multiCityLegs, foodOptions
    });
  };

  const handleIntlReqChange = (e) => {
    const { name, checked } = e.target;
    const nr = { ...internationalRequirements, [name]: checked };
    setInternationalRequirements(nr);
    onChange({ ...travelData, requirements: nr, tripType: travelData.tripType, roundTrip, multiCityLegs, foodOptions });
  };

  const handleDomReqChange = (e) => {
    const { name, checked } = e.target;
    const nr = { ...domesticRequirements, [name]: checked };
    setDomesticRequirements(nr);
    onChange({ ...travelData, requirements: nr, tripType: travelData.tripType, roundTrip, multiCityLegs, foodOptions });
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    const nd = { ...travelData, [name]: value };
    setTravelData(nd);
    const reqs = travelType === 'international' ? internationalRequirements : domesticRequirements;
    onChange({ ...nd, requirements: reqs, tripType: nd.tripType, roundTrip, multiCityLegs, foodOptions });
  };

  const handleRoundTripChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...roundTrip, [name]: value };
    // If hotel is checked and departure/arrival changes, sync hotel dates if still empty
    if (updated.needsHotel) {
      if (name === 'departureDate' && !updated.hotelFrom) updated.hotelFrom = value;
      if (name === 'arrivalDate'   && !updated.hotelTo)   updated.hotelTo   = value;
    }
    setRoundTrip(updated);
    emit({ roundTrip: updated });
  };

  const handleRoundTripCheckbox = (e) => {
    const { name, checked } = e.target;
    let updated = { ...roundTrip, [name]: checked };
    // Auto-fill hotel dates from trip dates when hotel is checked
    if (name === 'needsHotel' && checked) {
      if (!updated.hotelFrom && roundTrip.departureDate) updated.hotelFrom = roundTrip.departureDate;
      if (!updated.hotelTo   && roundTrip.arrivalDate)   updated.hotelTo   = roundTrip.arrivalDate;
    }
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
    const updatedVehicleLegs = [...rentedVehicleLegs, { pickupPoint: '', dropOffPoint: '', vehicleType: 'Automatic' }];
    setRentedVehicleLegs(updatedVehicleLegs);
    if (newFromCity) setAutoFilledLegs(prev => new Set([...prev, updated.length - 1]));
    emit({ multiCityLegs: updated, rentedVehicleLegs: updatedVehicleLegs });
  };

  const removeLeg = (index) => {
    if (multiCityLegs.length <= 2) return;
    const updated = multiCityLegs.filter((_, i) => i !== index);
    setMultiCityLegs(updated);
    const updatedVehicleLegs = rentedVehicleLegs.filter((_, i) => i !== index);
    setRentedVehicleLegs(updatedVehicleLegs.length ? updatedVehicleLegs : [{ pickupPoint: '', dropOffPoint: '', vehicleType: 'Automatic' }]);
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
    // Keep travelData.tripType in sync — this is what all onChange calls read
    setTravelData(prev => ({ ...prev, tripType: val }));
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
    <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <FlightTakeoffIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Travel Details — {travelType === 'international' ? 'International Travel' : 'Domestic Travel'}
          </Typography>
        </Box>

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
            <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Employee Information</Typography>
            <Divider sx={{ mt: 0.5 }} />
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
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mt: 2, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Travel Information</Typography>
                <Divider sx={{ mt: 0.5 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Client Name"
                  name="clientName" value={travelData.clientName || ''}
                  onChange={handleFieldChange} placeholder="e.g. Acorn Universal" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Client Company"
                  name="clientCompany" value={travelData.clientCompany || ''}
                  onChange={handleFieldChange} placeholder="e.g. Acorn Ltd" />
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
                    <MenuItem onClickCapture={(e) => { e.stopPropagation(); toggleLoc(); }} sx={{ color: 'text.secondary', fontSize: '0.75rem', py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }} disableRipple>
                      {locAsc ? '↑ A → Z' : '↓ Z → A'} &nbsp;<span style={{ opacity: 0.5 }}>click to reverse</span>
                    </MenuItem>
                    {sortedLocations.map(loc => (
                      <MenuItem key={loc.id} value={loc.name}>{loc.name}</MenuItem>
                    ))}
                    <MenuItem value="Other">Travel Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {travelData.countryOfTravel === 'Other' && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="City *"
                      name="otherCity" value={travelData.otherCity || ''}
                      onChange={handleFieldChange} placeholder="e.g. Zurich" required />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Country *"
                      name="otherCountry" value={travelData.otherCountry || ''}
                      onChange={handleFieldChange} placeholder="e.g. Switzerland" required />
                  </Grid>
                </>
              )}

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
                      <Grid item xs={12} md={6}>
                        {/* Departure → Arrival date range grouped together */}
                        <Box sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}>
                          {/* Header bar */}
                          <Box sx={{
                            px: 1.5, py: 0.75,
                            bgcolor: 'primary.main',
                            display: 'flex', alignItems: 'center', gap: 1,
                          }}>
                            <FlightTakeoffIcon sx={{ color: '#fff', fontSize: 14 }} />
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#fff', letterSpacing: 0.4 }}>
                              Travel Dates
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                            {/* Departure */}
                            <Box sx={{ flex: 1, p: 1.5, borderRight: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                                Departure
                              </Typography>
                              <TextField
                                fullWidth
                                name="departureDate"
                                type="date"
                                value={roundTrip.departureDate}
                                onChange={handleRoundTripChange}
                                slotProps={{ inputLabel: { shrink: true } }}
                                inputProps={{ min: today }}
                                size="small"
                                variant="standard"
                                sx={{ '& .MuiInput-underline:before': { borderBottom: 'none' }, '& .MuiInput-underline:hover:before': { borderBottom: '1px solid rgba(0,0,0,0.2)' } }}
                              />
                            </Box>

                            {/* Arrow divider */}
                            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, bgcolor: 'grey.50' }}>
                              <Typography sx={{ color: 'text.disabled', fontSize: 18, lineHeight: 1 }}>→</Typography>
                            </Box>

                            {/* Arrival */}
                            <Box sx={{ flex: 1, p: 1.5 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                                Arrival
                              </Typography>
                              <TextField
                                fullWidth
                                name="arrivalDate"
                                type="date"
                                value={roundTrip.arrivalDate}
                                onChange={handleRoundTripChange}
                                slotProps={{ inputLabel: { shrink: true } }}
                                inputProps={{ min: roundTrip.departureDate || today }}
                                size="small"
                                variant="standard"
                                error={!!(roundTrip.arrivalDate && roundTrip.departureDate && roundTrip.arrivalDate < roundTrip.departureDate)}
                                helperText={roundTrip.arrivalDate && roundTrip.departureDate && roundTrip.arrivalDate < roundTrip.departureDate ? 'Cannot be before departure' : ''}
                                sx={{ '& .MuiInput-underline:before': { borderBottom: 'none' }, '& .MuiInput-underline:hover:before': { borderBottom: '1px solid rgba(0,0,0,0.2)' } }}
                              />
                              {/* Flexible arrival */}
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>Flexible?</Typography>
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
                            </Box>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 1.5 }}>
                      <Box
                        sx={{
                          border: '2px solid',
                          borderColor: roundTrip.needsHotel ? 'primary.main' : 'warning.main',
                          borderRadius: 1.5,
                          p: 1.5,
                          bgcolor: roundTrip.needsHotel ? 'primary.50' : '#fffbeb',
                          transition: 'all 0.2s',
                        }}
                      >
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              name="needsHotel"
                              checked={roundTrip.needsHotel || false}
                              onChange={handleRoundTripCheckbox}
                              color="primary"
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="body2" fontWeight={600}>
                                🏨 Hotel / Accommodation needed at {roundTrip.toCity || 'destination'}
                              </Typography>
                              {!roundTrip.needsHotel && (
                                <Typography variant="caption" color="warning.dark" fontWeight={600} sx={{ ml: 0.5 }}>
                                  (Don't forget to check if required)
                                </Typography>
                              )}
                            </Box>
                          }
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
                        {/* One-Way departure date styled box */}
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                          <Box sx={{ px: 1.5, py: 0.75, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FlightTakeoffIcon sx={{ color: '#fff', fontSize: 14 }} />
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#fff', letterSpacing: 0.4 }}>
                              Departure Date
                            </Typography>
                          </Box>
                          <Box sx={{ p: 1.5 }}>
                            <TextField
                              fullWidth
                              name="departureDate"
                              type="date"
                              value={roundTrip.departureDate}
                              onChange={handleRoundTripChange}
                              slotProps={{ inputLabel: { shrink: true } }}
                              inputProps={{ min: today }}
                              size="small"
                              variant="standard"
                              sx={{ '& .MuiInput-underline:before': { borderBottom: 'none' }, '& .MuiInput-underline:hover:before': { borderBottom: '1px solid rgba(0,0,0,0.2)' } }}
                            />
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 1.5 }}>
                      <Box
                        sx={{
                          border: '2px solid',
                          borderColor: roundTrip.needsHotel ? 'primary.main' : 'warning.main',
                          borderRadius: 1.5,
                          p: 1.5,
                          bgcolor: roundTrip.needsHotel ? 'primary.50' : '#fffbeb',
                          transition: 'all 0.2s',
                        }}
                      >
                        <FormControlLabel
                          control={
                            <Checkbox size="small" name="needsHotel"
                              checked={roundTrip.needsHotel || false}
                              onChange={handleRoundTripCheckbox} />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="body2" fontWeight={600}>
                                🏨 Hotel / Accommodation needed at {roundTrip.toCity || 'destination'}
                              </Typography>
                              {!roundTrip.needsHotel && (
                                <Typography variant="caption" color="warning.dark" fontWeight={600} sx={{ ml: 0.5 }}>
                                  (Don't forget to check if required)
                                </Typography>
                              )}
                            </Box>
                          }
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
                          <Box
                            sx={{
                              border: '2px solid',
                              borderColor: leg.needsHotel ? 'primary.main' : 'warning.main',
                              borderRadius: 1.5,
                              p: 1.5,
                              bgcolor: leg.needsHotel ? 'primary.50' : '#fffbeb',
                              transition: 'all 0.2s',
                            }}
                          >
                            <FormControlLabel
                              control={
                                <Checkbox
                                  size="small"
                                  checked={leg.needsHotel || false}
                                  onChange={(e) => handleLegChange(index, 'needsHotel', e.target.checked)}
                                />
                              }
                              label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2" fontWeight={600}>
                                    🏨 Hotel / Accommodation needed at {leg.toCity || 'destination'}
                                  </Typography>
                                  {!leg.needsHotel && (
                                    <Typography variant="caption" color="warning.dark" fontWeight={600} sx={{ ml: 0.5 }}>
                                      (Don't forget to check if required)
                                    </Typography>
                                  )}
                                </Box>
                              }
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
                            const vLeg = rentedVehicleLegs[idx] || { pickupPoint: '', dropOffPoint: '', vehicleType: 'Automatic' };
                            return (
                              <Box key={idx} sx={{ mb: 1.5, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                {tripType === 'multiCity' && (
                                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                    Leg {idx + 1}: {cityLeg.fromCity || '?'} → {cityLeg.toCity || '?'}
                                  </Typography>
                                )}
                                <Grid container spacing={2}>
                                  <Grid item xs={12} md={5}>
                                    <TextField fullWidth label="Pick-up Point" size="small" value={vLeg.pickupPoint}
                                      onChange={(e) => { const u = rentedVehicleLegs.map((l,i) => i===idx ? {...l, pickupPoint: e.target.value} : l); while(u.length <= idx) u.push({ pickupPoint:'', dropOffPoint:'', vehicleType:'Automatic' }); setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}
                                      placeholder="e.g., Airport, City Centre" />
                                  </Grid>
                                  <Grid item xs={12} md={5}>
                                    <TextField fullWidth label="Drop-off Point" size="small" value={vLeg.dropOffPoint}
                                      onChange={(e) => { const u = rentedVehicleLegs.map((l,i) => i===idx ? {...l, dropOffPoint: e.target.value} : l); while(u.length <= idx) u.push({ pickupPoint:'', dropOffPoint:'', vehicleType:'Automatic' }); setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}
                                      placeholder="e.g., Hotel, Airport" />
                                  </Grid>
                                  <Grid item xs={12} md={2}>
                                    <TextField fullWidth select label="Transmission" size="small" value={vLeg.vehicleType || 'Automatic'}
                                      onChange={(e) => { const u = rentedVehicleLegs.map((l,i) => i===idx ? {...l, vehicleType: e.target.value} : l); while(u.length <= idx) u.push({ pickupPoint:'', dropOffPoint:'', vehicleType:'Automatic' }); setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}>
                                      <MenuItem value="Automatic">Automatic</MenuItem>
                                      <MenuItem value="Manual">Manual</MenuItem>
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
                              onChange={(e) => { setCarParkVehicleNumber(e.target.value.toUpperCase()); emit(); }}
                              size="small" required placeholder="e.g. AB12 CDE"
                              inputProps={{ style: { textTransform: 'uppercase' } }}
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
                          <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Vehicle Make *" value={carParkVehicleMake}
                              onChange={(e) => { setCarParkVehicleMake(e.target.value); emit(); }}
                              size="small" required placeholder="e.g. Toyota"
                              error={!carParkVehicleMake.trim()}
                              helperText={!carParkVehicleMake.trim() ? 'Vehicle make is required' : 'e.g. Toyota, Ford, BMW'} />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Car Model *" value={carParkCarModel}
                              onChange={(e) => { setCarParkCarModel(e.target.value); emit(); }}
                              size="small" required placeholder="e.g. Corolla"
                              error={!carParkCarModel.trim()}
                              helperText={!carParkCarModel.trim() ? 'Car model is required' : 'e.g. Corolla, Focus, 3 Series'} />
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
                            <FormControlLabel control={<Checkbox checked={foodOptions.nonVegan} onChange={handleFoodChange} name="nonVegan" size="small" />} label="Non-Veg" />
                          </FormGroup>
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
                        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={3}>
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
                        </Box>
                      )}
                    </Box>
                  )}

                  {internationalRequirements.accompanying && (
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'grey.400' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>7. Anyone Accompanying?</Typography>
                      <AccompanyingPersonsPicker
                        persons={accompanyingPersons}
                        employees={allEmployees}
                        onChange={(persons) => {
                          setAccompanyingPersons(persons);
                          // Keep legacy accompanyingNames in sync for backward compat
                          const names = persons.map(p => p.name).filter(Boolean).join(', ');
                          setAccompanyingNames(names);
                          emit({ accompanying: persons.length > 0 ? 'yes' : 'no', accompanyingNames: names, accompanyingPersons: persons });
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
            </>
          ) : (
            <>
              {/* Domestic Travel Info */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mt: 2, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>Travel Information</Typography>
                <Divider sx={{ mt: 0.5 }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Client Name"
                  name="clientName" value={travelData.clientName || ''}
                  onChange={handleFieldChange} placeholder="e.g. Acorn Universal" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Client Company"
                  name="clientCompany" value={travelData.clientCompany || ''}
                  onChange={handleFieldChange} placeholder="e.g. Acorn Ltd" />
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
                    <Box
                      sx={{
                        border: '2px solid',
                        borderColor: domesticHotel.needsHotel ? 'primary.main' : 'warning.main',
                        borderRadius: 1.5,
                        p: 1.5,
                        bgcolor: domesticHotel.needsHotel ? 'primary.50' : '#fffbeb',
                        transition: 'all 0.2s',
                      }}
                    >
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
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" fontWeight={600}>
                              🏨 Hotel / Accommodation needed at {travelData.cityOfTravelDomestic || 'destination'}
                            </Typography>
                            {!domesticHotel.needsHotel && (
                              <Typography variant="caption" color="warning.dark" fontWeight={600} sx={{ ml: 0.5 }}>
                                (Don't forget to check if required)
                              </Typography>
                            )}
                          </Box>
                        }
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
                        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={5}>
                              <TextField fullWidth label="Pick-up Point" size="small"
                                value={rentedVehicleLegs[0]?.pickupPoint || ''}
                                onChange={(e) => { const u = [{ ...rentedVehicleLegs[0], pickupPoint: e.target.value }]; setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}
                                placeholder="e.g., Airport, City Centre" />
                            </Grid>
                            <Grid item xs={12} md={5}>
                              <TextField fullWidth label="Drop-off Point" size="small"
                                value={rentedVehicleLegs[0]?.dropOffPoint || ''}
                                onChange={(e) => { const u = [{ ...rentedVehicleLegs[0], dropOffPoint: e.target.value }]; setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}
                                placeholder="e.g., Hotel, Station" />
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <TextField fullWidth select label="Transmission" size="small"
                                value={rentedVehicleLegs[0]?.vehicleType || 'Automatic'}
                                onChange={(e) => { const u = [{ ...rentedVehicleLegs[0], vehicleType: e.target.value }]; setRentedVehicleLegs(u); emit({ rentedVehicleLegs: u }); }}>
                                <MenuItem value="Automatic">Automatic</MenuItem>
                                <MenuItem value="Manual">Manual</MenuItem>
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
                              onChange={(e) => { setCarParkVehicleNumber(e.target.value.toUpperCase()); emit(); }}
                              size="small" required placeholder="e.g. AB12 CDE"
                              inputProps={{ style: { textTransform: 'uppercase' } }}
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
                          <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Vehicle Make *" value={carParkVehicleMake}
                              onChange={(e) => { setCarParkVehicleMake(e.target.value); emit(); }}
                              size="small" required placeholder="e.g. Toyota"
                              error={!carParkVehicleMake.trim()}
                              helperText={!carParkVehicleMake.trim() ? 'Vehicle make is required' : 'e.g. Toyota, Ford, BMW'} />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Car Model *" value={carParkCarModel}
                              onChange={(e) => { setCarParkCarModel(e.target.value); emit(); }}
                              size="small" required placeholder="e.g. Corolla"
                              error={!carParkCarModel.trim()}
                              helperText={!carParkCarModel.trim() ? 'Car model is required' : 'e.g. Corolla, Focus, 3 Series'} />
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
                            <FormControlLabel control={<Checkbox checked={foodOptions.nonVegan} onChange={handleFoodChange} name="nonVegan" size="small" />} label="Non-Veg" />
                          </FormGroup>
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
                        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={3}>
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
                        </Box>
                      )}
                    </Box>
                  )}

                  {domesticRequirements.accompanying && (
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'grey.400' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>7. Anyone Accompanying?</Typography>
                      <AccompanyingPersonsPicker
                        persons={accompanyingPersons}
                        employees={allEmployees}
                        onChange={(persons) => {
                          setAccompanyingPersons(persons);
                          const names = persons.map(p => p.name).filter(Boolean).join(', ');
                          setAccompanyingNames(names);
                          emit({ accompanying: persons.length > 0 ? 'yes' : 'no', accompanyingNames: names, accompanyingPersons: persons });
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
            </>
          )}

          {/* Reason of Travel and Remarks are rendered outside this component in NewTravelRequest.jsx */}
          <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
        </Grid>
      </CardContent>
    </Card>
    </>
  );
};

export default TravelRequestForm;


