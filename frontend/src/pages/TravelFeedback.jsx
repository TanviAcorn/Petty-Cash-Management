import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, CircularProgress,
  TextField, Button, Divider, Alert, Rating, Tooltip
} from '@mui/material';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import HotelIcon from '@mui/icons-material/Hotel';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LuggageIcon from '@mui/icons-material/Luggage';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '');

const CATEGORIES = [
  { key: 'flights',  label: 'Flights',              icon: <FlightTakeoffIcon />, color: '#3B82F6', reqKey: 'flights' },
  { key: 'hotel',    label: 'Hotel & Accommodation', icon: <HotelIcon />,         color: '#6366F1', reqKey: 'hotel' },
  { key: 'vehicle',  label: 'Rented Vehicle',        icon: <DirectionsCarIcon />, color: '#F59E0B', reqKey: 'rentedVehicle' },
  { key: 'carPark',  label: 'Car Park',              icon: <LocalParkingIcon />,  color: '#6B7280', reqKey: 'carPark' },
  { key: 'food',     label: 'Food',                  icon: <RestaurantIcon />,    color: '#10B981', reqKey: 'food' },
  { key: 'baggage',  label: 'Baggage',               icon: <LuggageIcon />,       color: '#8B5CF6', reqKey: 'baggage' },
];

const ratingLabels = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent' };

// Deep sub-questions per category
const CATEGORY_QUESTIONS = {
  flights: [
    { key: 'punctuality',    label: 'Punctuality & On-time departure' },
    { key: 'comfort',        label: 'Seat comfort & cabin cleanliness' },
    { key: 'crew',           label: 'Cabin crew service' },
    { key: 'checkin',        label: 'Check-in & boarding experience' },
  ],
  hotel: [
    { key: 'roomQuality',    label: 'Room quality & cleanliness' },
    { key: 'staff',          label: 'Staff & service' },
    { key: 'amenities',      label: 'Amenities & facilities' },
    { key: 'location',       label: 'Location & accessibility' },
  ],
  food: [
    { key: 'quality',        label: 'Food quality & taste' },
    { key: 'variety',        label: 'Menu variety' },
    { key: 'service',        label: 'Service & wait time' },
    { key: 'value',          label: 'Value for money' },
  ],
  vehicle: [
    { key: 'condition',      label: 'Vehicle condition & cleanliness' },
    { key: 'pickup',         label: 'Pick-up & drop-off experience' },
    { key: 'value',          label: 'Value for money' },
  ],
  carPark: [
    { key: 'security',       label: 'Security & safety' },
    { key: 'accessibility',  label: 'Ease of access & signage' },
    { key: 'value',          label: 'Value for money' },
  ],
  baggage: [
    { key: 'handling',       label: 'Baggage handling & care' },
    { key: 'delivery',       label: 'Delivery speed at destination' },
    { key: 'allowance',      label: 'Allowance was sufficient' },
  ],
};

// Key details to show per section from admin-entered data
const ADMIN_DETAIL_KEYS = {
  flights: [
    { key: 'airline',           label: 'Airline' },
    { key: 'flightNumber',      label: 'Flight No.' },
    { key: 'departureAirport',  label: 'From' },
    { key: 'arrivalAirport',    label: 'To' },
    { key: 'departureTime',     label: 'Departure' },
    { key: 'arrivalTime',       label: 'Arrival' },
    { key: 'seatNumber',        label: 'Seat' },
  ],
  hotel: [
    { key: 'hotelName',         label: 'Hotel' },
    { key: 'hotelAddress',      label: 'Address' },
    { key: 'roomType',          label: 'Room Type' },
    { key: 'roomNumber',        label: 'Room No.' },
    { key: 'checkIn',           label: 'Check-in' },
    { key: 'checkOut',          label: 'Check-out' },
  ],
  food: [
    { key: 'venue',             label: 'Venue' },
    { key: 'mealAllowance',     label: 'Daily Allowance' },
    { key: 'totalMealBudget',   label: 'Total Budget' },
  ],
  rentedVehicle: [
    { key: 'rentalCompany',     label: 'Company' },
    { key: 'vehicleModel',      label: 'Vehicle' },
    { key: 'vehicleReg',        label: 'Reg. No.' },
    { key: 'pickupAddress',     label: 'Pick-up' },
    { key: 'dropoffAddress',    label: 'Drop-off' },
    { key: 'vehicleDeposit',    label: 'Deposit' },
  ],
  carPark: [
    { key: 'carParkName',       label: 'Car Park' },
    { key: 'carParkLocation',   label: 'Location' },
    { key: 'bayNumber',         label: 'Bay No.' },
    { key: 'carParkEntryDate',  label: 'Entry' },
    { key: 'carParkExitDate',   label: 'Exit' },
    { key: 'shuttleCost',       label: 'Shuttle Cost' },
  ],
  baggage: [
    { key: 'baggageAllowance',  label: 'Allowance' },
    { key: 'baggageWeight',     label: 'Max Weight' },
    { key: 'baggageBookingRef', label: 'Booking Ref' },
  ],
};

