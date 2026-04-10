import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  Rating, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Divider, Tooltip,
} from '@mui/material';
import { Star, RateReview } from '@mui/icons-material';

const RATING_KEYS = [
  { key: 'flights_rating',  label: 'Flights',   color: '#3B82F6' },
  { key: 'hotel_rating',    label: 'Hotel',     color: '#6366F1' },
  { key: 'food_rating',     label: 'Food',      color: '#10B981' },
  { key: 'vehicle_rating',  label: 'Vehicle',   color: '#F59E0B' },
  { key: 'car_park_rating', label: 'Car Park',  color: '#6B7280' },
  { key: 'baggage_rating',  label: 'Baggage',   color: '#8B5CF6' },
  { key: 'overall_rating',  label: 'Overall',   color: '#EF4444' },
];

const REMARKS_KEYS = [
  { key: 'flights_remarks',  label: 'Flights' },
  { key: 'hotel_remarks',    label: 'Hotel' },
  { key: 'food_remarks',     label: 'Food' },
  { key: 'vehicle_remarks',  label: 'Vehicle' },
  { key: 'car_park_remarks', label: 'Car Park' },
  { key: 'baggage_remarks',  label: 'Baggage' },
  { key: 'remarks',          label: 'Overall Remarks' },
];

const StarRating = ({ value }) => (
  <Rating value={value || 0} readOnly size="small"
    emptyIcon={<Star style={{ opacity: 0.3 }} fontSize="inherit" />} />
);

const getTripSummary = (tf) => {
  if (!tf) return '—';
  if (tf.travelType === 'domestic') return `Domestic → ${tf.cityOfTravelDomestic || '—'}`;
  if (tf.tripType === 'roundTrip' && tf.roundTrip) return `${tf.roundTrip.fromCity || '—'} → ${tf.roundTrip.toCity || '—'}`;
  if (tf.tripType === 'multiCity') return `Multi-City (${tf.multiCityLegs?.length || 0} legs)`;
  return tf.countryOfTravel || '—';
};

export default function TravelFeedbackAdmin() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    axiosClient.get('/travel-feedback/all')
      .then(res => setFeedbacks(res.data.data || []))
      .catch(err => console.error('Failed to fetch feedbacks:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <RateReview sx={{ color: 'primary.main' }} />
        <Typography variant="h4" fontWeight={700}>Travel Feedback</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        All feedback submitted by employees after their trips
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : feedbacks.length === 0 ? (
        <Alert severity="info">No feedback submitted yet.</Alert>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Trip</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Submitted</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Overall</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Flights</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Hotel</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Food</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {feedbacks.map(fb => (
                    <TableRow key={fb.id} hover>
                      <TableCell>#{fb.request_id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{fb.employee_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{fb.employee_email}</Typography>
                      </TableCell>
                      <TableCell>{getTripSummary(fb.travel_form_data)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(fb.submitted_at).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell><StarRating value={fb.overall_rating} /></TableCell>
                      <TableCell><StarRating value={fb.flights_rating} /></TableCell>
                      <TableCell><StarRating value={fb.hotel_rating} /></TableCell>
                      <TableCell><StarRating value={fb.food_rating} /></TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => setSelected(fb)}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Feedback — {selected?.employee_name} (Trip #{selected?.request_id})</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Box>
              <Typography variant="subtitle2" color="primary" fontWeight={700} sx={{ mb: 1.5, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                Ratings
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {RATING_KEYS.map(({ key, label, color }) => selected[key] ? (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color, fontWeight: 500, minWidth: 90 }}>{label}</Typography>
                    <StarRating value={selected[key]} />
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 20, textAlign: 'right' }}>
                      {selected[key]}/5
                    </Typography>
                  </Box>
                ) : null)}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" color="primary" fontWeight={700} sx={{ mb: 1.5, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                Comments
              </Typography>
              {REMARKS_KEYS.map(({ key, label }) => selected[key] ? (
                <Box key={key} sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.25, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                    {selected[key]}
                  </Typography>
                </Box>
              ) : null)}

              {!REMARKS_KEYS.some(({ key }) => selected[key]) && (
                <Typography variant="body2" color="text.secondary">No comments provided.</Typography>
              )}

              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                Submitted: {new Date(selected.submitted_at).toLocaleString('en-GB')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
