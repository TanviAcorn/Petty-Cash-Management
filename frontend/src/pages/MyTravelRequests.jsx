import { useState, useEffect } from 'react';
import axiosClient, { getFileUrl } from '../api/axiosClient';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button, CircularProgress,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Tooltip,
} from '@mui/material';
import { Visibility, CheckCircle, InsertDriveFile, Cancel, FlightTakeoff } from '@mui/icons-material';

const MyTravelRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Cancel flight dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelAlert, setCancelAlert] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchRequests = () => {
    if (!currentUser.email) return;
    axiosClient.get('/l1-approvals/my-travel-requests', { params: { email: currentUser.email } })
      .then(res => setRequests(res.data.data || []))
      .catch(err => console.error('Failed to fetch travel requests:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleView = async (id) => {
    try {
      const res = await axiosClient.get(`/l1-approvals/${id}`);
      setSelected(res.data.data);
      setDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch request details:', err);
    }
  };

  const openCancelDialog = (req) => {
    setCancelTarget(req);
    setCancelReason('');
    setCancelAlert(null);
    setCancelDialogOpen(true);
  };

  const handleSubmitCancellation = async () => {
    if (!cancelReason.trim()) {
      setCancelAlert({ type: 'error', msg: 'Please provide a reason for cancellation.' });
      return;
    }
    if (cancelReason.trim().split(/\s+/).filter(Boolean).length < 5) {
      setCancelAlert({ type: 'error', msg: 'Please provide at least 5 words explaining the reason.' });
      return;
    }
    setCancelSubmitting(true);
    setCancelAlert(null);
    try {
      await axiosClient.post(`/l1-approvals/${cancelTarget.id}/request-cancellation`, {
        reason: cancelReason.trim(),
        employeeEmail: currentUser.email,
      });
      setCancelAlert({ type: 'success', msg: 'Cancellation request submitted. Your L1 manager has been notified.' });
      setTimeout(() => {
        setCancelDialogOpen(false);
        fetchRequests();
      }, 2000);
    } catch (err) {
      setCancelAlert({ type: 'error', msg: err.response?.data?.message || 'Failed to submit cancellation request.' });
    } finally {
      setCancelSubmitting(false);
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

  // Determine if Cancel Flight button should be shown/enabled for a request
  const getCancelState = (req) => {
    // Only show for L1-approved requests
    if (req.l1_approval_status !== 'approved') return { show: false };
    if (req.cancellation_status === 'approved' || req.status === 'cancelled') {
      return { show: true, disabled: true, label: 'Cancelled', color: 'error' };
    }
    if (req.cancellation_status === 'pending') {
      return { show: true, disabled: true, label: 'Cancellation Pending', color: 'warning' };
    }
    if (req.cancellation_status === 'rejected') {
      return { show: true, disabled: false, label: 'Re-request Cancellation', color: 'error' };
    }
    return { show: true, disabled: false, label: 'Cancel Flight', color: 'error' };
  };

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
        <SectionTitle>Employee Information</SectionTitle>
        <TableContainer component={Box}><Table size="small"><TableBody>
          <Row label="Name" value={tf.employeeName} />
          <Row label="Department" value={tf.department} />
          <Row label="Company" value={tf.company} />
        </TableBody></Table></TableContainer>

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

        {isIntl && tf.tripType === 'roundTrip' && tf.roundTrip && (
          <>
            <SectionTitle>Round Trip Details</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <Row label="From City" value={tf.roundTrip.fromCity} />
              <Row label="To City" value={tf.roundTrip.toCity} />
              {tf.roundTrip.departureDateFlexFrom
                ? <><Row label="Flexible Departure From" value={fmt(tf.roundTrip.departureDateFlexFrom)} /><Row label="Flexible Departure To" value={fmt(tf.roundTrip.departureDateFlexTo)} /></>
                : <Row label="Departure Date" value={fmt(tf.roundTrip.departureDate) || 'Flexible'} />}
              {tf.roundTrip.arrivalDateFlexFrom
                ? <><Row label="Flexible Return From" value={fmt(tf.roundTrip.arrivalDateFlexFrom)} /><Row label="Flexible Return To" value={fmt(tf.roundTrip.arrivalDateFlexTo)} /></>
                : <Row label="Return Date" value={fmt(tf.roundTrip.arrivalDate) || 'Flexible'} />}
              {tf.roundTrip.needsHotel && <>
                <Row label="Hotel Check-in" value={fmt(tf.roundTrip.hotelFrom)} />
                <Row label="Hotel Check-out" value={fmt(tf.roundTrip.hotelTo)} />
                <Row label="Hotel Nights" value={tf.roundTrip.hotelDays} />
              </>}
            </TableBody></Table></TableContainer>
          </>
        )}

        {isIntl && tf.tripType === 'oneWay' && tf.roundTrip && (
          <>
            <SectionTitle>One-Way Details</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <Row label="From City" value={tf.roundTrip.fromCity} />
              <Row label="To City" value={tf.roundTrip.toCity} />
              {tf.roundTrip.departureDateFlexFrom
                ? <><Row label="Flexible Departure From" value={fmt(tf.roundTrip.departureDateFlexFrom)} /><Row label="Flexible Departure To" value={fmt(tf.roundTrip.departureDateFlexTo)} /></>
                : <Row label="Departure Date" value={fmt(tf.roundTrip.departureDate) || 'Flexible'} />}
              {tf.roundTrip.needsHotel && <>
                <Row label="Hotel Check-in" value={fmt(tf.roundTrip.hotelFrom)} />
                <Row label="Hotel Check-out" value={fmt(tf.roundTrip.hotelTo)} />
              </>}
            </TableBody></Table></TableContainer>
          </>
        )}

        {isIntl && tf.tripType === 'multiCity' && tf.multiCityLegs?.length > 0 && (
          <>
            <SectionTitle>Multi-City Legs</SectionTitle>
            {tf.multiCityLegs.map((leg, i) => (
              <Box key={i} sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Leg {i + 1}</Typography>
                <TableContainer component={Box}><Table size="small"><TableBody>
                  <Row label="From City" value={leg.fromCity} />
                  <Row label="To City" value={leg.toCity} />
                  {leg.dateFlexFrom
                    ? <><Row label="Flexible Date From" value={fmt(leg.dateFlexFrom)} /><Row label="Flexible Date To" value={fmt(leg.dateFlexTo)} /></>
                    : <Row label="Date" value={fmt(leg.date) || 'Flexible'} />}
                  {leg.needsHotel && <>
                    <Row label="Hotel Check-in" value={fmt(leg.hotelFrom)} />
                    <Row label="Hotel Check-out" value={fmt(leg.hotelTo)} />
                  </>}
                </TableBody></Table></TableContainer>
              </Box>
            ))}
          </>
        )}

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

        {selectedReqs.length > 0 && (
          <>
            <SectionTitle>Travel Requirements</SectionTitle>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {selectedReqs.map(r => <Chip key={r} label={r} size="small" color="primary" variant="outlined" />)}
            </Box>
          </>
        )}

        {reqs.visa && (
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

        {reqs.rentedVehicle && (
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

        {reqs.carPark && (
          <>
            <SectionTitle>Airport Car Park</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <Row label="Vehicle Number" value={tf.carParkVehicleNumber} />
              <Row label="Car Color" value={tf.carParkCarColor} />
              <Row label="Duration" value={tf.carParkDuration} />
            </TableBody></Table></TableContainer>
          </>
        )}

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

        {reqs.baggage && (
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

        {reqs.accompanying && (
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
                    <TableCell sx={{ fontWeight: 600 }}>Cancellation</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map(req => {
                    const cancelState = getCancelState(req);
                    return (
                      <TableRow key={req.id} hover>
                        <TableCell>#{req.id}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <FlightTakeoff sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2">{getTripSummary(req.travel_form_data)}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{new Date(req.created_at).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>
                          {req.l1_approval_status === 'approved'
                            ? <Chip label="L1 Approved" color="success" size="small" icon={<CheckCircle />} />
                            : req.l1_approval_status === 'rejected'
                            ? <Chip label="L1 Rejected" color="error" size="small" />
                            : <Chip label="Pending L1" color="warning" size="small" />}
                        </TableCell>
                        <TableCell>
                          {req.cancellation_status === 'approved' || req.status === 'cancelled'
                            ? <Chip label="Cancelled" color="error" size="small" />
                            : req.cancellation_status === 'pending'
                            ? <Chip label="Cancellation Pending" color="warning" size="small" />
                            : req.cancellation_status === 'rejected'
                            ? <Chip label="Cancellation Rejected" color="default" size="small" />
                            : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                              size="small"
                              startIcon={<Visibility />}
                              onClick={() => handleView(req.id)}
                              variant="outlined"
                            >
                              View
                            </Button>
                            {cancelState.show && (
                              <Tooltip
                                title={
                                  cancelState.disabled
                                    ? cancelState.label
                                    : 'Request cancellation of this travel booking'
                                }
                                arrow
                              >
                                <span>
                                  <Button
                                    size="small"
                                    startIcon={<Cancel />}
                                    color={cancelState.color || 'error'}
                                    variant={cancelState.disabled ? 'outlined' : 'contained'}
                                    disabled={cancelState.disabled}
                                    onClick={() => openCancelDialog(req)}
                                  >
                                    {cancelState.label || 'Cancel Flight'}
                                  </Button>
                                </span>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* ── View Details Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Travel Request Details — #{selected?.id}</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <>
              {renderDetails(selected.travel_form_data)}

              {(() => {
                const attachments = Array.isArray(selected.attachments) ? selected.attachments : [];
                if (attachments.length === 0) return null;
                return (
                  <Box sx={{ mt: 2.5 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: 'primary.main', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                      Attachments ({attachments.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {attachments.map((item, i) => {
                        const filename = typeof item === 'string' ? item : (item?.filename || item?.originalName || String(item));
                        const displayName = typeof item === 'string'
                          ? filename.replace(/^\d+-\d+-/, '')
                          : (item?.originalName || filename.replace(/^\d+-\d+-/, ''));
                        const fileUrl = item?.fileUrl || getFileUrl(filename);
                        const isImage = /\.(jpg|jpeg|png|gif|webp|PNG|JPG|JPEG)$/i.test(filename);
                        const isPdf = /\.pdf$/i.test(filename);
                        return (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                            <InsertDriveFile sx={{ color: isPdf ? 'error.main' : isImage ? 'primary.main' : 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-all', fontSize: '0.8125rem' }}>{displayName}</Typography>
                            <Button size="small" variant="outlined" href={fileUrl} target="_blank" rel="noopener noreferrer" sx={{ flexShrink: 0, textTransform: 'none', fontSize: '0.75rem' }}>
                              {isImage ? 'View' : 'Open'}
                            </Button>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })()}

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">Submitted: {fmt(selected.created_at)}</Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Cancel Flight Dialog ────────────────────────────────────────── */}
      <Dialog open={cancelDialogOpen} onClose={() => !cancelSubmitting && setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Cancel color="error" />
          <Box>
            <Typography variant="h6" fontWeight={700}>Request Flight Cancellation</Typography>
            {cancelTarget && (
              <Typography variant="caption" color="text.secondary">
                Trip #{cancelTarget.id} — {getTripSummary(cancelTarget.travel_form_data)}
              </Typography>
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {cancelAlert && (
            <Alert severity={cancelAlert.type} sx={{ mb: 2 }}>{cancelAlert.msg}</Alert>
          )}
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will send a cancellation request to your L1 manager for approval. Once approved, it will be forwarded to admin for refund processing.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Reason for Cancellation *"
            placeholder="Please explain why you need to cancel this travel booking (e.g. meeting cancelled, personal emergency, etc.)..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            disabled={cancelSubmitting}
            helperText={`${cancelReason.trim().split(/\s+/).filter(Boolean).length} words — minimum 5 required`}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={cancelSubmitting}>
            Close
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<Cancel />}
            onClick={handleSubmitCancellation}
            disabled={cancelSubmitting || !cancelReason.trim()}
          >
            {cancelSubmitting ? 'Submitting...' : 'Submit Cancellation Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyTravelRequests;
