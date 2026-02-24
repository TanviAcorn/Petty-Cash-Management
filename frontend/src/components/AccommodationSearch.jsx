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
  Rating,
  Stack,
} from '@mui/material';
import {
  LocationOn,
  CalendarToday,
  People,
  Search,
  CheckCircle,
  Hotel,
  Star,
} from '@mui/icons-material';
import axiosClient from '../api/axiosClient';

const AccommodationSearch = ({ onAccommodationSelect, selectedAccommodation, currency = 'GBP' }) => {
  const [searchParams, setSearchParams] = useState({
    destination: '',
    checkInDate: '',
    checkOutDate: '',
    guests: 1,
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
    if (!searchParams.destination || !searchParams.checkInDate || !searchParams.checkOutDate) {
      setError('Please fill in destination, check-in date, and check-out date');
      return;
    }

    // Validate dates
    if (new Date(searchParams.checkOutDate) <= new Date(searchParams.checkInDate)) {
      setError('Check-out date must be after check-in date');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axiosClient.post('/travel/accommodations/search', {
        destination: searchParams.destination,
        checkInDate: searchParams.checkInDate,
        checkOutDate: searchParams.checkOutDate,
        guests: parseInt(searchParams.guests, 10),
        currency: currency,
      });

      if (response.data.success) {
        setSearchResults(response.data.data || []);
        if (response.data.data.length === 0) {
          setError('No accommodations found for the selected criteria');
        }
      } else {
        setError(response.data.message || 'Failed to search accommodations');
      }
    } catch (err) {
      console.error('Accommodation search error:', err);
      setError(
        err.response?.data?.message || 
        'Failed to search accommodations. Please try again.'
      );
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccommodation = (accommodation) => {
    onAccommodationSelect(accommodation);
  };

  const calculateNights = (checkIn, checkOut) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatCurrency = (amount, curr = currency) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: curr,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Box>
      {/* Search Form */}
      <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Search Accommodations
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Destination"
                name="destination"
                value={searchParams.destination}
                onChange={handleInputChange}
                placeholder="e.g., New York, London"
                InputProps={{
                  startAdornment: <LocationOn sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Check-in Date"
                name="checkInDate"
                type="date"
                value={searchParams.checkInDate}
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
                label="Check-out Date"
                name="checkOutDate"
                type="date"
                value={searchParams.checkOutDate}
                onChange={handleInputChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: searchParams.checkInDate || new Date().toISOString().split('T')[0],
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Guests"
                name="guests"
                type="number"
                value={searchParams.guests}
                onChange={handleInputChange}
                inputProps={{
                  min: 1,
                  max: 10,
                }}
                InputProps={{
                  startAdornment: <People sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
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
            Available Accommodations ({searchResults.length})
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {searchResults.map((accommodation) => {
              const nights = calculateNights(searchParams.checkInDate, searchParams.checkOutDate);
              
              return (
                <Card
                  key={accommodation.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: selectedAccommodation?.id === accommodation.id ? 2 : 1,
                    borderColor: selectedAccommodation?.id === accommodation.id ? 'primary.main' : 'divider',
                    bgcolor: selectedAccommodation?.id === accommodation.id ? 'primary.50' : 'background.paper',
                    '&:hover': {
                      boxShadow: 2,
                      borderColor: 'primary.main',
                    },
                  }}
                  onClick={() => handleSelectAccommodation(accommodation)}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      {/* Left: Hotel Details */}
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Hotel sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                          <Typography variant="subtitle1" fontWeight={600}>
                            {accommodation.name}
                          </Typography>
                          {selectedAccommodation?.id === accommodation.id && (
                            <CheckCircle sx={{ ml: 1, color: 'primary.main', fontSize: 20 }} />
                          )}
                        </Box>

                        {/* Address */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
                          <LocationOn sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5, mt: 0.2 }} />
                          <Typography variant="body2" color="text.secondary">
                            {accommodation.address}
                          </Typography>
                        </Box>

                        {/* Ratings */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                          {/* Star Rating */}
                          {accommodation.starRating && (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Rating
                                value={accommodation.starRating}
                                readOnly
                                size="small"
                                sx={{ mr: 0.5 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                ({accommodation.starRating} star)
                              </Typography>
                            </Box>
                          )}

                          {/* Guest Rating */}
                          {accommodation.guestRating && (
                            <Chip
                              icon={<Star sx={{ fontSize: 14 }} />}
                              label={`${accommodation.guestRating}/10`}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ height: 24 }}
                            />
                          )}
                        </Box>

                        {/* Amenities */}
                        {accommodation.amenities && accommodation.amenities.length > 0 && (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                            {accommodation.amenities.slice(0, 5).map((amenity, index) => (
                              <Chip
                                key={index}
                                label={amenity}
                                size="small"
                                variant="outlined"
                                sx={{ height: 22, fontSize: '0.7rem' }}
                              />
                            ))}
                            {accommodation.amenities.length > 5 && (
                              <Chip
                                label={`+${accommodation.amenities.length - 5} more`}
                                size="small"
                                variant="outlined"
                                sx={{ height: 22, fontSize: '0.7rem' }}
                              />
                            )}
                          </Stack>
                        )}

                        {/* Stay Details */}
                        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                          <Grid container spacing={2}>
                            <Grid item xs={6} sm={3}>
                              <Typography variant="caption" color="text.secondary">
                                Check-in
                              </Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {formatDate(searchParams.checkInDate)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Typography variant="caption" color="text.secondary">
                                Check-out
                              </Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {formatDate(searchParams.checkOutDate)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Typography variant="caption" color="text.secondary">
                                Nights
                              </Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {nights}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Typography variant="caption" color="text.secondary">
                                Guests
                              </Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {searchParams.guests}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      </Box>

                      {/* Right: Price */}
                      <Box sx={{ ml: 3, textAlign: 'right' }}>
                        <Typography variant="h5" fontWeight={700} color="primary.main">
                          {formatCurrency(accommodation.totalPrice, accommodation.currency)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Total for {nights} night{nights !== 1 ? 's' : ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {formatCurrency(accommodation.pricePerNight, accommodation.currency)}/night
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </Box>
      )}

      {/* No results message when not loading and no error */}
      {!loading && !error && searchResults.length === 0 && searchParams.destination && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            No accommodations found. Try adjusting your search criteria.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AccommodationSearch;
