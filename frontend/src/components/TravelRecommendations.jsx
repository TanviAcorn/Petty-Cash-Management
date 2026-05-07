import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Rating, Tooltip,
  CircularProgress, Divider, Stack, Collapse, IconButton,
} from '@mui/material';
import HotelIcon from '@mui/icons-material/Hotel';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LuggageIcon from '@mui/icons-material/Luggage';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import axiosClient from '../api/axiosClient';

const CATEGORY_CONFIG = {
  hotel:    { label: 'Hotel',          icon: <HotelIcon />,          color: '#6366F1', bg: '#EEF2FF' },
  flights:  { label: 'Airline',        icon: <FlightTakeoffIcon />,  color: '#3B82F6', bg: '#EFF6FF' },
  vehicle:  { label: 'Rental Company', icon: <DirectionsCarIcon />,  color: '#F59E0B', bg: '#FFFBEB' },
  carPark:  { label: 'Car Park',       icon: <LocalParkingIcon />,   color: '#6B7280', bg: '#F9FAFB' },
  food:     { label: 'Food Venue',     icon: <RestaurantIcon />,     color: '#10B981', bg: '#ECFDF5' },
  baggage:  { label: 'Baggage',        icon: <LuggageIcon />,        color: '#8B5CF6', bg: '#F5F3FF' },
};

const SUB_LABELS = {
  // hotel
  roomQuality: 'Room quality', staff: 'Staff & service',
  amenities: 'Amenities', location: 'Location',
  // flights
  punctuality: 'Punctuality', comfort: 'Seat comfort',
  crew: 'Cabin crew', checkin: 'Check-in',
  // food
  quality: 'Food quality', variety: 'Menu variety',
  service: 'Service', value: 'Value for money',
  // vehicle
  condition: 'Vehicle condition', pickup: 'Pick-up experience',
  // carPark
  security: 'Security', accessibility: 'Accessibility',
  // baggage
  handling: 'Baggage handling', delivery: 'Delivery speed',
  allowance: 'Allowance',
};

function RecommendationCard({ item, category }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.hotel;
  const hasSubRatings = item.subRatings && Object.keys(item.subRatings).length > 0;
  const topSubRatings = hasSubRatings
    ? Object.entries(item.subRatings)
        .filter(([, v]) => v >= 4)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];

  return (
    <Box sx={{
      p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider',
      bgcolor: cfg.bg, mb: 1.5,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ color: cfg.color, mt: 0.25, flexShrink: 0 }}>{cfg.icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Service name */}
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {item.serviceName || `${cfg.label} recommendation`}
          </Typography>
          {item.serviceDetail && (
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {item.serviceDetail}
            </Typography>
          )}

          {/* Rating + liked count */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
            {item.avgRating && (
              <Rating value={item.avgRating} precision={0.1} size="small" readOnly />
            )}
            {item.avgRating && (
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {item.avgRating.toFixed(1)}
              </Typography>
            )}
            {item.likedCount > 0 && (
              <Chip
                icon={<ThumbUpIcon sx={{ fontSize: '0.75rem !important' }} />}
                label={`${item.likedCount} ${item.likedCount === 1 ? 'person' : 'people'} liked this`}
                size="small"
                sx={{
                  bgcolor: cfg.color, color: '#fff', fontWeight: 600,
                  fontSize: '0.7rem', height: 22,
                  '& .MuiChip-icon': { color: '#fff' },
                }}
              />
            )}
            {item.totalCount > 1 && (
              <Typography variant="caption" color="text.secondary">
                ({item.totalCount} trips)
              </Typography>
            )}
          </Box>

          {/* Top sub-ratings as chips */}
          {topSubRatings.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
              {topSubRatings.map(([key, val]) => (
                <Chip
                  key={key}
                  label={`${SUB_LABELS[key] || key} ★${val}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 20, borderColor: cfg.color, color: cfg.color }}
                />
              ))}
            </Box>
          )}

          {/* Expand for remarks */}
          {item.latestRemarks && (
            <>
              <Box
                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mt: 0.5 }}
                onClick={() => setExpanded(p => !p)}
              >
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  {expanded ? 'Hide review' : 'See traveller review'}
                </Typography>
                <IconButton size="small" sx={{ p: 0, ml: 0.25 }}>
                  {expanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </Box>
              <Collapse in={expanded}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5, fontStyle: 'italic', lineHeight: 1.5 }}
                >
                  "{item.latestRemarks}"
                </Typography>
              </Collapse>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * TravelRecommendations
 *
 * Shows destination-based recommendations sourced from past traveller feedback.
 * Displayed in the New Travel Request form when a destination city is selected.
 *
 * Props:
 *   toCity        {string}  The destination city to fetch recommendations for
 *   activeReqs    {object}  The current requirements flags (flights, hotel, etc.)
 *                           Used to show only relevant categories
 */
export default function TravelRecommendations({ toCity, activeReqs = {} }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!toCity || !toCity.trim()) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    axiosClient.get('/travel-recommendations', { params: { toCity: toCity.trim() } })
      .then(res => {
        if (!cancelled) {
          setData(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) setError('');  // silent — no recommendations is fine
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [toCity]);

  // Determine which categories to show based on active requirements
  const categoriesToShow = Object.entries(CATEGORY_CONFIG).filter(([key]) => {
    if (key === 'hotel')   return activeReqs.hotel || activeReqs.overnightStay;
    if (key === 'flights') return activeReqs.flights;
    if (key === 'vehicle') return activeReqs.rentedVehicle;
    if (key === 'carPark') return activeReqs.carPark;
    if (key === 'food')    return activeReqs.food;
    if (key === 'baggage') return activeReqs.baggage;
    return false;
  }).map(([key]) => key);

  // If no requirements selected yet, show all categories that have data
  const effectiveCategories = categoriesToShow.length > 0
    ? categoriesToShow
    : Object.keys(CATEGORY_CONFIG);

  if (!toCity || !toCity.trim()) return null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" color="text.secondary">
          Loading recommendations for {toCity}…
        </Typography>
      </Box>
    );
  }

  if (!data || data.totalFeedbacks === 0) return null;

  // Filter to categories that have data AND are relevant
  const visibleCategories = effectiveCategories.filter(
    cat => data.data[cat]?.length > 0
  );

  if (visibleCategories.length === 0) return null;

  return (
    <Box sx={{
      mt: 2, p: 2, borderRadius: 2,
      border: '1px solid', borderColor: 'primary.light',
      bgcolor: 'background.paper',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 18 }} />
        <Typography variant="subtitle2" fontWeight={700} color="primary.main">
          Recommendations for {data.toCity}
        </Typography>
        <Chip
          label={`Based on ${data.totalFeedbacks} trip${data.totalFeedbacks !== 1 ? 's' : ''}`}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontSize: '0.65rem', height: 20 }}
        />
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Past travellers to <strong>{data.toCity}</strong> rated these services highly.
        These are suggestions — you can choose any option you prefer.
      </Typography>

      <Divider sx={{ mb: 1.5 }} />

      {/* Category sections */}
      {visibleCategories.map(cat => (
        <Box key={cat} sx={{ mb: 1 }}>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.75 }}
          >
            {CATEGORY_CONFIG[cat]?.label}
          </Typography>
          {/* Show top 2 recommendations per category */}
          {data.data[cat].slice(0, 2).map((item, i) => (
            <RecommendationCard key={i} item={item} category={cat} />
          ))}
        </Box>
      ))}
    </Box>
  );
}
