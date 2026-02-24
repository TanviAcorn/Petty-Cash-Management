import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import { Flight, Hotel } from '@mui/icons-material';
import FlightSearch from './FlightSearch';
import AccommodationSearch from './AccommodationSearch';
import TravelSummary from './TravelSummary';

const TravelBookingSection = ({ onTravelDetailsChange, currency = 'GBP' }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedAccommodation, setSelectedAccommodation] = useState(null);
  const [totalCost, setTotalCost] = useState(0);

  // Calculate total cost whenever selections change
  useEffect(() => {
    const flightCost = selectedFlight?.price || 0;
    const accommodationCost = selectedAccommodation?.totalPrice || 0;
    const total = flightCost + accommodationCost;
    setTotalCost(total);

    // Emit travel details to parent component
    if (onTravelDetailsChange) {
      const travelDetails = {
        flight: selectedFlight,
        accommodation: selectedAccommodation,
        totalCost: total,
        currency: currency
      };
      onTravelDetailsChange(travelDetails);
    }
  }, [selectedFlight, selectedAccommodation, currency, onTravelDetailsChange]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleFlightSelect = (flight) => {
    setSelectedFlight(flight);
  };

  const handleAccommodationSelect = (accommodation) => {
    setSelectedAccommodation(accommodation);
  };

  const handleRemoveFlight = () => {
    setSelectedFlight(null);
  };

  const handleRemoveAccommodation = () => {
    setSelectedAccommodation(null);
  };

  const handleEditFlight = () => {
    setActiveTab(0); // Switch to flight search tab
  };

  const handleEditAccommodation = () => {
    setActiveTab(1); // Switch to accommodation search tab
  };

  return (
    <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
          Travel Booking
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Search and select flights and accommodations for your travel request
        </Typography>

        {/* Travel Summary - Show if any selection made */}
        {(selectedFlight || selectedAccommodation) && (
          <Box sx={{ mb: 3 }}>
            <TravelSummary
              flight={selectedFlight}
              accommodation={selectedAccommodation}
              totalCost={totalCost}
              currency={currency}
              onRemoveFlight={handleRemoveFlight}
              onRemoveAccommodation={handleRemoveAccommodation}
              onEditFlight={handleEditFlight}
              onEditAccommodation={handleEditAccommodation}
            />
          </Box>
        )}

        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: 2 }}>
          Search for flights and accommodations below. Your selections will automatically update the request amount.
        </Alert>

        {/* Tabs for Flight and Accommodation Search */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab 
              icon={<Flight />} 
              label="Flight Search" 
              iconPosition="start"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
            <Tab 
              icon={<Hotel />} 
              label="Accommodation Search" 
              iconPosition="start"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <Box>
          {activeTab === 0 && (
            <FlightSearch 
              onFlightSelect={handleFlightSelect}
              selectedFlight={selectedFlight}
              currency={currency}
            />
          )}
          {activeTab === 1 && (
            <AccommodationSearch 
              onAccommodationSelect={handleAccommodationSelect}
              selectedAccommodation={selectedAccommodation}
              currency={currency}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default TravelBookingSection;
