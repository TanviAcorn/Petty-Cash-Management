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
    if (!travelData) return null;

    const isInternational = travelData.travelType === 'international';

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Travel Details
        </Typography>
        
        {/* Basic Travel Information */}
        <TableContainer component={Box} sx={{ mb: 3 }}>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: '30%', bgcolor: 'action.hover' }}>
                  Travel Type
                </TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>
                  {travelData.travelType || '-'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                  Reason for Travel
                </TableCell>
                <TableCell>{travelData.reasonOfTravel || '-'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Destination & Dates */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Destination & Schedule
        </Typography>
        <TableContainer component={Box} sx={{ mb: 3 }}>
          <Table size="small">
            <TableBody>
              {isInternational ? (
                <>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: '30%', bgcolor: 'action.hover' }}>
                      Country
                    </TableCell>
                    <TableCell>{travelData.countryOfTravel || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                      City
                    </TableCell>
                    <TableCell>{travelData.cityOfTravel || '-'}</TableCell>
                  </TableRow>
                </>
              ) : (
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: '30%', bgcolor: 'action.hover' }}>
                    City
                  </TableCell>
                  <TableCell>{travelData.cityOfTravelDomestic || '-'}</TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                  Departure Date
                </TableCell>
                <TableCell>{formatDate(travelData.departureDate || travelData.dateOfTravel)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                  Return Date
                </TableCell>
                <TableCell>{formatDate(travelData.returnDate)}</TableCell>
              </TableRow>
              {travelData.numberOfDays && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                    Duration
                  </TableCell>
                  <TableCell>{travelData.numberOfDays} days</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Flight Details (International only) */}
        {isInternational && (travelData.preferredDepartureAirport || travelData.destinationAirport) && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Flight Information
            </Typography>
            <TableContainer component={Box} sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: '30%', bgcolor: 'action.hover' }}>
                      Departure Airport
                    </TableCell>
                    <TableCell>{travelData.preferredDepartureAirport || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                      Destination Airport
                    </TableCell>
                    <TableCell>{travelData.destinationAirport || '-'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Visa Details (International only) */}
        {isInternational && (travelData.nationality || travelData.visaType) && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Visa & Nationality
            </Typography>
            <TableContainer component={Box} sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  {travelData.nationality && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, width: '30%', bgcolor: 'action.hover' }}>
                        Nationality
                      </TableCell>
                      <TableCell>{travelData.nationality}</TableCell>
                    </TableRow>
                  )}
                  {travelData.visaType && (
                    <>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                          Visa Type
                        </TableCell>
                        <TableCell>{travelData.visaType}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                          Visa Duration
                        </TableCell>
                        <TableCell>{travelData.lengthOfVisa} days</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Domestic Travel Details */}
        {!isInternational && (travelData.departurePostcode || travelData.destinationPostcode) && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Travel Route
            </Typography>
            <TableContainer component={Box} sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: '30%', bgcolor: 'action.hover' }}>
                      Departure Postcode
                    </TableCell>
                    <TableCell>{travelData.departurePostcode || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                      Destination Postcode
                    </TableCell>
                    <TableCell>{travelData.destinationPostcode || '-'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Vehicle Details */}
        {travelData.requirements?.rentedVehicle && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Vehicle Rental
            </Typography>
            <TableContainer component={Box} sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: '30%', bgcolor: 'action.hover' }}>
                      Vehicle Type
                    </TableCell>
                    <TableCell>{travelData.vehicleType || 'Manual'}</TableCell>
                  </TableRow>
                  {travelData.pickupDate && (
                    <>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                          Pickup Date
                        </TableCell>
                        <TableCell>{formatDate(travelData.pickupDate)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                          Drop-off Date
                        </TableCell>
                        <TableCell>{formatDate(travelData.dropDate)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Accommodation Details */}
        {(travelData.requirements?.hotel || travelData.requirements?.overnightStay || travelData.placeOfStay) && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Accommodation
            </Typography>
            <TableContainer component={Box} sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  {travelData.placeOfStay && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, width: '30%', bgcolor: 'action.hover' }}>
                        Place of Stay
                      </TableCell>
                      <TableCell>{travelData.placeOfStay}</TableCell>
                    </TableRow>
                  )}
                  {travelData.stayFrom && (
                    <>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                          Check-in Date
                        </TableCell>
                        <TableCell>{formatDate(travelData.stayFrom)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                          Check-out Date
                        </TableCell>
                        <TableCell>{formatDate(travelData.stayTo)}</TableCell>
                      </TableRow>
                    </>
                  )}
                  {travelData.hotelFrom && (
                    <>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                          Hotel From
                        </TableCell>
                        <TableCell>{formatDate(travelData.hotelFrom)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                          Hotel To
                        </TableCell>
                        <TableCell>{formatDate(travelData.hotelTo)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Requirements */}
        {travelData.requirements && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Requirements
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {travelData.requirements.flights && (
                <Chip label="Flights" size="small" color="primary" />
              )}
              {travelData.requirements.visa && (
                <Chip label="Visa" size="small" color="primary" />
              )}
              {travelData.requirements.hotel && (
                <Chip label="Hotel" size="small" color="primary" />
              )}
              {travelData.requirements.food && (
                <Chip label="Food" size="small" color="primary" />
              )}
              {travelData.requirements.rentedVehicle && (
                <Chip label="Rented Vehicle" size="small" color="primary" />
              )}
              {travelData.requirements.overnightStay && (
                <Chip label="Overnight Stay" size="small" color="primary" />
              )}
            </Box>
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
              <Typography variant="h6" gutterBottom>Employee Information</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Name</Typography>
                  <Typography variant="body1">
                    {selectedRequest.employeeFirstName} {selectedRequest.employeeLastName}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Email</Typography>
                  <Typography variant="body1">{selectedRequest.employee_email}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Company</Typography>
                  <Typography variant="body1">{selectedRequest.company || '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Submitted</Typography>
                  <Typography variant="body1">{formatDate(selectedRequest.created_at)}</Typography>
                </Grid>
              </Grid>

              {renderTravelDetails(selectedRequest.travel_form_data)}

              {selectedRequest.description && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">Description</Typography>
                  <Typography variant="body1">{selectedRequest.description}</Typography>
                </Box>
              )}

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
