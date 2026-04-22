import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient, { getFileUrl } from '../api/axiosClient';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid, Alert, Divider,
  IconButton, LinearProgress, MenuItem, Tooltip, FormControlLabel, Checkbox,
} from '@mui/material';
import {
  CheckCircle, Cancel, Visibility, CloudUpload, Delete, AttachFile, InsertDriveFile,
  LockOutlined, Edit,
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
  const [costDetails, setCostDetails] = useState({});       // { sectionKey: amount }
  const [currency, setCurrency] = useState('GBP');
  const [globalFiles, setGlobalFiles] = useState([]);
  const [globalRemarks, setGlobalRemarks] = useState('');
  const [uploadSending, setUploadSending] = useState(false);
  const [uploadAlert, setUploadAlert] = useState(null);
  const globalFileRef = useRef();

  // Notify user checkbox in upload dialog
  const [notifyUser, setNotifyUser] = useState(true);

  // View Sent Details dialog state
  const [viewSentOpen, setViewSentOpen] = useState(false);
  const [viewSentRequest, setViewSentRequest] = useState(null);
  const [viewSentDocs, setViewSentDocs] = useState([]);
  const [viewSentDetails, setViewSentDetails] = useState({});
  const [viewSentRemarks, setViewSentRemarks] = useState('');
  const [viewSentLoading, setViewSentLoading] = useState(false);
  const [viewSentUpdates, setViewSentUpdates] = useState([]);
  const [expandedVersion, setExpandedVersion] = useState(null); // Track which version is expanded

  // Edit reason modal state
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReasonText, setOtherReasonText] = useState('');

  // L1 Edit Request state
  const [editRequestOpen, setEditRequestOpen] = useState(false);
  const [editRequestData, setEditRequestData] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editNotifyUser, setEditNotifyUser] = useState(true);

  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Reason options for Edit & Resend
  const EDIT_REASON_OPTIONS = [
    'Meeting / event rescheduled',
    'Flight changed or cancelled',
    'Hotel booking updated',
    'Visa details changed',
    'Travel dates modified',
    'Destination changed',
    'Additional documents required',
    'Other',
  ];

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

  // Returns the trip end date from travel_form_data (YYYY-MM-DD string or null)
  const getTripEndDate = (td) => {
    if (!td) return null;
    if (td.travelType === 'domestic') {
      return td.domesticDateFlexTo || td.dateOfTravel || null;
    }
    if (td.tripType === 'multiCity' && td.multiCityLegs?.length) {
      const last = td.multiCityLegs[td.multiCityLegs.length - 1];
      return last?.dateFlexTo || last?.date || null;
    }
    // Round trip or one-way
    return td.roundTrip?.arrivalDateFlexTo || td.roundTrip?.arrivalDate || null;
  };

  // Returns true if today is strictly after the trip end date (trip is over → locked)
  const isTripLocked = (td) => {
    const endDate = getTripEndDate(td);
    if (!endDate) return false; // no end date = never lock
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // lock after end of that day
    return new Date() > end;
  };

  const SECTION_CONFIG = {
    flights: {
      label: 'Flight Details',
      costField: { key: 'flightCost', label: 'Total Flight Cost' },
      fields: [
        { key: 'airline', label: 'Airline' },
        { key: 'flightNumber', label: 'Flight Number' },
        { key: 'bookingRef', label: 'Booking Reference' },
        { key: 'flightClass', label: 'Flight Class', type: 'select', options: ['Economy Class', 'Premium Economy', 'Business Class', 'First Class', 'Charter'] },
        { key: 'departureAirport', label: 'Departure Airport' },
        { key: 'arrivalAirport', label: 'Arrival Airport' },
        { key: 'departureTerminal', label: 'Departure Terminal' },
        { key: 'departureTime', label: 'Departure Date & Time', type: 'datetime-local' },
        { key: 'arrivalTime', label: 'Arrival Date & Time', type: 'datetime-local' },
        { key: 'seatNumber', label: 'Seat Number' },
        { key: 'baggageAllowanceFlight', label: 'Baggage Allowance' },
      ],
    },
    hotel: {
      label: 'Hotel / Accommodation',
      costField: { key: 'hotelCost', label: 'Total Hotel Cost' },
      fields: [
        { key: 'hotelName', label: 'Hotel Name' },
        { key: 'hotelAddress', label: 'Address' },
        { key: 'confirmationNumber', label: 'Confirmation Number' },
        { key: 'checkIn', label: 'Check-in Date & Time', type: 'datetime-local' },
        { key: 'checkOut', label: 'Check-out Date & Time', type: 'datetime-local' },
      ],
    },
    visa: {
      label: 'Visa Details',
      costField: { key: 'visaCost', label: 'Total Visa Cost' },
      fields: [
        { key: 'visaNumber', label: 'Visa Number' },
        { key: 'visaIssueDate', label: 'Issue Date', type: 'datetime-local' },
        { key: 'visaExpiryDate', label: 'Expiry Date', type: 'datetime-local' },
        { key: 'visaType', label: 'Visa Type' },
        { key: 'visaIssuingCountry', label: 'Issuing Country' },
      ],
    },
    carPark: {
      label: 'Airport Car Park',
      costField: { key: 'carParkCost', label: 'Total Car Park Cost' },
      fields: [
        { key: 'carParkName', label: 'Car Park Name' },
        { key: 'carParkLocation', label: 'Location / Address' },
        { key: 'bayNumber', label: 'Bay / Space Number' },
        { key: 'carParkBookingRef', label: 'Booking Reference' },
        { key: 'carParkEntryDate', label: 'Entry Date & Time', type: 'datetime-local' },
        { key: 'carParkExitDate', label: 'Exit Date & Time', type: 'datetime-local' },
        { key: 'shuttleCost', label: 'Additional Cost for Shuttle / Pick-up & Drop' },
      ],
    },
    food: {
      label: 'Food Preferance',
      costField: { key: 'foodCost', label: 'Total Food Cost' },
      hint: 'Standard meal allowances apply: East Europe = €40/day fixed rate, West Europe = €80/day fixed rate. Please enter the applicable amount based on the destination.',
      fields: [
        { key: 'eastEurope', label: 'East Europe Allowance (€40 fixed)' },
        { key: 'westEurope', label: 'West Europe Allowance (€80 fixed)' },
      ],
    },
    baggage: {
      label: 'Baggage Requirements',
      costField: { key: 'baggageCost', label: 'Total Baggage Cost' },
      fields: [
        { key: 'baggageAllowance', label: 'Baggage Allowance' },
        { key: 'baggageBookingRef', label: 'Booking Reference' },
        { key: 'baggageWeight', label: 'Max Weight (kg)' },
        { key: 'baggageNotes', label: 'Notes' },
      ],
    },
    rentedVehicle: {
      label: 'Rented Vehicle',
      costField: { key: 'transportCost', label: 'Total Vehicle Cost' },
      fields: [
        { key: 'rentalCompany', label: 'Rental Company' },
        { key: 'vehicleReg', label: 'Vehicle Registration' },
        { key: 'vehicleModel', label: 'Vehicle Make / Model' },
        { key: 'pickupAddress', label: 'Pick-up Address' },
        { key: 'pickupDateTime', label: 'Pick-up Date & Time', type: 'datetime-local' },
        { key: 'dropoffAddress', label: 'Drop-off Address' },
        { key: 'dropoffDateTime', label: 'Drop-off Date & Time', type: 'datetime-local' },
        { key: 'rentalBookingRef', label: 'Booking Reference' },
        { key: 'vehicleDeposit', label: 'Deposit to be Paid on Vehicle Collection' },
      ],
    },
  };

  const getActiveSections = (travelData) => {
    if (!travelData) return [];
    const reqs = travelData.requirements || {};
    const isIntl = travelData.travelType === 'international';
    const isMultiCity = travelData.tripType === 'multiCity';
    const legs = travelData.multiCityLegs || [];
    const active = [];

    if (isMultiCity && legs.length > 0) {
      // Per-leg: flights, hotel (if needsHotel), carPark (if carPark req)
      legs.forEach((leg, i) => {
        if (isIntl || reqs.flights) active.push(`flights_leg_${i}`);
        if (leg.needsHotel) active.push(`hotel_leg_${i}`);
        if (reqs.carPark || travelData.carParkRequired === 'yes') active.push(`carPark_leg_${i}`);
      });
    } else {
      if (isIntl || reqs.flights) active.push('flights');
      const hasHotel = travelData.roundTrip?.needsHotel || travelData.domesticHotel?.needsHotel || reqs.overnightStay;
      if (hasHotel) active.push('hotel');
      if (reqs.carPark || travelData.carParkRequired === 'yes') active.push('carPark');
    }

    // Single sections regardless of trip type
    if (reqs.visa || travelData.visaRequired === 'yes') active.push('visa');
    if (reqs.food) active.push('food');
    if (reqs.baggage || travelData.baggageRequired === 'yes') active.push('baggage');
    if (reqs.rentedVehicle) active.push('rentedVehicle');

    return active;
  };

  const openUploadDialog = async (request) => {
    setUploadRequest(request);
    setSectionFiles({});
    setGlobalFiles([]);
    setCostDetails({});
    setCurrency('GBP');
    setNotifyUser(true);
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

  const openViewSentDialog = async (request) => {
    setViewSentRequest(request);
    setViewSentDocs([]);
    setViewSentDetails({});
    setViewSentRemarks('');
    setExpandedVersion(null);
    setViewSentOpen(true);
    setViewSentLoading(true);
    try {
      const [docsRes, draftRes, updatesRes] = await Promise.all([
        axiosClient.get(`/travel-documents/${request.id}`),
        axiosClient.get(`/travel-documents/${request.id}/draft`),
        axiosClient.get(`/travel-documents/${request.id}/updates`),
      ]);
      setViewSentDocs(docsRes.data?.data || []);
      const draft = draftRes.data?.data;
      if (draft) {
        setViewSentDetails(draft.details || {});
        setViewSentRemarks(draft.globalRemarks || '');
      }
      // Store updates in a new state
      setViewSentUpdates(updatesRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load sent details:', err);
    } finally {
      setViewSentLoading(false);
    }
  };

  // Open reason modal before allowing edit
  const openEditReasonModal = (request) => {
    setUploadRequest(request);
    setSelectedReason('');
    setOtherReasonText('');
    setReasonModalOpen(true);
  };

  // Open L1 Edit Request dialog
  const openEditRequestDialog = (request) => {
    const td = request.travel_form_data || {};
    setEditRequestData(request);
    setEditNotifyUser(true);
    setEditFormData({
      reasonOfTravel: td.reasonOfTravel || '',
      remarks: td.remarks || '',
      // International round trip dates
      departureDate: td.roundTrip?.departureDate || '',
      arrivalDate: td.roundTrip?.arrivalDate || '',
      fromCity: td.roundTrip?.fromCity || '',
      toCity: td.roundTrip?.toCity || '',
      countryOfTravel: td.countryOfTravel || '',
      // Domestic dates
      dateOfTravel: td.dateOfTravel || '',
      domesticDateFlexFrom: td.domesticDateFlexFrom || '',
      domesticDateFlexTo: td.domesticDateFlexTo || '',
      cityOfTravelDomestic: td.cityOfTravelDomestic || '',
    });
    setEditRequestOpen(true);
  };

  // Save L1 edited request
  const handleSaveEditRequest = async () => {
    if (!editRequestData) return;
    setEditSaving(true);
    try {
      const td = editRequestData.travel_form_data || {};
      const isIntl = td.travelType === 'international';

      // Merge edited fields back into the full travel_form_data
      let updatedFormData = { ...td };

      updatedFormData.reasonOfTravel = editFormData.reasonOfTravel;
      updatedFormData.remarks = editFormData.remarks;

      if (isIntl && td.tripType !== 'multiCity') {
        updatedFormData.roundTrip = {
          ...(td.roundTrip || {}),
          departureDate: editFormData.departureDate,
          arrivalDate: editFormData.arrivalDate,
          fromCity: editFormData.fromCity,
          toCity: editFormData.toCity,
        };
        updatedFormData.countryOfTravel = editFormData.countryOfTravel;
      } else if (!isIntl) {
        updatedFormData.dateOfTravel = editFormData.dateOfTravel;
        updatedFormData.domesticDateFlexFrom = editFormData.domesticDateFlexFrom;
        updatedFormData.domesticDateFlexTo = editFormData.domesticDateFlexTo;
        updatedFormData.cityOfTravelDomestic = editFormData.cityOfTravelDomestic;
      }

      await axiosClient.put(`/l1-approvals/${editRequestData.id}/edit-request`, {
        travelFormData: updatedFormData,
        editedBy: currentUser.email,
        skipEmail: false,
      });

      alert('Travel request updated successfully');
      setEditRequestOpen(false);
      fetchPendingRequests();
    } catch (err) {
      alert('Failed to update: ' + (err.response?.data?.message || err.message));
    } finally {
      setEditSaving(false);
    }
  };

  // Confirm reason and open upload dialog
  const handleReasonConfirm = async () => {
    if (!selectedReason) {
      alert('Please select a reason for editing');
      return;
    }
    if (selectedReason === 'Other' && otherReasonText.trim().split(/\s+/).filter(w => w).length < 10) {
      alert('Please provide at least 10 words for "Other" reason');
      return;
    }
    const finalReason = selectedReason === 'Other' ? otherReasonText.trim() : selectedReason;

    // Build the request object with editReason attached
    const requestWithReason = { ...uploadRequest, editReason: finalReason };

    setReasonModalOpen(false);
    await openUploadDialogForEdit(requestWithReason);
  };

  // Open upload dialog with existing data for editing
  const openUploadDialogForEdit = async (request) => {
    // Keep editReason intact — do NOT overwrite uploadRequest here with a plain object
    setUploadRequest(request);
    setSectionFiles({});
    setGlobalFiles([]);
    setCostDetails({});
    setCurrency('GBP');
    setNotifyUser(true);
    setUploadAlert(null);

    // Load existing draft (which contains the current sent data)
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
        costDetails,
        currency,
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

  // All fields are optional — Save & Send is enabled as long as dialog is open
  const isAllSectionsFilled = () => true;

  const handleSendTravelDetails = async () => {
    if (!uploadRequest) return;
    setUploadSending(true);
    setUploadAlert(null);
    try {
      const requestId = uploadRequest.id;

      // 1. Save text details
      await axiosClient.post(`/travel-documents/${requestId}/save-details`, {
        details: sectionDetails,
        costDetails,
        currency,
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

      // Always notify employee by email
      const sendPayload = { 
        sentBy: currentUser.email,
        skipEmail: false,
        editReason: uploadRequest?.editReason || null,
        details: sectionDetails,
        globalRemarks: globalRemarks.trim() || null,
      };
      
      await axiosClient.post(`/travel-documents/${requestId}/send`, sendPayload);

      setUploadAlert({ type: 'success', msg: 'Travel details saved and emailed to the employee.' });
      setTimeout(() => { setUploadOpen(false); fetchPendingRequests(); }, 2000);
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
    const reqLabels = { flights: 'Flights', visa: 'Visa', rentedVehicle: 'Rented Vehicle', carPark: 'Airport Car Park', food: 'Food Preferance', overnightStay: 'Overnight Stay', baggage: 'Baggage Requirements' };
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
          {isIntl && <InfoRow label="Trip Type" value={tf.tripType === 'roundTrip' ? 'Round Trip' : tf.tripType === 'multiCity' ? 'Multi-City' : tf.tripType === 'oneWay' ? 'One-Way' : tf.tripType} />}
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

        {isIntl && tf.tripType === 'oneWay' && tf.roundTrip && (
          <>
            <SectionTitle>One-Way Details</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <InfoRow label="From City" value={tf.roundTrip.fromCity} />
              <InfoRow label="To City" value={tf.roundTrip.toCity} />
              <InfoRow label="Departure Date" value={tf.roundTrip.departureDate || 'Flexible'} />
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

        {reqs.visa && (
          <>
            <SectionTitle>Visa Details</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <InfoRow label="Nationality" value={tf.nationality} />
              <InfoRow label="Passport Name" value={tf.passportInfo?.passport_name} />
              <InfoRow label="Passport Number" value={tf.passportInfo?.passport_number} />
              <InfoRow label="Passport Issue Date" value={tf.passportInfo?.passport_issue_date} />
              <InfoRow label="Passport Expiry" value={tf.passportInfo?.passport_expiry} />
              <InfoRow label="Visa Type" value={tf.visaType} />
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
                  <InfoRow label="Pick-up Point" value={leg.pickupPoint} />
                  <InfoRow label="Drop-off Point" value={leg.dropOffPoint} />
                  <InfoRow label="Vehicle Type" value={leg.vehicleType} />
                </TableBody></Table></TableContainer>
              </Box>
            ))}
          </>
        )}

        {reqs.carPark && (
          <>
            <SectionTitle>Airport Car Park</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <InfoRow label="Vehicle Number" value={tf.carParkVehicleNumber} />
              <InfoRow label="Car Color" value={tf.carParkCarColor} />
              <InfoRow label="Duration" value={tf.carParkDuration} />
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
              <InfoRow label="Cabin Bag" value={tf.baggageCabinBag ? 'Yes' : null} />
              <InfoRow label="No. of Check-in Bags" value={tf.baggageCheckIn || tf.baggageCheckInCount} />
              <InfoRow label="Weight" value={tf.baggageWeight} />
              <InfoRow label="Notes" value={tf.baggageNotes} />
            </TableBody></Table></TableContainer>
          </>
        )}

        {reqs.accompanying && (
          <>
            <SectionTitle>Anyone Accompanying</SectionTitle>
            <TableContainer component={Box}><Table size="small"><TableBody>
              <InfoRow label="Name(s)" value={tf.accompanyingNames} />
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
                    const locked = isTripLocked(travelData);
                    const endDate = getTripEndDate(travelData);
                    const lockMsg = endDate ? `Trip ended on ${new Date(endDate).toLocaleDateString('en-GB')} — editing locked` : 'Trip completed — editing locked';
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
                            {/* L1 Manager: Edit Request button — only when approved AND trip not yet ended */}
                            {currentUser.role !== 'Admin' && isApproved && !locked && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                startIcon={<Edit />}
                                onClick={() => openEditRequestDialog(request)}
                              >
                                Edit Request
                              </Button>
                            )}
                        {isApproved && !request.travel_docs_sent_at && (
                          locked ? (
                            <Tooltip title={lockMsg} arrow>
                              <span>
                                <Button size="small" variant="contained" color="inherit" startIcon={<LockOutlined />} disabled>
                                  Locked
                                </Button>
                              </span>
                            </Tooltip>
                          ) : (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                startIcon={<CloudUpload />}
                                onClick={() => openUploadDialog(request)}
                              >
                                Upload Travel Details
                              </Button>
                          )
                            )}
                            {isApproved && request.travel_docs_sent_at && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                                <Chip label="Details Sent" color="success" size="small" icon={<CheckCircle />} />
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                  startIcon={<Visibility />}
                                  onClick={() => openViewSentDialog(request)}
                                >
                                  View Sent Details
                                </Button>
                                {locked ? (
                                  <Tooltip title={lockMsg} arrow>
                                    <span>
                                      <Button size="small" variant="outlined" color="inherit" startIcon={<LockOutlined />} disabled>
                                        Locked
                                      </Button>
                                    </span>
                                  </Tooltip>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="warning"
                                    startIcon={<Edit />}
                                    onClick={() => openEditReasonModal(request)}
                                  >
                                    Edit & Resend
                                  </Button>
                                )}
                              </Box>
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

              {/* ── Attachments ── */}
              {(() => {
                const attachments = Array.isArray(selectedRequest.attachments)
                  ? selectedRequest.attachments
                  : [];
                if (attachments.length === 0) return null;
                return (
                  <Box sx={{ mt: 2.5 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: 'primary.main', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                      Attachments ({attachments.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {attachments.map((item, i) => {
                        // attachments can be objects {filename, originalName} or plain strings
                        const filename = typeof item === 'string' ? item : (item?.filename || item?.originalName || String(item));
                        const displayName = typeof item === 'string'
                          ? filename.replace(/^\d+-\d+-/, '')
                          : (item?.originalName || filename.replace(/^\d+-\d+-/, ''));
                        const fileUrl = getFileUrl(`/uploads/${filename}`);
                        const isImage = /\.(jpg|jpeg|png|gif|webp|PNG|JPG|JPEG)$/i.test(filename);
                        const isPdf = /\.pdf$/i.test(filename);
                        return (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                            <InsertDriveFile sx={{ color: isPdf ? 'error.main' : isImage ? 'primary.main' : 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-all', fontSize: '0.8125rem' }}>
                              {displayName}
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ flexShrink: 0, textTransform: 'none', fontSize: '0.75rem' }}
                            >
                              {isImage ? 'View' : 'Open'}
                            </Button>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })()}

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
                  {!actionType && currentUser.role === 'Admin' && (
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
      <Dialog open={uploadOpen} onClose={() => !uploadSending && setUploadOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUpload color={uploadRequest?.editReason ? 'warning' : 'primary'} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {uploadRequest?.editReason ? 'Edit & Resend Travel Details' : 'Upload Travel Details'}
              </Typography>
              {uploadRequest && (
                <Typography variant="caption" color="text.secondary">
                  {uploadRequest.employeeFirstName} {uploadRequest.employeeLastName} — Request #{uploadRequest.id}
                  {uploadRequest.editReason && (
                    <> &nbsp;·&nbsp; <span style={{ color: '#ed6c02', fontWeight: 600 }}>Reason: {uploadRequest.editReason}</span></>
                  )}
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
                {/* Currency selector */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={600}>Cost Currency:</Typography>
                  <TextField
                    select size="small" value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    sx={{ minWidth: 100 }}
                    disabled={uploadSending}
                  >
                    {['GBP','EUR','USD','INR'].map(c => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </TextField>
                  <Typography variant="caption" color="text.secondary">
                    All cost fields below will use this currency
                  </Typography>
                </Box>

                {sections.length === 0 && (
                  <Alert severity="info">No specific requirements found for this request. Use the general upload area below.</Alert>
                )}

                {sections.map((sectionKey) => {
                  // Resolve base config key for per-leg sections (e.g. flights_leg_0 → flights)
                  const legMatch = sectionKey.match(/^(.+)_leg_(\d+)$/);
                  const baseKey = legMatch ? legMatch[1] : sectionKey;
                  const legIndex = legMatch ? parseInt(legMatch[2]) : null;
                  const leg = legIndex !== null ? (td.multiCityLegs || [])[legIndex] : null;

                  const config = SECTION_CONFIG[baseKey];
                  if (!config) return null;
                  const files = sectionFiles[sectionKey] || [];
                  const details = sectionDetails[sectionKey] || {};
                  const fileInputId = `file-input-${sectionKey}`;

                  // Build label — for per-leg sections show leg route
                  const sectionLabel = leg
                    ? `${config.label} — Leg ${legIndex + 1}: ${leg.fromCity || '?'} → ${leg.toCity || '?'}`
                    : config.label;

                  return (
                    <Box key={sectionKey} sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {sectionLabel}
                      </Typography>

                      {config.hint && (
                        <Box sx={{ bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 1, px: 2, py: 1.25, mb: 1.5, display: 'flex', gap: 1 }}>
                          <Typography variant="caption" sx={{ color: '#1e40af', lineHeight: 1.6 }}>
                            ℹ️ {config.hint}
                          </Typography>
                        </Box>
                      )}

                      <Grid container spacing={2}>
                        {config.fields.map((field) => (
                          <Grid item xs={12} sm={4} key={field.key}>
                            {field.type === 'select' ? (
                              <TextField
                                fullWidth select size="small" label={field.label}
                                value={details[field.key] || ''}
                                onChange={(e) => handleSectionDetailChange(sectionKey, field.key, e.target.value)}
                                disabled={uploadSending}
                                InputLabelProps={{ shrink: true }}
                              >
                                <MenuItem value=""><em>— Select —</em></MenuItem>
                                {field.options.map(opt => (
                                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                ))}
                              </TextField>
                            ) : (
                              <TextField
                                fullWidth size="small"
                                label={field.label}
                                type={field.type || 'text'}
                                value={details[field.key] || ''}
                                onChange={(e) => handleSectionDetailChange(sectionKey, field.key, e.target.value)}
                                disabled={uploadSending}
                                InputLabelProps={field.type === 'datetime-local' ? { shrink: true } : undefined}
                              />
                            )}
                          </Grid>
                        ))}

                        {/* Cost field for this section */}
                        {config.costField && (
                          <Grid item xs={12} sm={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label={config.costField.label}
                              type="number"
                              value={costDetails[config.costField.key] || ''}
                              onChange={(e) => setCostDetails(prev => ({ ...prev, [config.costField.key]: e.target.value }))}
                              disabled={uploadSending}
                              InputProps={{
                                startAdornment: (
                                  <Box component="span" sx={{ mr: 0.5, color: 'text.secondary', fontSize: '0.8rem', fontWeight: 600 }}>
                                    {currency}
                                  </Box>
                                ),
                              }}
                              sx={{ bgcolor: 'warning.50', '& .MuiOutlinedInput-root': { borderColor: 'warning.main' } }}
                            />
                          </Grid>
                        )}

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

      {/* ── View Sent Details Dialog ───────────────────────────────────────── */}
      <Dialog open={viewSentOpen} onClose={() => setViewSentOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Visibility color="info" />
            <Box>
              <Typography variant="h6" fontWeight={700}>Sent Travel Details</Typography>
              {viewSentRequest && (
                <Typography variant="caption" color="text.secondary">
                  {viewSentRequest.employeeFirstName} {viewSentRequest.employeeLastName} — Request #{viewSentRequest.id}
                  {viewSentRequest.travel_docs_sent_at && (
                    <> &nbsp;·&nbsp; Sent on {new Date(viewSentRequest.travel_docs_sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                  )}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          {viewSentLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <LinearProgress sx={{ width: '60%' }} />
            </Box>
          ) : (
            <>
              {/* Update History Timeline */}
              {viewSentUpdates.length > 0 && (
                <Box sx={{ mb: 4, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid', borderColor: 'grey.300' }}>
                  <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 2, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Update History ({viewSentUpdates.length + 1} Version{viewSentUpdates.length > 0 ? 's' : ''})
                  </Typography>
                  
                  {/* Original Version */}
                  <Box sx={{ mb: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        bgcolor: expandedVersion === 'original' ? 'primary.50' : 'white',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: expandedVersion === 'original' ? 'primary.main' : 'grey.300',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'primary.50' },
                      }}
                      onClick={() => setExpandedVersion(expandedVersion === 'original' ? null : 'original')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="Original" size="small" color="success" sx={{ fontWeight: 600 }} />
                        <Typography variant="body2" fontWeight={600}>
                          Version 1
                        </Typography>
                        {viewSentRequest?.travel_docs_sent_at && (
                          <Typography variant="caption" color="text.secondary">
                            · Sent on {new Date(viewSentRequest.travel_docs_sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" color="primary.main" fontWeight={600}>
                        {expandedVersion === 'original' ? '▲ Hide' : '▼ View'}
                      </Typography>
                    </Box>
                    
                    {expandedVersion === 'original' && (
                      <Box sx={{ mt: 1, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontStyle: 'italic' }}>
                          This is the current active version shown below
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Update Versions */}
                  {viewSentUpdates.map((update, idx) => {
                    let updateDetails = {};
                    try {
                      updateDetails = update.details_json ? JSON.parse(update.details_json) : {};
                    } catch {}
                    
                    return (
                      <Box key={update.id} sx={{ mb: 1 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.5,
                            bgcolor: expandedVersion === update.id ? 'warning.50' : 'white',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: expandedVersion === update.id ? 'warning.main' : 'grey.300',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'warning.50' },
                          }}
                          onClick={() => setExpandedVersion(expandedVersion === update.id ? null : update.id)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={`Update ${update.update_number}`} size="small" color="warning" sx={{ fontWeight: 600 }} />
                            <Typography variant="body2" fontWeight={600}>
                              Version {update.update_number + 1}
                            </Typography>
                            {update.sent_at && (
                              <Typography variant="caption" color="text.secondary">
                                · Sent on {new Date(update.sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                            )}
                            {update.sent_by && (
                              <Typography variant="caption" color="text.secondary">
                                · by {update.sent_by}
                              </Typography>
                            )}
                            {!update.notified_user && (
                              <Chip label="Not Notified" size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                            )}
                          </Box>
                          <Typography variant="caption" color="warning.main" fontWeight={600}>
                            {expandedVersion === update.id ? '▲ Hide' : '▼ View'}
                          </Typography>
                        </Box>
                        
                        {expandedVersion === update.id && (
                          <Box sx={{ mt: 1, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                            {/* Show edit reason if available */}
                            {update.edit_reason && (
                              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'warning.50', borderRadius: 1, border: '1px solid', borderColor: 'warning.light' }}>
                                <Typography variant="caption" fontWeight={700} color="warning.dark" sx={{ display: 'block', mb: 0.5, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                  Reason for Edit:
                                </Typography>
                                <Typography variant="body2" color="warning.dark" fontWeight={600}>
                                  {update.edit_reason}
                                </Typography>
                              </Box>
                            )}
                            
                            {/* Show details from this update */}
                            {Object.keys(updateDetails).length > 0 ? (
                              Object.entries(updateDetails).map(([sectionKey, fields]) => {
                                const hasValues = Object.values(fields || {}).some(v => v?.trim());
                                if (!hasValues) return null;
                                const baseKey = sectionKey.replace(/_leg_\d+$/, '');
                                const sectionLabel = SECTION_CONFIG[baseKey]?.label || sectionKey;
                                return (
                                  <Box key={sectionKey} sx={{ mb: 2 }}>
                                    <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ mb: 0.5, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                      {sectionLabel}
                                    </Typography>
                                    <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
                                      {Object.entries(fields).filter(([, v]) => v?.trim()).map(([fieldKey, value]) => {
                                        const fieldLabel = SECTION_CONFIG[baseKey]?.fields?.find(f => f.key === fieldKey)?.label || fieldKey;
                                        return (
                                          <Box key={fieldKey} sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'grey.200', '&:last-child': { borderBottom: 0 } }}>
                                            <Box sx={{ width: 140, minWidth: 140, px: 1.5, py: 0.75, bgcolor: 'grey.100' }}>
                                              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem' }}>{fieldLabel}</Typography>
                                            </Box>
                                            <Box sx={{ px: 1.5, py: 0.75, flex: 1 }}>
                                              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{value}</Typography>
                                            </Box>
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  </Box>
                                );
                              })
                            ) : (
                              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                No text details in this version
                              </Typography>
                            )}
                            
                            {/* Show remarks from this update */}
                            {update.remarks && (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ mb: 0.5, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                  Remarks
                                </Typography>
                                <Box sx={{ bgcolor: '#fffbeb', border: '1px solid', borderColor: 'warning.light', borderRadius: 1, px: 1.5, py: 1 }}>
                                  <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem' }}>{update.remarks}</Typography>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}

              {/* Current Active Version - Section details */}
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: 'primary.main' }}>
                Current Active Version
              </Typography>
              
              {Object.keys(viewSentDetails).length > 0 ? (
                Object.entries(viewSentDetails).map(([sectionKey, fields]) => {
                  const hasValues = Object.values(fields || {}).some(v => v?.trim());
                  if (!hasValues) return null;
                  const baseKey = sectionKey.replace(/_leg_\d+$/, '');
                  const sectionLabel = SECTION_CONFIG[baseKey]?.label || sectionKey;
                  return (
                    <Box key={sectionKey} sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                        {sectionLabel}
                      </Typography>
                      <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
                        {Object.entries(fields).filter(([, v]) => v?.trim()).map(([fieldKey, value]) => {
                          const fieldLabel = SECTION_CONFIG[baseKey]?.fields?.find(f => f.key === fieldKey)?.label || fieldKey;
                          return (
                            <Box key={fieldKey} sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'grey.200', '&:last-child': { borderBottom: 0 } }}>
                              <Box sx={{ width: 180, minWidth: 180, px: 2, py: 1, bgcolor: 'grey.100' }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>{fieldLabel}</Typography>
                              </Box>
                              <Box sx={{ px: 2, py: 1, flex: 1 }}>
                                <Typography variant="body2">{value}</Typography>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>No text details were saved for this request.</Alert>
              )}

              {/* Remarks */}
              {viewSentRemarks && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Additional Remarks
                  </Typography>
                  <Box sx={{ bgcolor: '#fffbeb', border: '1px solid', borderColor: 'warning.light', borderRadius: 1, px: 2, py: 1.5 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{viewSentRemarks}</Typography>
                  </Box>
                </Box>
              )}

              {/* Uploaded documents */}
              <Box>
                <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                  Uploaded Documents ({viewSentDocs.length})
                </Typography>
                {viewSentDocs.length === 0 ? (
                  <Alert severity="info">No documents were uploaded for this request.</Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {viewSentDocs.map((doc) => (
                      <Box key={doc.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                        <InsertDriveFile color="primary" fontSize="small" />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{doc.original_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {doc.doc_type && <>{doc.doc_type} · </>}
                            Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {doc.uploaded_by && <> by {doc.uploaded_by}</>}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          href={getFileUrl(`/uploads/${doc.filename}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<Visibility />}
                        >
                          View
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setViewSentOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Reason Modal */}
      <Dialog open={reasonModalOpen} onClose={() => setReasonModalOpen(false)} maxWidth="sm" fullWidth>

      {/* ── L1 Edit Request Dialog ─────────────────────────────────────────── */}
      <Dialog open={editRequestOpen} onClose={() => !editSaving && setEditRequestOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit color="secondary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>Edit Travel Request</Typography>
              {editRequestData && (
                <Typography variant="caption" color="text.secondary">
                  {editRequestData.employeeFirstName} {editRequestData.employeeLastName} — Request #{editRequestData.id}
                  {(() => {
                    const endDate = getTripEndDate(editRequestData.travel_form_data);
                    return endDate ? <> &nbsp;·&nbsp; Trip ends {new Date(endDate).toLocaleDateString('en-GB')}</> : null;
                  })()}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            You can edit key travel details below. Changes will be saved to the request immediately.
          </Alert>

          {editRequestData && (() => {
            const td = editRequestData.travel_form_data || {};
            const isIntl = td.travelType === 'international';
            const isMultiCity = td.tripType === 'multiCity';

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Reason for Travel */}
                <TextField
                  fullWidth
                  label="Reason for Travel"
                  value={editFormData.reasonOfTravel || ''}
                  onChange={(e) => setEditFormData(p => ({ ...p, reasonOfTravel: e.target.value }))}
                  disabled={editSaving}
                  multiline
                  rows={2}
                />

                {/* International Round Trip / One-Way fields */}
                {isIntl && !isMultiCity && (
                  <>
                    <TextField
                      fullWidth
                      label="Country of Travel"
                      value={editFormData.countryOfTravel || ''}
                      onChange={(e) => setEditFormData(p => ({ ...p, countryOfTravel: e.target.value }))}
                      disabled={editSaving}
                    />
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="From City"
                          value={editFormData.fromCity || ''}
                          onChange={(e) => setEditFormData(p => ({ ...p, fromCity: e.target.value }))}
                          disabled={editSaving}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="To City"
                          value={editFormData.toCity || ''}
                          onChange={(e) => setEditFormData(p => ({ ...p, toCity: e.target.value }))}
                          disabled={editSaving}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Departure Date"
                          type="date"
                          value={editFormData.departureDate || ''}
                          onChange={(e) => setEditFormData(p => ({ ...p, departureDate: e.target.value }))}
                          disabled={editSaving}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      {td.tripType === 'roundTrip' && (
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            label="Return Date"
                            type="date"
                            value={editFormData.arrivalDate || ''}
                            onChange={(e) => setEditFormData(p => ({ ...p, arrivalDate: e.target.value }))}
                            disabled={editSaving}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      )}
                    </Grid>
                  </>
                )}

                {/* Domestic fields */}
                {!isIntl && (
                  <>
                    <TextField
                      fullWidth
                      label="City of Travel"
                      value={editFormData.cityOfTravelDomestic || ''}
                      onChange={(e) => setEditFormData(p => ({ ...p, cityOfTravelDomestic: e.target.value }))}
                      disabled={editSaving}
                    />
                    {td.domesticDateFlex ? (
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            label="Travel Date From"
                            type="date"
                            value={editFormData.domesticDateFlexFrom || ''}
                            onChange={(e) => setEditFormData(p => ({ ...p, domesticDateFlexFrom: e.target.value }))}
                            disabled={editSaving}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            label="Travel Date To"
                            type="date"
                            value={editFormData.domesticDateFlexTo || ''}
                            onChange={(e) => setEditFormData(p => ({ ...p, domesticDateFlexTo: e.target.value }))}
                            disabled={editSaving}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      </Grid>
                    ) : (
                      <TextField
                        fullWidth
                        label="Date of Travel"
                        type="date"
                        value={editFormData.dateOfTravel || ''}
                        onChange={(e) => setEditFormData(p => ({ ...p, dateOfTravel: e.target.value }))}
                        disabled={editSaving}
                        InputLabelProps={{ shrink: true }}
                      />
                    )}
                  </>
                )}

                {/* Multi-city note */}
                {isMultiCity && (
                  <Alert severity="warning">
                    Multi-city legs cannot be edited here. Please contact the employee to submit a new request if dates need to change.
                  </Alert>
                )}

                {/* Remarks */}
                <TextField
                  fullWidth
                  label="Remarks / Notes"
                  value={editFormData.remarks || ''}
                  onChange={(e) => setEditFormData(p => ({ ...p, remarks: e.target.value }))}
                  disabled={editSaving}
                  multiline
                  rows={2}
                />
              </Box>
            );
          })()}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditRequestOpen(false)} disabled={editSaving}>Cancel</Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSaveEditRequest}
            disabled={editSaving}
          >
            {editSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit color="warning" />
            <Typography variant="h6" fontWeight={700}>Reason for Editing Travel Details</Typography>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Please select a reason for editing and resending the travel details. This helps maintain an audit trail.
          </Alert>

          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            Select Reason:
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {EDIT_REASON_OPTIONS.map((option) => (
              <Box
                key={option}
                sx={{
                  p: 1.5,
                  border: '2px solid',
                  borderColor: selectedReason === option ? 'warning.main' : 'grey.300',
                  borderRadius: 1,
                  bgcolor: selectedReason === option ? 'warning.50' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'warning.main',
                    bgcolor: 'warning.50',
                  },
                }}
                onClick={() => setSelectedReason(option)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: selectedReason === option ? 'warning.main' : 'grey.400',
                      bgcolor: selectedReason === option ? 'warning.main' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selectedReason === option && (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />
                    )}
                  </Box>
                  <Typography variant="body2" fontWeight={selectedReason === option ? 600 : 400}>
                    {option}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {selectedReason === 'Other' && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Please specify the reason"
                placeholder="Minimum 10 words required..."
                value={otherReasonText}
                onChange={(e) => setOtherReasonText(e.target.value)}
                helperText={`Word count: ${otherReasonText.trim().split(/\s+/).filter(w => w).length} / 10 minimum`}
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReasonModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleReasonConfirm}
            disabled={!selectedReason || (selectedReason === 'Other' && otherReasonText.trim().split(/\s+/).filter(w => w).length < 10)}
          >
            Continue to Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default L1TravelApprovals;
