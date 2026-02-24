import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Divider,
  IconButton,
  Chip,
  Stack,
  Paper,
} from '@mui/material';
import {
  FlightTakeoff,
  FlightLand,
  Hotel,
  LocationOn,
  Edit,
  Delete,
  CalendarToday,
  People,
  Star,
  AttachMoney,
} from '@mui/icons-material';

const TravelSummary = ({ flight, accommodation, currency = 'GBP', onEditFlight, onRemoveFlight, onEditAccommodation, onRemoveAccommodation }) => {
  const formatCurrency = (amount, curr = currency) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: curr,
    }).format(amount);
  };

  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const calculateTotalCost = () => {
    let total = 0;
    if (flight) total += flight.price;
    if (accommodation) total += accommodation.totalPrice;
    return total;
  };

  // If no selections, show empty state
  if (!flight && !accommodation) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          borderRadius: 2,
          bgcolor: 'grey.50',
          borderStyle: 'dashed',
        }}
      >
        <Typography variant="body1" color="text.secondary">
          No travel selections yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Search and select flights or accommodations to see your travel summary
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Travel Summary
      </Typography>

      {/* Flight Summary */}
      {flight && (
        <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FlightTakeoff sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Flight Details
                </Typography>
              </Box>
              <Box>
                {onEditFlight && (
                  <IconButton
                    size="small"
                    onClick={onEditFlight}
                    sx={{ mr: 0.5 }}
                    title="Edit flight selection"
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                )}
                {onRemoveFlight && (
                  <IconButton
                    size="small"
                    onClick={onRemoveFlight}
                    color="error"
                    title="Remove flight"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body1" fontWeight={600}>
                    {flight.airline}
                  </Typography>
                  <Chip
                    label={flight.flightNumber}
                    size="small"
                    sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                  />
                </Box>
              </Grid>

              {/* Outbound Flight */}
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Outbound
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={5}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        {formatTime(flight.departureTime)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {flight.origin}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(flight.departureTime)}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={2}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {flight.duration}
                      </Typography>
                      <Divider sx={{ my: 0.5 }} />
                      <Typography variant="caption" color="text.secondary">
                        {flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={5}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        {formatTime(flight.arrivalTime)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {flight.destination}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(flight.arrivalTime)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Grid>

              {/* Return Flight */}
              {flight.returnDepartureTime && (
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Return
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={5}>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>
                          {formatTime(flight.returnDepartureTime)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {flight.destination}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(flight.returnDepartureTime)}
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid item xs={2}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Divider />
                      </Box>
                    </Grid>

                    <Grid item xs={5}>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>
                          {formatTime(flight.returnArrivalTime)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {flight.origin}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(flight.returnArrivalTime)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Grid>
              )}

              {/* Flight Cost */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Flight Cost
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {formatCurrency(flight.price, flight.currency)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Accommodation Summary */}
      {accommodation && (
        <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Hotel sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Accommodation Details
                </Typography>
              </Box>
              <Box>
                {onEditAccommodation && (
                  <IconButton
                    size="small"
                    onClick={onEditAccommodation}
                    sx={{ mr: 0.5 }}
                    title="Edit accommodation selection"
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                )}
                {onRemoveAccommodation && (
                  <IconButton
                    size="small"
                    onClick={onRemoveAccommodation}
                    color="error"
                    title="Remove accommodation"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>
                  {accommodation.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <LocationOn sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5, mt: 0.2 }} />
                  <Typography variant="body2" color="text.secondary">
                    {accommodation.address}
                  </Typography>
                </Box>

                {/* Ratings */}
                {(accommodation.starRating || accommodation.guestRating) && (
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    {accommodation.starRating && (
                      <Chip
                        icon={<Star sx={{ fontSize: 14 }} />}
                        label={`${accommodation.starRating} star`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22 }}
                      />
                    )}
                    {accommodation.guestRating && (
                      <Chip
                        label={`${accommodation.guestRating}/10 rating`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ height: 22 }}
                      />
                    )}
                  </Stack>
                )}
              </Grid>

              {/* Stay Details */}
              <Grid item xs={12}>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <CalendarToday sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
                      <Typography variant="caption" color="text.secondary">
                        Check-in
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      {formatDate(accommodation.checkInDate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <CalendarToday sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
                      <Typography variant="caption" color="text.secondary">
                        Check-out
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      {formatDate(accommodation.checkOutDate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">
                      Nights
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {accommodation.nights}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <People sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
                      <Typography variant="caption" color="text.secondary">
                        Guests
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      {accommodation.guests}
                    </Typography>
                  </Grid>
                </Grid>
              </Grid>

              {/* Accommodation Cost */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Per Night
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(accommodation.pricePerNight, accommodation.currency)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Total ({accommodation.nights} night{accommodation.nights !== 1 ? 's' : ''})
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {formatCurrency(accommodation.totalPrice, accommodation.currency)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Cost Breakdown */}
      <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: 'primary.50' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AttachMoney sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Cost Breakdown
            </Typography>
          </Box>

          <Stack spacing={1.5}>
            {flight && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Flight
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatCurrency(flight.price, flight.currency)}
                </Typography>
              </Box>
            )}

            {accommodation && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Accommodation
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatCurrency(accommodation.totalPrice, accommodation.currency)}
                </Typography>
              </Box>
            )}

            <Divider />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" fontWeight={700}>
                Total Travel Cost
              </Typography>
              <Typography variant="h5" fontWeight={700} color="primary.main">
                {formatCurrency(calculateTotalCost(), currency)}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TravelSummary;
