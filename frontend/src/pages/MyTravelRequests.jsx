import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button, CircularProgress,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Visibility, CheckCircle } from '@mui/icons-material';

const MyTravelRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!currentUser.email) return;
    axiosClient.get('/l1-approvals/my-travel-requests', { params: { email: currentUser.email } })
      .then(res => setRequests(res.data.data || []))
      .catch(err => console.error('Failed to fetch travel requests:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleView = async (id) => {
    try {
      const res = await axiosClient.get(`/l1-approvals/${id}`);
      setSelected(res.data.data);
      setDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch request details:', err);
    }
  };

  const getTripSummary = (tf) => {
    if (!tf) return '—';
    if (tf.travelType === 'domestic') return `Domestic → ${tf.cityOfTravelDomestic || '—'}`;
    if (tf.tripType === 'roundTrip' && tf.roundTrip) return `${tf.roundTrip.fromCity || '—'} → ${tf.roundTrip.toCity || '—'}`;
    if (tf.tripType === 'multiCity') return `Multi-City (${tf.multiCityLegs?.length || 0} legs)`;
    return tf.countryOfTravel || '—';
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—';

  const renderDetails = (travelData) => {
    if (!travelData) return <Typography color="text.secondary">No travel details available.</Typography>;
    const tf = travelData;
    const isIntl = tf.travelType === 'international';
    const reqs = tf.requirements || {};

    const SectionTitle = ({ children }) => (
      <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2.5, mb: 1, color: 'primary.main', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
        {children}
      </Typography>
    );
    const Row = ({ label, value }) => value ? (
      <TableRow>
        <TableCell sx={{ fontWeight: 600, width: '38%', bgcolor: 'action.hover', py: 1, fontSize: '0.8rem' }}>{label}</TableCell>
        <TableCell sx={{ py: 1, fontSize: '0.8rem' }}>{value}</TableCell>
      </TableRow>
    ) : null;

    const reqLabels = { flights: 'Flights', visa: 'Visa', rentedVehicle: 'Rented Vehicle', carPark: 'Airport Car Park', food: 'Food Preference', overnightStay: 'Overnight Stay', baggage: 'Baggage Requirements', accompanying: 'Anyone Accompanying' };
    const selectedReqs = Object.entries(reqs).filter(([, v]) => v).map(([k]) => reqLabels[k] || k);

    return (
      <Box>
        {/* Employee Info */}
        <SectionTitle>Employee Information</SectionTitle>
        <TableContainer component={Box}><Table size="small"><TableBody>
          <Row label="Name" value={tf.employeeName} />
          <Row label="Department" value={tf.department} />
          <Row label="Company" value={tf.company} />
        </TableBody></Table></TableContainer>

        {/* Travel Overview */}
        <SectionTitle>Travel Overview</SectionTitle>
        <TableContainer component={Box}><Table size="small"><TableBody>
          <Row label="Travel Type" value={isIntl ? 'International' : 'Domestic'} />
          {isIntl && <Row label="Trip Type" value={tf.tripType === 'roundTrip' ? 'Round Trip' : tf.tripType === 'multiCity' ? 'Multi-City' : tf.tripType === 'oneWay' ? 'One-Way' : tf.tripType} />}
          {isIntl && <Row label="Country" value={tf.countryOfTravel} />}
          {isIntl && tf.countryOfTravel === 'Other' && <Row label="City / Country" value={`${tf.otherCity || ''} / ${tf.otherCountry || ''}`} />}
          {!isIntl && <Row label="City of Travel" value={tf.cityOfTravelDomestic} />}
          {!isIntl && (tf.domesticDateFlex
            ? <><Row label="Travel Date From" value={tf.domesticDateFlexFrom} /><Row label="Travel Date To" value={tf.domesticDateFlexTo} /></>
            : <Row label="Date of Travel" value={fmt(tf.dateOfTravel)} />)}
          {!isIntl && <Row label="Departure Postcode" value={tf.departurePostcode} />}
          {!isIntl && <Row label="Destination Postcode" value={tf.destinationPostcode} />}
          <Row label="Client Name" value={tf.clientName} />
          <Row label="Client Company" value={tf.clientCompany} />
          <Row label="Reason for Travel" value={tf.reasonOfTravel} />
          <Row label="Remarks" value={tf.remarks} />
        </TableBody></Table></TableContainer>

        {/* Round Trip */}
        {isIntl && tf.tripType === 'roundTrip' && tf.roundTrip && (
          <>
            <SectionTitle>Round Trip Details</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <Row label="From City" value={tf.roundTrip.fromCity} />
              <Row label="To City" value={tf.roundTrip.toCity} />
              <Row label="Departure Date" value={tf.roundTrip.departureDate || 'Flexible'} />
              <Row label="Return Date" value={tf.roundTrip.arrivalDate || 'Flexible'} />
              {tf.roundTrip.needsHotel && <>
                <Row label="Hotel Check-in" value={fmt(tf.roundTrip.hotelFrom)} />
                <Row label="Hotel Check-out" value={fmt(tf.roundTrip.hotelTo)} />
                <Row label="Hotel Nights" value={tf.roundTrip.hotelDays} />
              </>}
            </TableBody></Table></TableContainer>
          </>
        )}

        {/* One-Way */}
        {isIntl && tf.tripType === 'oneWay' && tf.roundTrip && (
          <>
            <SectionTitle>One-Way Details</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <Row label="From City" value={tf.roundTrip.fromCity} />
              <Row label="To City" value={tf.roundTrip.toCity} />
              <Row label="Departure Date" value={tf.roundTrip.departureDate || 'Flexible'} />
              {tf.roundTrip.needsHotel && <>
                <Row label="Hotel Check-in" value={fmt(tf.roundTrip.hotelFrom)} />
                <Row label="Hotel Check-out" value={fmt(tf.roundTrip.hotelTo)} />
              </>}
            </TableBody></Table></TableContainer>
          </>
        )}

        {/* Multi-City */}
        {isIntl && tf.tripType === 'multiCity' && tf.multiCityLegs?.length > 0 && (
          <>
            <SectionTitle>Multi-City Legs</SectionTitle>
            {tf.multiCityLegs.map((leg, i) => (
              <Box key={i} sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Leg {i + 1}</Typography>
                <TableContainer component={Box}><Table size="small"><TableBody>
                  <Row label="From City" value={leg.fromCity} />
                  <Row label="To City" value={leg.toCity} />
                  <Row label="Date" value={leg.date || 'Flexible'} />
                  {leg.needsHotel && <>
                    <Row label="Hotel Check-in" value={fmt(leg.hotelFrom)} />
                    <Row label="Hotel Check-out" value={fmt(leg.hotelTo)} />
                  </>}
                </TableBody></Table></TableContainer>
              </Box>
            ))}
          </>
        )}

        {/* Domestic Hotel */}
        {!isIntl && tf.domesticHotel?.needsHotel && (
          <>
            <SectionTitle>Hotel / Accommodation</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <Row label="Check-in" value={fmt(tf.domesticHotel.hotelFrom)} />
              <Row label="Check-out" value={fmt(tf.domesticHotel.hotelTo)} />
              <Row label="No. of Nights" value={tf.domesticHotel.hotelDays} />
            </TableBody></Table></TableContainer>
          </>
        )}

        {/* Requirements */}
        {selectedReqs.length > 0 && (
          <>
            <SectionTitle>Travel Requirements</SectionTitle>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {selectedReqs.map(r => <Chip key={r} label={r} size="small" color="primary" variant="outlined" />)}
            </Box>
          </>
        )}

        {/* Visa */}
        {reqs.visa && tf.visaRequired === 'yes' && (
          <>
            <SectionTitle>Visa Details</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <Row label="Nationality" value={tf.nationality} />
              <Row label="Passport Name" value={tf.passportInfo?.passport_name} />
              <Row label="Passport Number" value={tf.passportInfo?.passport_number} />
              <Row label="Passport Issue Date" value={tf.passportInfo?.passport_issue_date} />
              <Row label="Passport Expiry" value={tf.passportInfo?.passport_expiry} />
              <Row label="Visa Type" value={tf.visaType} />
            </TableBody></Table></TableContainer>
          </>
        )}

        {/* Rented Vehicle */}
        {reqs.rentedVehicle && tf.rentedVehicleRequired === 'yes' && (
          <>
            <SectionTitle>Rented Vehicle</SectionTitle>
            {(tf.rentedVehicleLegs || [{ pickupPoint: tf.pickupPoint, dropOffPoint: tf.dropOffPoint, vehicleType: tf.vehicleType }]).map((leg, i) => (
              <Box key={i} sx={{ mb: 1 }}>
                {tf.rentedVehicleLegs?.length > 1 && <Typography variant="caption" fontWeight={600} color="text.secondary">Leg {i + 1}</Typography>}
                <TableContainer component={Box}><Table size="small"><TableBody>
                  <Row label="Pick-up Point" value={leg.pickupPoint} />
                  <Row label="Drop-off Point" value={leg.dropOffPoint} />
                  <Row label="Vehicle Type" value={leg.vehicleType} />
                </TableBody></Table></TableContainer>
              </Box>
            ))}
          </>
        )}

        {/* Car Park */}
        {reqs.carPark && tf.carParkRequired === 'yes' && (
          <>
            <SectionTitle>Airport Car Park</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <Row label="Vehicle Number" value={tf.carParkVehicleNumber} />
              <Row label="Car Color" value={tf.carParkCarColor} />
              <Row label="Duration" value={tf.carParkDuration} />
            </TableBody></Table></TableContainer>
          </>
        )}

        {/* Food */}
        {reqs.food && tf.foodOptions && (
          <>
            <SectionTitle>Food Preference</SectionTitle>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {Object.entries(tf.foodOptions).filter(([, v]) => v).map(([k]) => (
                <Chip key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} size="small" color="secondary" variant="outlined" />
              ))}
            </Box>
            {tf.foodNumberOfDays && <Typography variant="caption" color="text.secondary">Duration: {tf.foodNumberOfDays} days</Typography>}
          </>
        )}

        {/* Baggage */}
        {reqs.baggage && tf.baggageRequired === 'yes' && (
          <>
            <SectionTitle>Baggage</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <Row label="Cabin Bag" value={tf.baggageCabinBag ? 'Yes' : null} />
              <Row label="No. of Check-in Bags" value={tf.baggageCheckIn} />
              <Row label="Weight" value={tf.baggageWeight} />
              <Row label="Notes" value={tf.baggageNotes} />
            </TableBody></Table></TableContainer>
          </>
        )}

        {/* Accompanying */}
        {reqs.accompanying && tf.accompanying === 'yes' && (
          <>
            <SectionTitle>Anyone Accompanying</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <Row label="Name(s)" value={tf.accompanyingNames} />
            </TableBody></Table></TableContainer>
          </>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>My Travel Requests</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        View and track your submitted travel requests
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : requests.length === 0 ? (
        <Alert severity="info">You have no submitted travel requests yet.</Alert>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Request ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Trip</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Submitted</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>L1 Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req.id} hover>
                      <TableCell>#{req.id}</TableCell>
                      <TableCell>{getTripSummary(req.travel_form_data)}</TableCell>
                      <TableCell>{new Date(req.created_at).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell>
                        {req.l1_approval_status === 'approved'
                          ? <Chip label="L1 Approved" color="success" size="small" icon={<CheckCircle />} />
                          : req.l1_approval_status === 'rejected'
                          ? <Chip label="L1 Rejected" color="error" size="small" />
                          : <Chip label="Pending L1" color="warning" size="small" />}
                      </TableCell>
                      <TableCell>
                        <Button size="small" startIcon={<Visibility />} onClick={() => handleView(req.id)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* View Details Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Travel Request Details — #{selected?.id}</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <>
              {renderDetails(selected.travel_form_data)}
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Submitted: {fmt(selected.created_at)}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyTravelRequests;
