import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Grid,
  Checkbox, FormControlLabel, FormGroup, Divider, MenuItem,
  ToggleButtonGroup, ToggleButton, Radio, RadioGroup,
  FormControl, FormLabel, IconButton, Button
} from '@mui/material';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const defaultLeg = () => ({ fromCity: '', toCity: '', date: '', needsHotel: false, hotelFrom: '', hotelTo: '', hotelDays: '' });

const TravelRequestForm = ({ formData, onChange }) => {
  const [travelType, setTravelType] = useState('international');
  const [tripType, setTripType] = useState('roundTrip');

  const [internationalRequirements, setInternationalRequirements] = useState({
    flights: false, visa: false, rentedVehicle: false,
    hotel: false, carPark: false, food: false
  });

  const [domesticRequirements, setDomesticRequirements] = useState({
    flights: false, rentedVehicle: false, hotel: false, carPark: false, food: false, overnightStay: false
  });

  const [roundTrip, setRoundTrip] = useState({
    fromCity: '', toCity: '', departureDate: '', arrivalDate: ''
  });

  const [multiCityLegs, setMultiCityLegs] = useState([defaultLeg(), defaultLeg()]);

  const [foodOptions, setFoodOptions] = useState({
    breakfastIncl: false, veg: false, vegan: false, nonVegan: false
  });

  const [travelData, setTravelData] = useState({
    travelType: 'international',
    employeeName: formData.employeeName || '',
    department: formData.department || '',
    company: formData.company || '',
    countryOfTravel: '',
    preferredDepartureAirport: '',
    destinationAirport: '',
    nationality: '',
    visaType: '',
    lengthOfVisa: '',
    dateOfTravel: '',
    cityOfTravelDomestic: '',
    departurePostcode: '',
    destinationPostcode: '',
    placeOfStay: '',
    stayFrom: '',
    stayTo: '',
    pickupPoint: '',
    dropOffPoint: '',
    vehicleType: 'Manual',
    hotelFrom: '',
    hotelTo: '',
    hotelNumberOfDays: '',
    foodNumberOfDays: '',
    reasonOfTravel: '',
    remarks: ''
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
      requirements: reqs, tripType, roundTrip, multiCityLegs, foodOptions
    });
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

  const handleLegChange = (index, field, value) => {
    const updated = multiCityLegs.map((leg, i) => i === index ? { ...leg, [field]: value } : leg);
    setMultiCityLegs(updated);
    emit({ multiCityLegs: updated });
  };

  const addLeg = () => {
    const updated = [...multiCityLegs, defaultLeg()];
    setMultiCityLegs(updated);
    emit({ multiCityLegs: updated });
  };

  const removeLeg = (index) => {
    if (multiCityLegs.length <= 2) return;
    const updated = multiCityLegs.filter((_, i) => i !== index);
    setMultiCityLegs(updated);
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
                <TextField fullWidth label="Country of Travel *" name="countryOfTravel" value={travelData.countryOfTravel}
                  onChange={handleFieldChange} size="small" required />
              </Grid>

              {/* Trip Type */}
              <Grid item xs={12}>
                <FormControl>
                  <FormLabel sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>Trip Type *</FormLabel>
                  <RadioGroup row value={tripType} onChange={handleTripTypeChange}>
                    <FormControlLabel value="roundTrip" control={<Radio />} label="Round Trip" />
                    <FormControlLabel value="multiCity" control={<Radio />} label="Multi-City" />
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
                        <TextField fullWidth label="Departure Date *" name="departureDate" type="date"
                          value={roundTrip.departureDate} onChange={handleRoundTripChange}
                          slotProps={{ inputLabel: { shrink: true } }} size="small" required />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField fullWidth label="Arrival Date *" name="arrivalDate" type="date"
                          value={roundTrip.arrivalDate} onChange={handleRoundTripChange}
                          slotProps={{ inputLabel: { shrink: true } }} size="small" required />
                      </Grid>
                    </Grid>
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
                            <TextField fullWidth label="From City *" value={leg.fromCity}
                              onChange={(e) => handleLegChange(index, 'fromCity', e.target.value)} size="small" required />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField fullWidth label="To City *" value={leg.toCity}
                              onChange={(e) => handleLegChange(index, 'toCity', e.target.value)} size="small" required />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField fullWidth label="Date *" type="date" value={leg.date}
                              onChange={(e) => handleLegChange(index, 'date', e.target.value)}
                              slotProps={{ inputLabel: { shrink: true } }} size="small" required />
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
                                  slotProps={{ inputLabel: { shrink: true } }} size="small" />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <TextField fullWidth label="Check-out" type="date" value={leg.hotelTo || ''}
                                  onChange={(e) => handleLegChange(index, 'hotelTo', e.target.value)}
                                  slotProps={{ inputLabel: { shrink: true } }} size="small" />
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <TextField fullWidth label="No. of Days" type="number" value={leg.hotelDays || ''}
                                  onChange={(e) => handleLegChange(index, 'hotelDays', e.target.value)}
                                  size="small" slotProps={{ htmlInput: { min: 1 } }} />
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
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.hotel} onChange={handleIntlReqChange} name="hotel" />} label="4. Hotel & Accommodation" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.carPark} onChange={handleIntlReqChange} name="carPark" />} label="5. Car Park" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.food} onChange={handleIntlReqChange} name="food" />} label="6. Food" />
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
                        <Grid item xs={12} md={6}>
                          <TextField fullWidth label="b. Destination Airport" name="destinationAirport"
                            value={travelData.destinationAirport} onChange={handleFieldChange} size="small" placeholder="e.g., DXB" />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {internationalRequirements.visa && (
                    <Box sx={{ bgcolor: 'success.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>2. Visa</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="a. Nationality" name="nationality" value={travelData.nationality}
                            onChange={handleFieldChange} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="b. Visa Type" name="visaType" value={travelData.visaType}
                            onChange={handleFieldChange} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="c. Length of Visa" name="lengthOfVisa" value={travelData.lengthOfVisa}
                            onChange={handleFieldChange} size="small" placeholder="e.g., 30 days" />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {internationalRequirements.rentedVehicle && (
                    <Box sx={{ bgcolor: 'warning.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>3. Rented Vehicle</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="a. Pick-up Point" name="pickupPoint" value={travelData.pickupPoint}
                            onChange={handleFieldChange} size="small" placeholder="e.g., Airport, City Centre" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="b. Drop-off Point" name="dropOffPoint" value={travelData.dropOffPoint}
                            onChange={handleFieldChange} size="small" placeholder="e.g., Hotel, Airport" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth select label="c. Manual/Automatic" name="vehicleType"
                            value={travelData.vehicleType} onChange={handleFieldChange} size="small">
                            <MenuItem value="Manual">Manual</MenuItem>
                            <MenuItem value="Automatic">Automatic</MenuItem>
                          </TextField>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {internationalRequirements.hotel && (
                    <Box sx={{ bgcolor: 'info.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>4. Hotel & Accommodation</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="a. From (Check-in)" name="hotelFrom" type="date"
                            value={travelData.hotelFrom} onChange={handleFieldChange}
                            slotProps={{ inputLabel: { shrink: true } }} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="b. To (Check-out)" name="hotelTo" type="date"
                            value={travelData.hotelTo} onChange={handleFieldChange}
                            slotProps={{ inputLabel: { shrink: true } }} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="c. Number of Days" name="hotelNumberOfDays" type="number"
                            value={travelData.hotelNumberOfDays || ''} onChange={handleFieldChange}
                            size="small" slotProps={{ htmlInput: { min: 1 } }} />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {internationalRequirements.carPark && (
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'grey.400' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>5. Car Park</Typography>
                      <FormControl>
                        <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Car park required?</FormLabel>
                        <RadioGroup row value={travelData.carParkRequired || 'no'}
                          onChange={(e) => handleFieldChange({ target: { name: 'carParkRequired', value: e.target.value } })}>
                          <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                          <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                        </RadioGroup>
                      </FormControl>
                    </Box>
                  )}

                  {internationalRequirements.food && (
                    <Box sx={{ bgcolor: 'secondary.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'secondary.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>6. Food</Typography>
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
                <TextField fullWidth label="Date of Travel *" name="dateOfTravel" type="date" value={travelData.dateOfTravel}
                  onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" required />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="City of Travel *" name="cityOfTravelDomestic" value={travelData.cityOfTravelDomestic}
                  onChange={handleFieldChange} size="small" required />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Departure Postcode *" name="departurePostcode" value={travelData.departurePostcode}
                  onChange={handleFieldChange} size="small" required />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Destination Postcode *" name="destinationPostcode" value={travelData.destinationPostcode}
                  onChange={handleFieldChange} size="small" required />
              </Grid>

              {/* Domestic Requirements Checkboxes */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Travel Requirements</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>Select all that apply</Typography>
                <FormGroup row>
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.flights} onChange={handleDomReqChange} name="flights" />} label="1. Flights" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.rentedVehicle} onChange={handleDomReqChange} name="rentedVehicle" />} label="2. Rented Vehicle" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.hotel} onChange={handleDomReqChange} name="hotel" />} label="3. Hotel & Accommodation" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.carPark} onChange={handleDomReqChange} name="carPark" />} label="4. Car Park" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.food} onChange={handleDomReqChange} name="food" />} label="5. Food" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.overnightStay} onChange={handleDomReqChange} name="overnightStay" />} label="6. Overnight Stay" />
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
                        <Grid item xs={12} md={6}>
                          <TextField fullWidth label="b. Destination Airport" name="destinationAirport"
                            value={travelData.destinationAirport} onChange={handleFieldChange} size="small" placeholder="e.g., MAN" />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {domesticRequirements.rentedVehicle && (
                    <Box sx={{ bgcolor: 'warning.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>2. Rented Vehicle</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="a. Pick-up Point" name="pickupPoint" value={travelData.pickupPoint}
                            onChange={handleFieldChange} size="small" placeholder="e.g., Airport, City Centre" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="b. Drop-off Point" name="dropOffPoint" value={travelData.dropOffPoint}
                            onChange={handleFieldChange} size="small" placeholder="e.g., Hotel, Station" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth select label="c. Manual/Automatic" name="vehicleType"
                            value={travelData.vehicleType} onChange={handleFieldChange} size="small">
                            <MenuItem value="Manual">Manual</MenuItem>
                            <MenuItem value="Automatic">Automatic</MenuItem>
                          </TextField>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {domesticRequirements.hotel && (
                    <Box sx={{ bgcolor: 'info.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>3. Hotel & Accommodation</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="a. From (Check-in)" name="hotelFrom" type="date"
                            value={travelData.hotelFrom} onChange={handleFieldChange}
                            slotProps={{ inputLabel: { shrink: true } }} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="b. To (Check-out)" name="hotelTo" type="date"
                            value={travelData.hotelTo} onChange={handleFieldChange}
                            slotProps={{ inputLabel: { shrink: true } }} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="c. Number of Days" name="hotelNumberOfDays" type="number"
                            value={travelData.hotelNumberOfDays || ''} onChange={handleFieldChange}
                            size="small" slotProps={{ htmlInput: { min: 1 } }} />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {domesticRequirements.carPark && (
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'grey.400' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>4. Car Park</Typography>
                      <FormControl>
                        <FormLabel sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Car park required?</FormLabel>
                        <RadioGroup row value={travelData.carParkRequired || 'no'}
                          onChange={(e) => handleFieldChange({ target: { name: 'carParkRequired', value: e.target.value } })}>
                          <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                          <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                        </RadioGroup>
                      </FormControl>
                    </Box>
                  )}

                  {domesticRequirements.food && (
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

                  {domesticRequirements.overnightStay && (
                    <Box sx={{ bgcolor: 'info.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>6. Overnight Stay</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="Place of Stay" name="placeOfStay" value={travelData.placeOfStay}
                            onChange={handleFieldChange} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="From" name="stayFrom" type="date" value={travelData.stayFrom}
                            onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth label="To" name="stayTo" type="date" value={travelData.stayTo}
                            onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" />
                        </Grid>
                      </Grid>
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
            <TextField fullWidth name="reasonOfTravel" value={travelData.reasonOfTravel} onChange={handleFieldChange}
              multiline rows={4} size="small" required
              placeholder="Please provide a detailed reason for your travel request..." />
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
  );
};

export default TravelRequestForm;
