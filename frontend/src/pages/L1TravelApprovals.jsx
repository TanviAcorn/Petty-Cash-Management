import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
} from '@mui/material';
import { CheckCircle, Cancel, Visibility } from '@mui/icons-material';

const L1TravelApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      // If admin, fetch all pending L1 requests; otherwise filter by manager email
      const params = currentUser.role === 'Admin' 
        ? {} 
        : { managerEmail: currentUser.email };
      
      const response = await axiosClient.get('/l1-approvals', { params });
      setRequests(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (requestId) => {
    try {
      const response = await axiosClient.get(`/l1-approvals/${requestId}`);
      setSelectedRequest(response.data.data);
      setDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch request details:', error);
    }
  };

  const handleApprove = () => {
    setActionType('approve');
  };

  const handleReject = () => {
    setActionType('reject');
  };

  const handleConfirmAction = async () => {
    if (actionType === 'reject' && !reason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      if (actionType === 'approve') {
        await axiosClient.put(`/l1-approvals/${selectedRequest.id}/approve`, {
          managerEmail: currentUser.email,
          note: note.trim() || null
        });
        alert('Travel request approved successfully!');
      } else {
        await axiosClient.put(`/l1-approvals/${selectedRequest.id}/reject`, {
          managerEmail: currentUser.email,
          reason: reason.trim()
        });
        alert('Travel request rejected');
      }

      setDialogOpen(false);
      setSelectedRequest(null);
      setNote('');
      setReason('');
      setActionType('');
      fetchPendingRequests();
    } catch (error) {
      console.error('Failed to process request:', error);
      alert('Failed to process request: ' + (error.response?.data?.message || error.message));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const renderTravelDetails = (travelData) => {
    if (!travelData) return <Typography color="text.secondary" sx={{ mt: 2 }}>No travel details available.</Typography>;

    const isIntl = travelData.travelType === 'international';
    const tf = travelData;

    const SectionTitle = ({ children }) => (
      <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2.5, mb: 1, color: 'primary.main', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
        {children}
      </Typography>
    );

    const InfoRow = ({ label, value }) => value ? (
      <TableRow>
        <TableCell sx={{ fontWeight: 600, width: '35%', bgcolor: 'action.hover', py: 1, fontSize: '0.8125rem' }}>{label}</TableCell>
        <TableCell sx={{ py: 1, fontSize: '0.8125rem' }}>{value}</TableCell>
      </TableRow>
    ) : null;

    const reqs = tf.requirements || {};
    const reqLabels = { flights: 'Flights', visa: 'Visa', rentedVehicle: 'Rented Vehicle', carPark: 'Car Park', food: 'Food', overnightStay: 'Overnight Stay', baggage: 'Baggage' };
    const selectedReqs = Object.entries(reqs).filter(([, v]) => v).map(([k]) => reqLabels[k] || k);

    return (
      <Box sx={{ mt: 1 }}>

        {/* ── Employee ── */}
        <SectionTitle>Employee Information</SectionTitle>
        <TableContainer component={Box}>
          <Table size="small">
            <TableBody>
              <InfoRow label="Name" value={tf.employeeName} />
              <InfoRow label="Department" value={tf.department} />
              <InfoRow label="Company" value={tf.company} />
            </TableBody>
          </Table>
        </TableContainer>

        {/* ── Travel Type & Reason ── */}
        <SectionTitle>Travel Overview</SectionTitle>
        <TableContainer component={Box}>
          <Table size="small">
            <TableBody>
              <InfoRow label="Travel Type" value={isIntl ? 'International' : 'Domestic'} />
              {isIntl && <InfoRow label="Trip Type" value={tf.tripType === 'roundTrip' ? 'Round Trip' : tf.tripType === 'multiCity' ? 'Multi-City' : 'One Way'} />}
              {isIntl && <InfoRow label="Country" value={tf.countryOfTravel} />}
              {!isIntl && <InfoRow label="City of Travel" value={tf.cityOfTravelDomestic} />}
              {!isIntl && <InfoRow label="Date of Travel" value={formatDate(tf.dateOfTravel)} />}
              {!isIntl && <InfoRow label="Departure Postcode" value={tf.departurePostcode} />}
              {!isIntl && <InfoRow label="Destination Postcode" value={tf.destinationPostcode} />}
              <InfoRow label="Reason for Travel" value={tf.reasonOfTravel} />
              {tf.remarks && <InfoRow label="Remarks" value={tf.remarks} />}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ── Round Trip ── */}
        {isIntl && tf.tripType === 'roundTrip' && tf.roundTrip && (
          <>
            <SectionTitle>Round Trip Details</SectionTitle>
            <TableContainer component={Box}>
              <Table size="small">
                <TableBody>
                  <InfoRow label="From City" value={tf.roundTrip.fromCity} />
                  <InfoRow label="To City" value={tf.roundTrip.toCity} />
                  <InfoRow label="Departure Date" value={tf.roundTrip.departureDate || 'Flexible'} />
                  <InfoRow label="Return Date" value={tf.roundTrip.arrivalDate || 'Flexible'} />
                  {tf.roundTrip.needsHotel && <>
                    <InfoRow label="Hotel Check-in" value={formatDate(tf.roundTrip.hotelFrom)} />
                    <InfoRow label="Hotel Check-out" value={formatDate(tf.roundTrip.hotelTo)} />
                    <InfoRow label="Hotel Days" value={tf.roundTrip.hotelDays} />
                  </>}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* ── Multi-City ── */}
        {isIntl && tf.tripType === 'multiCity' && tf.multiCityLegs?.length > 0 && (
          <>
            <SectionTitle>Multi-City Legs</SectionTitle>
            {tf.multiCityLegs.map((leg, i) => (
              <Box key={i} sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Leg {i + 1}</Typography>
                <TableContainer component={Box}>
                  <Table size="small">
                    <TableBody>
                      <InfoRow label="From City" value={leg.fromCity} />
                      <InfoRow label="To City" value={leg.toCity} />
                      <InfoRow label="Date" value={leg.date || 'Flexible'} />
                      {leg.needsHotel && <>
                        <InfoRow label="Hotel Check-in" value={formatDate(leg.hotelFrom)} />
                        <InfoRow label="Hotel Check-out" value={formatDate(leg.hotelTo)} />
                        <InfoRow label="Hotel Days" value={leg.hotelDays} />
                      </>}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))}
          </>
        )}

        {/* ── Domestic Hotel ── */}
        {!isIntl && tf.domesticHotel?.needsHotel && (
          <>
            <SectionTitle>Hotel / Accommodation</SectionTitle>
            <TableContainer component={Box}>
              <Table size="small">
                <TableBody>
                  <InfoRow label="Check-in" value={formatDate(tf.domesticHotel.hotelFrom)} />
                  <InfoRow label="Check-out" value={formatDate(tf.domesticHotel.hotelTo)} />
                  <InfoRow label="No. of Days" value={tf.domesticHotel.hotelDays} />
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* ── Requirements ── */}
        {selectedReqs.length > 0 && (
          <>
            <SectionTitle>Travel Requirements</SectionTitle>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {selectedReqs.map(r => <Chip key={r} label={r} size="small" color="primary" variant="outlined" />)}
            </Box>
          </>
        )}

        {/* ── Flights ── */}
        {reqs.flights && tf.preferredDepartureAirport && (
          <>
            <SectionTitle>Flight Details</SectionTitle>
            <TableContainer component={Box}>
              <Table size="small">
                <TableBody>
                  <InfoRow label="Preferred Departure Airport" value={tf.preferredDepartureAirport} />
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* ── Visa ── */}
        {reqs.visa && tf.visaRequired === 'yes' && (
          <>
            <SectionTitle>Visa Details</SectionTitle>
            <TableContainer component={Box}>
              <Table size="small">
                <TableBody>
                  <InfoRow label="Nationality" value={tf.nationality} />
                  <InfoRow label="Visa Type" value={tf.visaType} />
                  <InfoRow label="Length of Visa" value={tf.lengthOfVisa} />
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* ── Rented Vehicle ── */}
        {reqs.rentedVehicle && (
          <>
            <SectionTitle>Rented Vehicle</SectionTitle>
            <TableContainer component={Box}>
              <Table size="small">
                <TableBody>
                  <InfoRow label="Pick-up Point" value={tf.pickupPoint} />
                  <InfoRow label="Drop-off Point" value={tf.dropOffPoint} />
                  <InfoRow label="Vehicle Type" value={tf.vehicleType} />
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* ── Car Park ── */}
        {reqs.carPark && tf.carParkRequired === 'yes' && (
          <>
            <SectionTitle>Car Park</SectionTitle>
            <TableContainer component={Box}>
              <Table size="small">
                <TableBody>
                  <InfoRow label="Duration" value={tf.carParkDuration} />
                  <InfoRow label="Vehicle Number" value={tf.carParkVehicleNumber} />
                  <InfoRow label="Car Color" value={tf.carParkCarColor} />
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* ── Food ── */}
        {reqs.food && tf.foodOptions && (
          <>
            <SectionTitle>Food Preferences</SectionTitle>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {Object.entries(tf.foodOptions).filter(([, v]) => v).map(([k]) => (
                <Chip key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} size="small" color="secondary" variant="outlined" />
              ))}
            </Box>
            {tf.foodNumberOfDays && <Typography variant="caption" color="text.secondary">Duration: {tf.foodNumberOfDays} days</Typography>}
          </>
        )}

        {/* ── Baggage ── */}
        {reqs.baggage && tf.baggageRequired === 'yes' && (
          <>
            <SectionTitle>Baggage</SectionTitle>
            <TableContainer component={Box}>
              <Table size="small">
                <TableBody>
                  <InfoRow label="No. of Bags" value={tf.baggageCount} />
                  <InfoRow label="Dimension" value={tf.baggageDimension} />
                  <InfoRow label="Weight" value={tf.baggageWeight} />
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Travel Request Approvals
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review and approve travel requests from your team
      </Typography>

      {requests.length === 0 && !loading && (
        <Alert severity="info">No pending travel requests for approval</Alert>
      )}

      {requests.length > 0 && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell>Request ID</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell>Travel Type</TableCell>
                    <TableCell>Departure Date</TableCell>
                    <TableCell>Submitted</TableCell>
                    <TableCell>L1 Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request) => {
                    const travelData = request.travel_form_data;
                    const isL1Approved = request.l1_approval_status === 'approved';
                    return (
                      <TableRow key={request.id} hover>
                        <TableCell>{request.id}</TableCell>
                        <TableCell>
                          {request.employeeFirstName} {request.employeeLastName}
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            {request.employee_email}
                          </Typography>
                        </TableCell>
                        <TableCell>{travelData?.travelType || 'Travel Request'}</TableCell>
                        <TableCell>{formatDate(travelData?.departureDate)}</TableCell>
                        <TableCell>{formatDate(request.created_at)}</TableCell>
                        <TableCell>
                          {isL1Approved ? (
                            <Chip label="L1 Approved" color="success" size="small" />
                          ) : (
                            <Chip label="Pending L1" color="warning" size="small" />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            startIcon={<Visibility />}
                            onClick={() => handleViewDetails(request.id)}
                          >
                            Review
                          </Button>
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

      {/* Review Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Travel Request Review - ID: {selectedRequest?.id}
        </DialogTitle>
        <DialogContent dividers>
          {selectedRequest && (
            <>
              {renderTravelDetails(selectedRequest.travel_form_data)}

              {/* Submitted date */}
              <Box sx={{ mt: 1, mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Submitted: {formatDate(selectedRequest.created_at)} &nbsp;|&nbsp; Email: {selectedRequest.employee_email}</Typography>
              </Box>

              {!actionType && (
                <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={handleApprove}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={handleReject}
                  >
                    Reject
                  </Button>
                </Box>
              )}

              {actionType === 'approve' && (
                <Box sx={{ mt: 3 }}>
                  <TextField
                    fullWidth
                    label="Note (Optional)"
                    multiline
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add any comments or notes..."
                  />
                </Box>
              )}

              {actionType === 'reject' && (
                <Box sx={{ mt: 3 }}>
                  <TextField
                    fullWidth
                    label="Rejection Reason *"
                    multiline
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                    required
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDialogOpen(false);
            setActionType('');
            setNote('');
            setReason('');
          }}>
            Cancel
          </Button>
          {actionType && (
            <Button
              variant="contained"
              color={actionType === 'approve' ? 'success' : 'error'}
              onClick={handleConfirmAction}
            >
              Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default L1TravelApprovals;
