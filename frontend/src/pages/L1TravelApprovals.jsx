import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, Alert, Divider,
  IconButton, LinearProgress,
} from '@mui/material';
import {
  CheckCircle, Cancel, Visibility, CloudUpload, Delete, AttachFile,
} from '@mui/icons-material';

const L1TravelApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadRequest, setUploadRequest] = useState(null);
  const [sectionFiles, setSectionFiles] = useState({});   // { sectionKey: File[] }
  const [sectionDetails, setSectionDetails] = useState({}); // { sectionKey: { fieldKey: value } }
  const [globalFiles, setGlobalFiles] = useState([]);
  const [globalRemarks, setGlobalRemarks] = useState('');
  const [uploadSending, setUploadSending] = useState(false);
  const [uploadAlert, setUploadAlert] = useState(null);
  const globalFileRef = useRef();

  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => { fetchPendingRequests(); }, []);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const params = currentUser.role === 'Admin' ? {} : { managerEmail: currentUser.email };
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

  const handleApprove = () => setActionType('approve');
  const handleReject = () => setActionType('reject');

  const handleConfirmAction = async () => {
    if (actionType === 'reject' && !reason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    try {
      if (actionType === 'approve') {
        await axiosClient.put(`/l1-approvals/${selectedRequest.id}/approve`, {
          managerEmail: currentUser.email,
          note: note.trim() || null,
        });
        alert('Travel request approved successfully!');
      } else {
        await axiosClient.put(`/l1-approvals/${selectedRequest.id}/reject`, {
          managerEmail: currentUser.email,
          reason: reason.trim(),
        });
        alert('Travel request rejected');
      }
      setDialogOpen(false);
      setSelectedRequest(null);
      setNote(''); setReason(''); setActionType('');
      fetchPendingRequests();
    } catch (error) {
      alert('Failed to process request: ' + (error.response?.data?.message || error.message));
    }
  };

  // ── Upload Travel Details helpers ──────────────────────────────────────────

  const SECTION_CONFIG = {
    flights: {
      label: 'Flight Details',
      fields: [
        { key: 'airline', label: 'Airline' },
        { key: 'flightNumber', label: 'Flight Number' },
        { key: 'bookingRef', label: 'Booking Reference' },
        { key: 'departureAirport', label: 'Departure Airport' },
        { key: 'arrivalAirport', label: 'Arrival Airport' },
        { key: 'departureTerminal', label: 'Departure Terminal' },
        { key: 'departureTime', label: 'Departure Date & Time' },
        { key: 'arrivalTime', label: 'Arrival Date & Time' },
        { key: 'seatNumber', label: 'Seat Number' },
        { key: 'baggageAllowanceFlight', label: 'Baggage Allowance' },
      ],
    },
    hotel: {
      label: 'Hotel / Accommodation',
      fields: [
        { key: 'hotelName', label: 'Hotel Name' },
        { key: 'hotelAddress', label: 'Address' },
        { key: 'roomNumber', label: 'Room Number' },
        { key: 'roomType', label: 'Room Type' },
        { key: 'confirmationNumber', label: 'Confirmation Number' },
        { key: 'checkIn', label: 'Check-in Date' },
        { key: 'checkOut', label: 'Check-out Date' },
        { key: 'hotelPhone', label: 'Hotel Phone Number' },
      ],
    },
    visa: {
      label: 'Visa Details',
      fields: [
        { key: 'visaNumber', label: 'Visa Number' },
        { key: 'visaIssueDate', label: 'Issue Date' },
        { key: 'visaExpiryDate', label: 'Expiry Date' },
        { key: 'visaType', label: 'Visa Type' },
        { key: 'visaIssuingCountry', label: 'Issuing Country' },
      ],
    },
    carPark: {
      label: 'Car Park',
      fields: [
        { key: 'carParkName', label: 'Car Park Name' },
        { key: 'carParkLocation', label: 'Location / Address' },
        { key: 'bayNumber', label: 'Bay / Space Number' },
        { key: 'carParkBookingRef', label: 'Booking Reference' },
        { key: 'carParkEntryDate', label: 'Entry Date' },
        { key: 'carParkExitDate', label: 'Exit Date' },
        { key: 'carParkCost', label: 'Total Cost (£)' },
      ],
    },
    food: {
      label: 'Food / Meals',
      fields: [
        { key: 'venue', label: 'Restaurant / Venue' },
        { key: 'mealAllowance', label: 'Daily Meal Allowance (£)' },
        { key: 'totalMealBudget', label: 'Total Meal Budget (£)' },
        { key: 'foodNotes', label: 'Additional Notes' },
      ],
    },
    baggage: {
      label: 'Baggage',
      fields: [
        { key: 'baggageAllowance', label: 'Baggage Allowance' },
        { key: 'baggageBookingRef', label: 'Booking Reference' },
        { key: 'baggageWeight', label: 'Max Weight (kg)' },
        { key: 'baggageNotes', label: 'Notes' },
      ],
    },
    rentedVehicle: {
      label: 'Rented Vehicle',
      fields: [
        { key: 'rentalCompany', label: 'Rental Company' },
        { key: 'vehicleReg', label: 'Vehicle Registration' },
        { key: 'vehicleModel', label: 'Vehicle Make / Model' },
        { key: 'pickupAddress', label: 'Pick-up Address' },
        { key: 'pickupDateTime', label: 'Pick-up Date & Time' },
        { key: 'dropoffAddress', label: 'Drop-off Address' },
        { key: 'dropoffDateTime', label: 'Drop-off Date & Time' },
        { key: 'rentalBookingRef', label: 'Booking Reference' },
        { key: 'rentalCost', label: 'Total Cost (£)' },
      ],
    },
  };

  const getActiveSections = (travelData) => {
    if (!travelData) return [];
    const reqs = travelData.requirements || {};
    const active = [];

    // Flights — show for any international trip, or if explicitly requested
    const isIntl = travelData.travelType === 'international';
    if (isIntl || reqs.flights) active.push('flights');

    // Hotel — show if any leg has hotel, or overnightStay requirement
    const hasHotel =
      travelData.roundTrip?.needsHotel ||
      travelData.multiCityLegs?.some((l) => l.needsHotel) ||
      travelData.domesticHotel?.needsHotel ||
      reqs.overnightStay;
    if (hasHotel) active.push('hotel');

    // Visa
    if (reqs.visa || travelData.visaRequired === 'yes') active.push('visa');

    // Car Park
    if (reqs.carPark || travelData.carParkRequired === 'yes') active.push('carPark');

    // Food
    if (reqs.food) active.push('food');

    // Baggage
    if (reqs.baggage || travelData.baggageRequired === 'yes') active.push('baggage');

    // Rented Vehicle
    if (reqs.rentedVehicle) active.push('rentedVehicle');

    return active;
  };

  const openUploadDialog = async (request) => {
    setUploadRequest(request);
    setSectionFiles({});
    setGlobalFiles([]);
    setUploadAlert(null);

    // Load existing draft if any
    try {
      const res = await axiosClient.get(`/travel-documents/${request.id}/draft`);
      const draft = res.data?.data;
      if (draft) {
        setSectionDetails(draft.details || {});
        setGlobalRemarks(draft.globalRemarks || '');
      } else {
        setSectionDetails({});
        setGlobalRemarks('');
      }
    } catch {
      setSectionDetails({});
      setGlobalRemarks('');
    }

    setUploadOpen(true);
  };

  const saveDraft = async () => {
    if (!uploadRequest) return;
    try {
      await axiosClient.post(`/travel-documents/${uploadRequest.id}/save-details`, {
        details: sectionDetails,
        globalRemarks: globalRemarks.trim() || null,
        uploadedBy: currentUser.email,
        isDraft: true,
      });
    } catch (err) {
      console.error('Draft save failed:', err);
    }
  };

  const handleSectionDetailChange = (section, field, value) => {
    setSectionDetails((prev) => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [field]: value },
    }));
  };

  const handleSectionFileAdd = (section, files) => {
    setSectionFiles((prev) => ({
      ...prev,
      [section]: [...(prev[section] || []), ...Array.from(files)],
    }));
  };

  const handleSectionFileRemove = (section, idx) => {
    setSectionFiles((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== idx),
    }));
  };

  const handleGlobalFileAdd = (files) => {
    setGlobalFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const handleGlobalFileRemove = (idx) => {
    setGlobalFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Required fields per section — at least these must be filled to enable Send
  const REQUIRED_FIELDS = {
    flights:      ['airline', 'flightNumber', 'bookingRef'],
    hotel:        ['hotelName', 'hotelAddress', 'confirmationNumber'],
    visa:         ['visaNumber', 'visaExpiryDate'],
    carPark:      ['carParkLocation', 'carParkBookingRef'],
    food:         ['venue'],
    baggage:      ['baggageAllowance'],
    rentedVehicle:['rentalCompany', 'vehicleReg', 'pickupAddress'],
    overnightStay:['stayLocation'],
  };

  const isAllSectionsFilled = () => {
    if (!uploadRequest) return false;
    const td = uploadRequest.travel_form_data;
    const sections = getActiveSections(td);
    if (sections.length === 0) return globalRemarks.trim().length > 0 || globalFiles.length > 0;

    return sections.every((sectionKey) => {
      const required = REQUIRED_FIELDS[sectionKey] || [];
      if (required.length === 0) return true;
      const filled = sectionDetails[sectionKey] || {};
      return required.every((f) => filled[f]?.trim());
    });
  };

  const handleSendTravelDetails = async () => {
    if (!uploadRequest) return;
    setUploadSending(true);
    setUploadAlert(null);
    try {
      const requestId = uploadRequest.id;

      // 1. Save text details
      await axiosClient.post(`/travel-documents/${requestId}/save-details`, {
        details: sectionDetails,
        globalRemarks: globalRemarks.trim() || null,
        uploadedBy: currentUser.email,
      });

      // 2. Upload section files
      for (const [section, files] of Object.entries(sectionFiles)) {
        if (!files?.length) continue;
        const fd = new FormData();
        files.forEach((f) => fd.append('documents', f));
        fd.append('uploadedBy', currentUser.email);
        fd.append('docType', section);
        await axiosClient.post(`/travel-documents/${requestId}/upload`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 3. Upload global files
      if (globalFiles.length > 0) {
        const fd = new FormData();
        globalFiles.forEach((f) => fd.append('documents', f));
        fd.append('uploadedBy', currentUser.email);
        fd.append('docType', 'general');
        await axiosClient.post(`/travel-documents/${requestId}/upload`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 4. Send email to user
      await axiosClient.post(`/travel-documents/${requestId}/send`);

      setUploadAlert({ type: 'success', msg: 'Travel details saved and emailed to the employee.' });
      setTimeout(() => setUploadOpen(false), 2000);
    } catch (err) {
      setUploadAlert({ type: 'error', msg: err.response?.data?.message || 'Failed to send travel details.' });
    } finally {
      setUploadSending(false);
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
        <SectionTitle>Employee Information</SectionTitle>
        <TableContainer component={Box}><Table size="small"><TableBody>
          <InfoRow label="Name" value={tf.employeeName} />
          <InfoRow label="Department" value={tf.department} />
          <InfoRow label="Company" value={tf.company} />
        </TableBody></Table></TableContainer>

        <SectionTitle>Travel Overview</SectionTitle>
        <TableContainer component={Box}><Table size="small"><TableBody>
          <InfoRow label="Travel Type" value={isIntl ? 'International' : 'Domestic'} />
          {isIntl && <InfoRow label="Trip Type" value={tf.tripType === 'roundTrip' ? 'Round Trip' : tf.tripType === 'multiCity' ? 'Multi-City' : 'One Way'} />}
          {isIntl && <InfoRow label="Country" value={tf.countryOfTravel} />}
          {!isIntl && <InfoRow label="City of Travel" value={tf.cityOfTravelDomestic} />}
          {!isIntl && (
            tf.domesticDateFlex
              ? <>
                  <InfoRow label="Travel Date (From)" value={tf.domesticDateFlexFrom || '—'} />
                  <InfoRow label="Travel Date (To)" value={tf.domesticDateFlexTo || '—'} />
                </>
              : <InfoRow label="Date of Travel" value={formatDate(tf.dateOfTravel)} />
          )}
          {!isIntl && <InfoRow label="Departure Postcode" value={tf.departurePostcode} />}
          {!isIntl && <InfoRow label="Destination Postcode" value={tf.destinationPostcode} />}
          <InfoRow label="Reason for Travel" value={tf.reasonOfTravel} />
          {tf.remarks && <InfoRow label="Remarks" value={tf.remarks} />}
        </TableBody></Table></TableContainer>

        {isIntl && tf.tripType === 'roundTrip' && tf.roundTrip && (
          <>
            <SectionTitle>Round Trip Details</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <InfoRow label="From City" value={tf.roundTrip.fromCity} />
              <InfoRow label="To City" value={tf.roundTrip.toCity} />
              <InfoRow label="Departure Date" value={tf.roundTrip.departureDate || 'Flexible'} />
              <InfoRow label="Return Date" value={tf.roundTrip.arrivalDate || 'Flexible'} />
              {tf.roundTrip.needsHotel && <>
                <InfoRow label="Hotel Check-in" value={formatDate(tf.roundTrip.hotelFrom)} />
                <InfoRow label="Hotel Check-out" value={formatDate(tf.roundTrip.hotelTo)} />
                <InfoRow label="Hotel Days" value={tf.roundTrip.hotelDays} />
              </>}
            </TableBody></Table></TableContainer>
          </>
        )}

        {isIntl && tf.tripType === 'multiCity' && tf.multiCityLegs?.length > 0 && (
          <>
            <SectionTitle>Multi-City Legs</SectionTitle>
            {tf.multiCityLegs.map((leg, i) => (
              <Box key={i} sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Leg {i + 1}</Typography>
                <TableContainer component={Box}><Table size="small"><TableBody>
                  <InfoRow label="From City" value={leg.fromCity} />
                  <InfoRow label="To City" value={leg.toCity} />
                  <InfoRow label="Date" value={leg.date || 'Flexible'} />
                  {leg.needsHotel && <>
                    <InfoRow label="Hotel Check-in" value={formatDate(leg.hotelFrom)} />
                    <InfoRow label="Hotel Check-out" value={formatDate(leg.hotelTo)} />
                    <InfoRow label="Hotel Days" value={leg.hotelDays} />
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
              <InfoRow label="Check-in" value={formatDate(tf.domesticHotel.hotelFrom)} />
              <InfoRow label="Check-out" value={formatDate(tf.domesticHotel.hotelTo)} />
              <InfoRow label="No. of Days" value={tf.domesticHotel.hotelDays} />
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

        {reqs.flights && tf.preferredDepartureAirport && (
          <>
            <SectionTitle>Flight Details</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <InfoRow label="Preferred Departure Airport" value={tf.preferredDepartureAirport} />
            </TableBody></Table></TableContainer>
          </>
        )}

        {reqs.visa && tf.visaRequired === 'yes' && (
          <>
            <SectionTitle>Visa Details</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <InfoRow label="Nationality" value={tf.nationality} />
              <InfoRow label="Visa Type" value={tf.visaType} />
            </TableBody></Table></TableContainer>
          </>
        )}

        {reqs.rentedVehicle && (
          <>
            <SectionTitle>Rented Vehicle</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <InfoRow label="Pick-up Point" value={tf.pickupPoint} />
              <InfoRow label="Drop-off Point" value={tf.dropOffPoint} />
              <InfoRow label="Vehicle Type" value={tf.vehicleType} />
            </TableBody></Table></TableContainer>
          </>
        )}

        {reqs.carPark && tf.carParkRequired === 'yes' && (
          <>
            <SectionTitle>Car Park</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <InfoRow label="Vehicle Number" value={tf.carParkVehicleNumber} />
              <InfoRow label="Car Color" value={tf.carParkCarColor} />
            </TableBody></Table></TableContainer>
          </>
        )}

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

        {reqs.baggage && tf.baggageRequired === 'yes' && (
          <>
            <SectionTitle>Baggage</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <InfoRow label="Cabin Bag" value={tf.baggageCabinBag ? 'Yes' : null} />
              <InfoRow label="No. of Check-in Bags" value={tf.baggageCheckIn || tf.baggageCheckInCount} />
              <InfoRow label="Check-in Bags Info" value={tf.baggageCheckInDetails} />
              <InfoRow label="Weight" value={tf.baggageWeight} />
              <InfoRow label="Notes" value={tf.baggageNotes} />
            </TableBody></Table></TableContainer>
          </>
        )}
      </Box>
    );
  };

  // ── File chip helper ──────────────────────────────────────────────────────
  const FileChip = ({ file, onRemove }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'action.hover', borderRadius: 1, px: 1, py: 0.5, mb: 0.5 }}>
      <AttachFile sx={{ fontSize: 14, color: 'text.secondary' }} />
      <Typography variant="caption" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{file.name}</Typography>
      <IconButton size="small" onClick={onRemove} sx={{ p: 0.25 }}><Delete sx={{ fontSize: 14 }} /></IconButton>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>Travel Request Approvals</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Review and approve travel requests from your team</Typography>

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
                    const isApproved = request.l1_approval_status === 'approved';
                    return (
                      <TableRow key={request.id} hover>
                        <TableCell>{request.id}</TableCell>
                        <TableCell>
                          {request.employeeFirstName} {request.employeeLastName}
                          <br />
                          <Typography variant="caption" color="text.secondary">{request.employee_email}</Typography>
                        </TableCell>
                        <TableCell>{travelData?.travelType || 'Travel Request'}</TableCell>
                        <TableCell>{formatDate(travelData?.departureDate)}</TableCell>
                        <TableCell>{formatDate(request.created_at)}</TableCell>
                        <TableCell>
                          {isApproved
                            ? <Chip label="L1 Approved" color="success" size="small" />
                            : <Chip label="Pending L1" color="warning" size="small" />}
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button size="small" startIcon={<Visibility />} onClick={() => handleViewDetails(request.id)}>
                              Review
                            </Button>
                        {isApproved && !request.travel_docs_sent_at && (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                startIcon={<CloudUpload />}
                                onClick={() => openUploadDialog(request)}
                              >
                                Upload Travel Details
                              </Button>
                            )}
                            {isApproved && request.travel_docs_sent_at && (
                              <Chip label="Details Sent" color="success" size="small" icon={<CheckCircle />} />
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

      {/* ── Review Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Travel Request Review — ID: {selectedRequest?.id}</DialogTitle>
        <DialogContent dividers>
          {selectedRequest && (
            <>
              {renderTravelDetails(selectedRequest.travel_form_data)}
              <Box sx={{ mt: 1, mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Submitted: {formatDate(selectedRequest.created_at)} &nbsp;|&nbsp; Email: {selectedRequest.employee_email}
                </Typography>
              </Box>

              {selectedRequest?.l1_approval_status === 'approved' ? (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                  <Chip label="L1 Approved" color="success" icon={<CheckCircle />} sx={{ px: 2, py: 2.5, fontSize: '0.95rem' }} />
                </Box>
              ) : selectedRequest?.l1_approval_status === 'rejected' ? (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                  <Chip label="Rejected" color="error" icon={<Cancel />} sx={{ px: 2, py: 2.5, fontSize: '0.95rem' }} />
                </Box>
              ) : (
                <>
                  {!actionType && (
                    <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
                      <Button variant="contained" color="success" startIcon={<CheckCircle />} onClick={handleApprove}>Approve</Button>
                      <Button variant="contained" color="error" startIcon={<Cancel />} onClick={handleReject}>Reject</Button>
                    </Box>
                  )}

                  {actionType === 'approve' && (
                    <Box sx={{ mt: 3 }}>
                      <TextField fullWidth label="Note (Optional)" multiline rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add any comments or notes..." />
                    </Box>
                  )}

                  {actionType === 'reject' && (
                    <Box sx={{ mt: 3 }}>
                      <TextField fullWidth label="Rejection Reason *" multiline rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Please provide a reason for rejection..." required />
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); setActionType(''); setNote(''); setReason(''); }}>Cancel</Button>
          {actionType && selectedRequest?.l1_approval_status !== 'approved' && (
            <Button variant="contained" color={actionType === 'approve' ? 'success' : 'error'} onClick={handleConfirmAction}>
              Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Upload Travel Details Dialog ───────────────────────────────────── */}
      <Dialog open={uploadOpen} onClose={() => !uploadSending && setUploadOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUpload color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>Upload Travel Details</Typography>
              {uploadRequest && (
                <Typography variant="caption" color="text.secondary">
                  {uploadRequest.employeeFirstName} {uploadRequest.employeeLastName} — Request #{uploadRequest.id}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          {uploadSending && <LinearProgress sx={{ mb: 2 }} />}
          {uploadAlert && (
            <Alert severity={uploadAlert.type} sx={{ mb: 2 }}>{uploadAlert.msg}</Alert>
          )}

          {uploadRequest && (() => {
            const td = uploadRequest.travel_form_data;
            const sections = getActiveSections(td);

            return (
              <>
                {sections.length === 0 && (
                  <Alert severity="info">No specific requirements found for this request. Use the general upload area below.</Alert>
                )}

                {sections.map((sectionKey) => {
                  const config = SECTION_CONFIG[sectionKey];
                  if (!config) return null;
                  const files = sectionFiles[sectionKey] || [];
                  const details = sectionDetails[sectionKey] || {};
                  const fileInputId = `file-input-${sectionKey}`;

                  return (
                    <Box key={sectionKey} sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {config.label}
                      </Typography>

                      <Grid container spacing={2}>
                        {config.fields.map((field) => (
                          <Grid item xs={12} sm={6} key={field.key}>
                            <TextField
                              fullWidth
                              size="small"
                              label={field.label}
                              value={details[field.key] || ''}
                              onChange={(e) => handleSectionDetailChange(sectionKey, field.key, e.target.value)}
                              disabled={uploadSending}
                            />
                          </Grid>
                        ))}

                        {/* Section file upload */}
                        <Grid item xs={12}>
                          <input
                            id={fileInputId}
                            type="file"
                            multiple
                            style={{ display: 'none' }}
                            onChange={(e) => handleSectionFileAdd(sectionKey, e.target.files)}
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AttachFile />}
                            onClick={() => document.getElementById(fileInputId).click()}
                            disabled={uploadSending}
                          >
                            Attach {config.label} Documents
                          </Button>
                          {files.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              {files.map((f, i) => (
                                <FileChip key={i} file={f} onRemove={() => handleSectionFileRemove(sectionKey, i)} />
                              ))}
                            </Box>
                          )}
                        </Grid>
                      </Grid>

                      <Divider sx={{ mt: 2 }} />
                    </Box>
                  );
                })}

                {/* Global / additional documents */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Additional Documents & Remarks</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    size="small"
                    label="Additional Remarks / Notes"
                    placeholder="Any extra details, special instructions, or general remarks for the employee..."
                    value={globalRemarks}
                    onChange={(e) => setGlobalRemarks(e.target.value)}
                    disabled={uploadSending}
                    sx={{ mb: 2 }}
                  />
                  <input
                    ref={globalFileRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleGlobalFileAdd(e.target.files)}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<CloudUpload />}
                    onClick={() => globalFileRef.current?.click()}
                    disabled={uploadSending}
                  >
                    Upload Additional Files
                  </Button>
                  {globalFiles.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {globalFiles.map((f, i) => (
                        <FileChip key={i} file={f} onRemove={() => handleGlobalFileRemove(i)} />
                      ))}
                    </Box>
                  )}
                </Box>
              </>
            );
          })()}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setUploadOpen(false)} disabled={uploadSending}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={async () => { await saveDraft(); setUploadAlert({ type: 'success', msg: 'Draft saved.' }); setTimeout(() => setUploadOpen(false), 1000); }}
            disabled={uploadSending}
          >
            Save Draft
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudUpload />}
            onClick={handleSendTravelDetails}
            disabled={uploadSending || !isAllSectionsFilled()}
          >
            {uploadSending ? 'Sending...' : `Save & Send to ${uploadRequest?.employeeFirstName || 'Employee'}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default L1TravelApprovals;