// Map feedback category key → admin details section key
const SECTION_MAP = {
  flights: 'flights',
  hotel: 'hotel',
  food: 'food',
  vehicle: 'rentedVehicle',
  carPark: 'carPark',
  baggage: 'baggage',
};

function SubRating({ label, value, onChange, disabled }) {
  const [hover, setHover] = useState(-1);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Rating
          size="small"
          value={value}
          onChange={(_, val) => onChange(val)}
          onChangeActive={(_, val) => setHover(val)}
          disabled={disabled}
          emptyIcon={<StarIcon style={{ opacity: 0.3 }} fontSize="inherit" />}
        />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, textAlign: 'right' }}>
          {ratingLabels[hover !== -1 ? hover : value] || ''}
        </Typography>
      </Box>
    </Box>
  );
}

function CategoryRating({ category, rating, subRatings, remarks, onRatingChange, onSubRatingChange, onRemarksChange, disabled, adminDetails }) {
  const [hover, setHover] = useState(-1);
  const questions = CATEGORY_QUESTIONS[category.questionKey || category.key] || [];

  // For per-leg keys (flights_leg_0, hotel_leg_1 etc.) use adminKey directly, else fall back to SECTION_MAP
  const adminSectionKey = category.adminKey || SECTION_MAP[category.key] || category.key;
  const sectionData = adminDetails?.[adminSectionKey] || {};
  const detailLookupKey = adminSectionKey.replace(/_leg_\d+$/, '');
  const detailFields = (ADMIN_DETAIL_KEYS[detailLookupKey] || []).filter(f => sectionData[f.key]?.trim());

  return (
    <Box sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2.5 }}>
      {/* Header + overall rating */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{ color: category.color, display: 'flex' }}>{category.icon}</Box>
        <Typography variant="subtitle1" fontWeight={700}>{category.label}</Typography>
      </Box>

      {/* Admin-entered details summary */}
      {detailFields.length > 0 && (
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 2, py: 1.5, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {detailFields.map(f => (
            <Box key={f.key}>
              <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>{f.label}</Typography>
              <Typography variant="body2" fontWeight={600}>{sectionData[f.key]}</Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>Overall rating</Typography>
        <Rating
          value={rating}
          onChange={(_, val) => onRatingChange(val)}
          onChangeActive={(_, val) => setHover(val)}
          disabled={disabled}
          size="large"
          emptyIcon={<StarIcon style={{ opacity: 0.3 }} fontSize="inherit" />}
        />
        {(hover !== -1 || rating) && (
          <Typography variant="body2" color="text.secondary">
            {ratingLabels[hover !== -1 ? hover : rating] || ''}
          </Typography>
        )}
      </Box>

      {/* Sub-questions */}
      {questions.length > 0 && (
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 2, mb: 2 }}>
          {questions.map(q => (
            <SubRating
              key={q.key}
              label={q.label}
              value={subRatings?.[q.key] || 0}
              onChange={(val) => onSubRatingChange(q.key, val)}
              disabled={disabled}
            />
          ))}
        </Box>
      )}

      {/* Comments */}
      <TextField
        fullWidth
        size="small"
        multiline
        rows={2}
        placeholder={`Any specific comments about ${category.label.toLowerCase()}?`}
        value={remarks}
        onChange={(e) => onRemarksChange(e.target.value)}
        disabled={disabled}
      />
    </Box>
  );
}

export default function TravelFeedback() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);

  const [ratings, setRatings] = useState({
    flights: 0, hotel: 0, vehicle: 0, carPark: 0, food: 0, baggage: 0, overall: 0
  });
  const [remarks, setRemarks] = useState({
    flights: '', hotel: '', vehicle: '', carPark: '', food: '', baggage: '', overall: ''
  });  const [subRatings, setSubRatings] = useState({});

  useEffect(() => {
    fetch(`${API}/api/travel-feedback/${token}`)
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          setFeedbackData(res.data);
          if (res.data.alreadySubmitted && res.data.existing) {
            const e = res.data.existing;
            setRatings({
              flights: e.flightsRating || 0,
              hotel: e.hotelRating || 0,
              vehicle: e.vehicleRating || 0,
              carPark: e.carParkRating || 0,
              food: e.foodRating || 0,
              baggage: e.baggageRating || 0,
              overall: e.overallRating || 0,
            });
            setRemarks({
              flights: e.flightsRemarks || '',
              hotel: e.hotelRemarks || '',
              vehicle: e.vehicleRemarks || '',
              carPark: e.carParkRemarks || '',
              food: e.foodRemarks || '',
              baggage: e.baggageRemarks || '',
              overall: e.remarks || '',
            });
            setSubmitted(true);
          }
        } else {
          setError(res.message || 'Feedback link not found');
        }
      })
      .catch(() => setError('Failed to load feedback form'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/travel-feedback/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flightsRating: ratings.flights || null,
          hotelRating: ratings.hotel || null,
          vehicleRating: ratings.vehicle || null,
          carParkRating: ratings.carPark || null,
          foodRating: ratings.food || null,
          baggageRating: ratings.baggage || null,
          overallRating: ratings.overall || null,
          flightsRemarks: remarks.flights || null,
          hotelRemarks: remarks.hotel || null,
          vehicleRemarks: remarks.vehicle || null,
          carParkRemarks: remarks.carPark || null,
          foodRemarks: remarks.food || null,
          baggageRemarks: remarks.baggage || null,
          remarks: remarks.overall || null,
          subRatings: subRatings || {},
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.message || 'Failed to submit feedback');
      }
    } catch {
      setError('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !feedbackData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
        <Alert severity="error" sx={{ maxWidth: 480 }}>{error}</Alert>
      </Box>
    );
  }

  const travelData = feedbackData?.travelData;
  const adminDetails = feedbackData?.adminDetails || {};
  const reqs = travelData?.requirements || {};

  const hasFlights = reqs.flights || travelData?.travelType === 'international';

  // Build hotel cards — one per leg for multi-city, single for round trip / domestic
  const isMultiCity = travelData?.tripType === 'multiCity';
  const hotelLegs = isMultiCity
    ? (travelData?.multiCityLegs || [])
        .map((leg, i) => ({ leg, i }))
        .filter(({ leg }) => leg.needsHotel)
    : [];

  const hasHotel = reqs.hotel || reqs.overnightStay ||
    travelData?.roundTrip?.needsHotel ||
    hotelLegs.length > 0 ||
    travelData?.domesticHotel?.needsHotel;

  const legs = travelData?.multiCityLegs || [];

  // For multi-city: generate per-leg categories for flights, hotel, carPark
  const buildMultiCityCategories = () => {
    const cats = [];
    legs.forEach((leg, i) => {
      const legLabel = `Leg ${i + 1}: ${leg.fromCity || '?'} → ${leg.toCity || '?'}`;
      if (hasFlights) cats.push({ key: `flights_leg_${i}`, label: `Flight — ${legLabel}`, icon: <FlightTakeoffIcon />, color: '#3B82F6', adminKey: `flights_leg_${i}`, questionKey: 'flights' });
      if (leg.needsHotel) cats.push({ key: `hotel_leg_${i}`, label: `Hotel — ${legLabel}`, icon: <HotelIcon />, color: '#6366F1', adminKey: `hotel_leg_${i}`, questionKey: 'hotel' });
      if (reqs.carPark) cats.push({ key: `carPark_leg_${i}`, label: `Car Park — ${legLabel}`, icon: <LocalParkingIcon />, color: '#6B7280', adminKey: `carPark_leg_${i}`, questionKey: 'carPark' });
    });
    return cats;
  };

  const visibleCategories = isMultiCity && legs.length > 0
    ? [
        ...buildMultiCityCategories(),
        ...CATEGORIES.filter(c => !['flights','hotel','carPark'].includes(c.key) && reqs[c.reqKey]),
      ]
    : [
        ...(hasFlights ? [{ ...CATEGORIES.find(c => c.key === 'flights'), adminKey: 'flights', questionKey: 'flights' }] : []),
        ...(hasHotel   ? [{ ...CATEGORIES.find(c => c.key === 'hotel'),   adminKey: 'hotel',   questionKey: 'hotel'   }] : []),
        ...CATEGORIES.filter(c => c.key !== 'flights' && c.key !== 'hotel' && reqs[c.reqKey])
          .map(c => ({ ...c, adminKey: c.key, questionKey: c.key })),
      ];

  if (submitted) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3, bgcolor: '#f3f4f6' }}>
        <Card sx={{ maxWidth: 480, width: '100%', borderRadius: 3, textAlign: 'center', p: 2 }}>
          <CardContent>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>Thank you!</Typography>
            <Typography color="text.secondary">
              Your travel feedback has been submitted. We appreciate you taking the time to share your experience.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f3f4f6', py: 4, px: 2 }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{
          background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
          borderRadius: '12px 12px 0 0', p: 4, textAlign: 'center', color: '#fff'
        }}>
          <Typography fontSize={40} lineHeight={1} mb={1}>✈️</Typography>
          <Typography variant="h5" fontWeight={700}>Travel Feedback</Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
            Trip #{feedbackData?.requestId} · {feedbackData?.employeeName}
          </Typography>
        </Box>

        <Card sx={{ borderRadius: '0 0 12px 12px', border: '1px solid', borderColor: 'divider', borderTop: 'none' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Please rate your experience for each service used during your trip. Your feedback helps us improve future travel arrangements.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Per-category ratings */}
            {visibleCategories.length > 0 ? (
              visibleCategories.map(cat => (
                <CategoryRating
                  key={cat.key}
                  category={cat}
                  rating={ratings[cat.key]}
                  subRatings={subRatings[cat.key] || {}}
                  remarks={remarks[cat.key]}
                  onRatingChange={(val) => setRatings(r => ({ ...r, [cat.key]: val }))}
                  onSubRatingChange={(subKey, val) => setSubRatings(s => ({
                    ...s,
                    [cat.key]: { ...(s[cat.key] || {}), [subKey]: val }
                  }))}
                  onRemarksChange={(val) => setRemarks(r => ({ ...r, [cat.key]: val }))}
                  disabled={false}
                  adminDetails={adminDetails}
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" mb={2}>
                Please rate your overall travel experience below.
              </Typography>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Overall rating */}
            <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.main', mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Overall Experience</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                <Rating
                  value={ratings.overall}
                  onChange={(_, val) => setRatings(r => ({ ...r, overall: val }))}
                  size="large"
                  emptyIcon={<StarIcon style={{ opacity: 0.3 }} fontSize="inherit" />}
                />
                {ratings.overall > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {ratingLabels[ratings.overall]}
                  </Typography>
                )}
              </Box>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={3}
                placeholder="Any additional remarks or suggestions for future trips..."
                value={remarks.overall}
                onChange={(e) => setRemarks(r => ({ ...r, overall: e.target.value }))}
              />
            </Box>

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleSubmit}
              disabled={submitting}
              sx={{
                background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                borderRadius: 2, py: 1.5, fontWeight: 600, fontSize: '1rem'
              }}
            >
              {submitting ? <CircularProgress size={22} color="inherit" /> : 'Submit Feedback'}
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
