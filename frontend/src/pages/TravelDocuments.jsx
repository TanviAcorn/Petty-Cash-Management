import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, IconButton, List,
  ListItem, ListItemText, ListItemIcon, CircularProgress, Alert,
  Divider, Tooltip
} from '@mui/material';
import {
  CloudUpload, Delete, InsertDriveFile, Send, Visibility,
  CheckCircle, FlightTakeoff
} from '@mui/icons-material';
import axiosClient from '../api/axiosClient';

const TravelDocuments = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [docs, setDocs] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [alert, setAlert] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => { fetchApprovedRequests(); }, []);

  const fetchApprovedRequests = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/l1-approvals', { params: { allApproved: true } });
      const all = res.data.data || [];
      // Show only approved travel requests
      setRequests(all.filter(r => r.l1_approval_status === 'approved'));
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = async (request) => {
    setSelected(request);
    setDialogOpen(true);
    setPendingFiles([]);
    setAlert(null);
    await fetchDocs(request.id);
  };

  const fetchDocs = async (requestId) => {
    try {
      const res = await axiosClient.get(`/travel-documents/${requestId}`);
      setDocs(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch docs:', err);
    }
  };

  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f => f.size <= 10 * 1024 * 1024);
    setPendingFiles(prev => [...prev, ...valid]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const removePending = (index) => setPendingFiles(prev => prev.filter((_, i) => i !== index));

  const handleUpload = async () => {
    if (!pendingFiles.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      pendingFiles.forEach(f => formData.append('documents', f));
      formData.append('uploadedBy', JSON.parse(localStorage.getItem('user') || '{}').email || '');
      await axiosClient.post(`/travel-documents/${selected.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPendingFiles([]);
      await fetchDocs(selected.id);
      setAlert({ type: 'success', msg: 'Documents uploaded successfully' });
    } catch (err) {
      setAlert({ type: 'error', msg: 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await axiosClient.delete(`/travel-documents/${selected.id}/${docId}`);
      await fetchDocs(selected.id);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSend = async () => {
    if (!docs.length) return;
    setSending(true);
    try {
      await axiosClient.post(`/travel-documents/${selected.id}/send`);
      setAlert({ type: 'success', msg: `Travel documents emailed to ${selected.employee_email}` });
      await fetchApprovedRequests();
    } catch (err) {
      setAlert({ type: 'error', msg: err?.response?.data?.message || 'Failed to send email' });
    } finally {
      setSending(false);
    }
  };

  const getTravelSummary = (req) => {
    let tf = null;
    try { tf = req.travel_form_data ? (typeof req.travel_form_data === 'string' ? JSON.parse(req.travel_form_data) : req.travel_form_data) : null; } catch {}
    if (!tf) return '—';
    if (tf.travelType === 'domestic') return `Domestic → ${tf.cityOfTravelDomestic || '—'}`;
    if (tf.tripType === 'roundTrip') return `${tf.roundTrip?.fromCity || '—'} → ${tf.roundTrip?.toCity || '—'}`;
    if (tf.tripType === 'multiCity') return `Multi-City (${tf.multiCityLegs?.length || 0} legs)`;
    return tf.countryOfTravel || '—';
  };

  const getDepartureDate = (req) => {
    let tf = null;
    try { tf = req.travel_form_data ? (typeof req.travel_form_data === 'string' ? JSON.parse(req.travel_form_data) : req.travel_form_data) : null; } catch {}
    return tf?.roundTrip?.departureDate || tf?.dateOfTravel || tf?.multiCityLegs?.[0]?.date || '—';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <FlightTakeoff sx={{ color: 'primary.main' }} />
        <Typography variant="h5" fontWeight={800}>Travel Documents</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload and send travel documents (flights, hotel, visa, etc.) to employees for approved travel requests.
      </Typography>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : requests.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No approved travel requests found.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Route / Destination</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Departure</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req.id} hover>
                      <TableCell>#{req.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{req.employee_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{req.employee_email}</Typography>
                      </TableCell>
                      <TableCell>{getTravelSummary(req)}</TableCell>
                      <TableCell>{getDepartureDate(req)}</TableCell>
                      <TableCell>
                        {req.travel_docs_sent_at ? (
                          <Chip icon={<CheckCircle />} label="Docs Sent" color="success" size="small" />
                        ) : (
                          <Chip label="Pending Upload" color="warning" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" startIcon={<Visibility />}
                          onClick={() => openDialog(req)}>
                          Manage Docs
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FlightTakeoff color="primary" />
          Travel Documents — {selected?.employee_name} (Trip #{selected?.id})
        </DialogTitle>
        <DialogContent dividers>
          {alert && (
            <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
              {alert.msg}
            </Alert>
          )}

          {/* Drop zone */}
          <Box
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: `2px dashed ${dragActive ? 'primary.main' : '#ccc'}`,
              borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer',
              bgcolor: dragActive ? 'action.hover' : 'background.default',
              mb: 2, transition: 'all 0.2s',
              '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.light' }
            }}
          >
            <input ref={fileInputRef} type="file" multiple style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: '0' }}
              onChange={(e) => handleFiles(e.target.files)} />
            <CloudUpload sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
            <Typography variant="body2" fontWeight={500}>Drag & drop documents here or click to browse</Typography>
            <Typography variant="caption" color="text.secondary">Flights, hotel bookings, visa, itinerary — PDF, JPG, PNG (max 10MB each)</Typography>
          </Box>

          {/* Pending files to upload */}
          {pendingFiles.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Ready to upload ({pendingFiles.length})
              </Typography>
              <List dense>
                {pendingFiles.map((f, i) => (
                  <ListItem key={i} sx={{ bgcolor: 'action.hover', borderRadius: 1, mb: 0.5 }}
                    secondaryAction={
                      <IconButton size="small" color="error" onClick={() => removePending(i)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    }>
                    <ListItemIcon><InsertDriveFile color="primary" /></ListItemIcon>
                    <ListItemText primary={f.name} secondary={`${(f.size / 1024 / 1024).toFixed(2)} MB`} />
                  </ListItem>
                ))}
              </List>
              <Button variant="contained" size="small" onClick={handleUpload} disabled={uploading}
                startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <CloudUpload />}>
                {uploading ? 'Uploading...' : 'Upload Files'}
              </Button>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Already uploaded docs */}
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Uploaded Documents ({docs.length})
          </Typography>
          {docs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No documents uploaded yet.</Typography>
          ) : (
            <List dense>
              {docs.map(doc => (
                <ListItem key={doc.id} sx={{ bgcolor: 'success.50', borderRadius: 1, mb: 0.5, border: '1px solid', borderColor: 'success.light' }}
                  secondaryAction={
                    <Tooltip title="Remove document">
                      <IconButton size="small" color="error" onClick={() => handleDeleteDoc(doc.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }>
                  <ListItemIcon><InsertDriveFile color="success" /></ListItemIcon>
                  <ListItemText
                    primary={doc.original_name}
                    secondary={`Uploaded ${new Date(doc.uploaded_at).toLocaleString()}`} />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined">Close</Button>
          <Tooltip title={docs.length === 0 ? 'Upload at least one document before sending' : ''}>
            <span>
              <Button
                variant="contained"
                color="success"
                startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <Send />}
                onClick={handleSend}
                disabled={docs.length === 0 || sending}
              >
                {sending ? 'Sending...' : `Send to ${selected?.employee_name}`}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TravelDocuments;
