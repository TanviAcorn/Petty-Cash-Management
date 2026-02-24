import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  FlightTakeoff,
  FlightLand,
  CalendarToday,
  Search,
  CheckCircle,
} from '@mui/icons-material';
import axiosClient from '../api/axiosClient';

const FlightSearch = ({ onFlightSelect, selectedFlight, currency = 'GBP' }) => {
  const [searchParams, setSearchParams] = useState({
    origin: '',
    destination: '',
    departureDate: '',
    returnDate: '',
  });
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSearch = async () => {
    // Validate inputs
    if (!searchParams.origin || !searchParams.destination || !searchParams.departureDate) {
      setError('Please fill in origin, destination, and departure date');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axiosClient.post('/travel/flights/search', {
        origin: searchParams.origin,
        destination: searchParams.destination,
        departureDate: searchParams.departureDate,
        returnDate: searchParams.returnDate || undefined,
        currency: currency,
      });

      if (response.data.success) {
        setSearchResults(response.data.data || []);
        if (response.data.data.length === 0) {
          setError('No flights found for the selected criteria');
        }
      } else {
        setError(response.data.message || 'Failed to search flights');
      }
    } catch (err) {
      console.error('Flight search error:', err);
      setError(
        err.response?.data?.message || 
        'Failed to search flights. Please try again.'
      );
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFlight = (flight) => {
    onFlightSelect(flight);
  };

  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const formatCurrency = (amount, curr = currency) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: curr,
    }).format(amount);
  };

  return (
    <Box>
      {/* Search Form */}
      <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Search Flights
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Origin Airport"
                name="origin"
                value={searchParams.origin}
                onChange={handleInputChange}
                placeholder="e.g., LHR"
                InputProps={{
                  startAdornment: <FlightTakeoff sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Destination Airport"
                name="destination"
                value={searchParams.destination}
                onChange={handleInputChange}
                placeholder="e.g., JFK"
                InputProps={{
                  startAdornment: <FlightLand sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Departure Date"
                name="departureDate"
                type="date"
                value={searchParams.departureDate}
                onChange={handleInputChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: new Date().toISOString().split('T')[0],
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Return Date (Optional)"
                name="returnDate"
                type="date"
                value={searchParams.returnDate}
                onChange={handleInputChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: searchParams.departureDate || new Date().toISOString().split('T')[0],
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSearch}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <Search />}
                sx={{ height: '40px' }}
              >
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Available Flights ({searchResults.length})
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {searchResults.map((flight) => (
              <Card
                key={flight.id}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: selectedFlight?.id === flight.id ? 2 : 1,
                  borderColor: selectedFlight?.id === flight.id ? 'primary.main' : 'divider',
                  bgcolor: selectedFlight?.id === flight.id ? 'primary.50' : 'background.paper',
                  '&:hover': {
                    boxShadow: 2,
                    borderColor: 'primary.main',
                  },
                }}
                onClick={() => handleSelectFlight(flight)}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {/* Left: Flight Details */}
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {flight.airline}
                        </Typography>
                        <Chip
                          label={flight.flightNumber}
                          size="small"
                          sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                        />
                        {selectedFlight?.id === flight.id && (
                          <CheckCircle sx={{ ml: 1, color: 'primary.main', fontSize: 20 }} />
                        )}
                      </Box>

                      <Grid container spacing={2} alignItems="center">
                        {/* Departure */}
                        <Grid item xs={12} sm={4}>
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

                        {/* Duration & Stops */}
                        <Grid item xs={12} sm={4}>
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

                        {/* Arrival */}
                        <Grid item xs={12} sm={4}>
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

                      {/* Return Flight Info */}
                      {flight.returnDepartureTime && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            Return Flight
                          </Typography>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={4}>
                              <Typography variant="body2" fontWeight={600}>
                                {formatTime(flight.returnDepartureTime)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {flight.destination}
                              </Typography>
                            </Grid>
                            <Grid item xs={4} sx={{ textAlign: 'center' }}>
                              <Typography variant="caption" color="text.secondary">
                                →
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2" fontWeight={600}>
                                {formatTime(flight.returnArrivalTime)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {flight.origin}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      )}
                    </Box>

                    {/* Right: Price */}
                    <Box sx={{ ml: 3, textAlign: 'right' }}>
                      <Typography variant="h5" fontWeight={700} color="primary.main">
                        {formatCurrency(flight.price, flight.currency)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total price
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* No results message when not loading and no error */}
      {!loading && !error && searchResults.length === 0 && searchParams.origin && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            No flights found. Try adjusting your search criteria.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default FlightSearch;
