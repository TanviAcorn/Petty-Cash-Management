import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Grid,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';

const TravelRequestForm = ({ formData, onChange }) => {
  const [travelType, setTravelType] = useState('international');
  
  const [internationalRequirements, setInternationalRequirements] = useState({
    flights: false,
    visa: false,
    rentedVehicle: false,
    hotel: false,
    food: false
  });

  const [domesticRequirements, setDomesticRequirements] = useState({
    rentedVehicle: false,
    overnightStay: false
  });

  const [travelData, setTravelData] = useState({
    travelType: 'international',
    employeeName: formData.employeeName || '',
    department: formData.department || '',
    countryOfTravel: '',
    cityOfTravel: '',
    departureDate: '',
    returnDate: '',
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
    pickupDate: '',
    dropDate: '',
    vehicleType: 'Manual',
    hotelFrom: '',
    hotelTo: '',
    numberOfDays: '',
    reasonOfTravel: ''
  });

  useEffect(() => {
    setTravelData(prev => ({
      ...prev,
      employeeName: formData.employeeName || '',
      department: formData.department || ''
    }));
  }, [formData.employeeName, formData.department]);

  const handleTravelTypeChange = (_event, newType) => {
    if (newType !== null) {
      setTravelType(newType);
      const newTravelData = { ...travelData, travelType: newType };
      setTravelData(newTravelData);
      onChange({
        ...newTravelData,
        requirements: newType === 'international' ? internationalRequirements : domesticRequirements
      });
    }
  };

  const handleInternationalRequirementChange = (event) => {
    const { name, checked } = event.target;
    const newRequirements = { ...internationalRequirements, [name]: checked };
    setInternationalRequirements(newRequirements);
    onChange({
      ...travelData,
      requirements: newRequirements
    });
  };

  const handleDomesticRequirementChange = (event) => {
    const { name, checked } = event.target;
    const newRequirements = { ...domesticRequirements, [name]: checked };
    setDomesticRequirements(newRequirements);
    onChange({
      ...travelData,
      requirements: newRequirements
    });
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    const newTravelData = { ...travelData, [name]: value };
    setTravelData(newTravelData);
    const currentRequirements = travelType === 'international' ? internationalRequirements : domesticRequirements;
    onChange({
      ...newTravelData,
      requirements: currentRequirements
    });
  };

  return (
    <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, borderColor: 'primary.main', borderWidth: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: 'primary.main' }}>
          TRAVEL POLICY – {travelType === 'international' ? 'INTERNATIONAL TRAVEL – AST07' : 'DOMESTIC TRAVEL – AST06'}
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <ToggleButtonGroup
            value={travelType}
            exclusive
            onChange={handleTravelTypeChange}
            aria-label="travel type"
            sx={{ '& .MuiToggleButton-root': { px: 3, py: 1.5, textTransform: 'none', fontWeight: 600 } }}
          >
            <ToggleButton value="international">
              <FlightTakeoffIcon sx={{ mr: 1 }} />
              International Travel
            </ToggleButton>
            <ToggleButton value="domestic">
              <DirectionsCarIcon sx={{ mr: 1 }} />
              Domestic Travel
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Employee Information
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Name of the Employee"
              name="employeeName"
              value={travelData.employeeName}
              onChange={handleFieldChange}
              size="small"
              disabled
              helperText="Auto-filled from your profile"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Department"
              name="department"
              value={travelData.department}
              onChange={handleFieldChange}
              size="small"
            />
          </Grid>

          {travelType === 'international' ? (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
                  Travel Information
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Country of Travel *" name="countryOfTravel" value={travelData.countryOfTravel} onChange={handleFieldChange} size="small" required />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="City of Travel *" name="cityOfTravel" value={travelData.cityOfTravel} onChange={handleFieldChange} size="small" required />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Departure Date *" name="departureDate" type="date" value={travelData.departureDate} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" required />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Return Date *" name="returnDate" type="date" value={travelData.returnDate} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" required />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Travel Requirements</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>Select all that apply</Typography>
                <FormGroup row>
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.flights} onChange={handleInternationalRequirementChange} name="flights" />} label="1. Flights" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.visa} onChange={handleInternationalRequirementChange} name="visa" />} label="2. Visa" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.rentedVehicle} onChange={handleInternationalRequirementChange} name="rentedVehicle" />} label="3. Rented Vehicle" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.hotel} onChange={handleInternationalRequirementChange} name="hotel" />} label="4. Hotel" />
                  <FormControlLabel control={<Checkbox checked={internationalRequirements.food} onChange={handleInternationalRequirementChange} name="food" />} label="5. Food" />
                </FormGroup>
              </Grid>

              {internationalRequirements.flights && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'primary.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'primary.main' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>1. Flights</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField fullWidth label="a. Preferred Departure Airport" name="preferredDepartureAirport" value={travelData.preferredDepartureAirport} onChange={handleFieldChange} size="small" placeholder="e.g., LHR" />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField fullWidth label="b. Destination Airport" name="destinationAirport" value={travelData.destinationAirport} onChange={handleFieldChange} size="small" placeholder="e.g., DXB" />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              )}

              {internationalRequirements.visa && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'success.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>2. Visa</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="a. Nationality" name="nationality" value={travelData.nationality} onChange={handleFieldChange} size="small" />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="b. Visa Type" name="visaType" value={travelData.visaType} onChange={handleFieldChange} size="small" />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="c. Length of Visa" name="lengthOfVisa" value={travelData.lengthOfVisa} onChange={handleFieldChange} size="small" placeholder="e.g., 30 days" />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              )}

              {internationalRequirements.rentedVehicle && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'warning.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>3. Rented Vehicle</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="a. Pickup date" name="pickupDate" type="date" value={travelData.pickupDate} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="b. Drop Date" name="dropDate" type="date" value={travelData.dropDate} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth select label="c. Manual/Automatic" name="vehicleType" value={travelData.vehicleType} onChange={handleFieldChange} size="small">
                          <MenuItem value="Manual">Manual</MenuItem>
                          <MenuItem value="Automatic">Automatic</MenuItem>
                        </TextField>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              )}

              {internationalRequirements.hotel && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'info.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>4. Hotel</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField fullWidth label="a. From (Check-in)" name="hotelFrom" type="date" value={travelData.hotelFrom} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField fullWidth label="b. To (Check-out)" name="hotelTo" type="date" value={travelData.hotelTo} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              )}

              {internationalRequirements.food && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'secondary.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'secondary.main' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>5. Food</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField fullWidth label="a. Number of Days" name="numberOfDays" type="number" value={travelData.numberOfDays} onChange={handleFieldChange} size="small" slotProps={{ htmlInput: { min: 1 } }} />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              )}
            </>
          ) : (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
                  Travel Information
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Date of Travel *" name="dateOfTravel" type="date" value={travelData.dateOfTravel} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" required />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="City of Travel *" name="cityOfTravelDomestic" value={travelData.cityOfTravelDomestic} onChange={handleFieldChange} size="small" required />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Departure Postcode *" name="departurePostcode" value={travelData.departurePostcode} onChange={handleFieldChange} size="small" required />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Destination Postcode *" name="destinationPostcode" value={travelData.destinationPostcode} onChange={handleFieldChange} size="small" required />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Travel Requirements</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>Select all that apply</Typography>
                <FormGroup row>
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.rentedVehicle} onChange={handleDomesticRequirementChange} name="rentedVehicle" />} label="1. Rented Vehicle" />
                  <FormControlLabel control={<Checkbox checked={domesticRequirements.overnightStay} onChange={handleDomesticRequirementChange} name="overnightStay" />} label="2. Overnight Stay" />
                </FormGroup>
              </Grid>

              {domesticRequirements.rentedVehicle && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'warning.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>1. Rented Vehicle</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="Pickup date" name="pickupDate" type="date" value={travelData.pickupDate} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="Drop Date" name="dropDate" type="date" value={travelData.dropDate} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth select label="Manual/Automatic" name="vehicleType" value={travelData.vehicleType} onChange={handleFieldChange} size="small">
                          <MenuItem value="Manual">Manual</MenuItem>
                          <MenuItem value="Automatic">Automatic</MenuItem>
                        </TextField>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              )}

              {domesticRequirements.overnightStay && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'info.50', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>2. Overnight Stay</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="Place of Stay" name="placeOfStay" value={travelData.placeOfStay} onChange={handleFieldChange} size="small" />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="From" name="stayFrom" type="date" value={travelData.stayFrom} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField fullWidth label="To" name="stayTo" type="date" value={travelData.stayTo} onChange={handleFieldChange} slotProps={{ inputLabel: { shrink: true } }} size="small" />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              )}
            </>
          )}

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
              placeholder="Please provide a detailed reason for your travel request..."
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default TravelRequestForm;
