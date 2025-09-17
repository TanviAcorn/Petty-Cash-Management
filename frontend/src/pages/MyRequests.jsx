import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Search,
  FilterList,
  Visibility,
  Edit,
  Delete,
  Description,
  AttachMoney,
  CheckCircle,
  Schedule,
  Cancel
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  OutlinedInput,
  Snackbar,
  Alert
} from '@mui/material';

const MyRequests = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const navigate = useNavigate();

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editReq, setEditReq] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([
    'Unit 2B', 'Hitchin', 'TFC', 'TFC - Office', 'Acme', 'USA Site 1', 'USA Site 2', 'NL', 'PL', 'BE', 'Germany'
  ]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }, []);

  const load = async () => {
    if (!user?.email) {
      setError('No user email found. Please re-login.');
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/requests', { params: { email: user.email } });
      setRows(Array.isArray(data?.data || data) ? (data.data || data) : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load your requests');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Preload companies for edit dropdown
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axiosClient.get('/companies');
        setCompanies(Array.isArray(data) ? data : []);
      } catch { }
    })();
  }, []);

  // Preload categories for edit dropdown
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axiosClient.get('/categories');
        setCategories(Array.isArray(data) ? data : []);
      } catch { }
    })();
  }, []);

  const fmtMoney = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(n || 0));

  // Calculate dashboard stats
  const stats = useMemo(() => {
    const totalRequests = rows.length;
    const pending = rows.filter(r => r.status === 'pending').length;
    const approved = rows.filter(r => r.status === 'approved').length;
    const totalAmount = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return { totalRequests, pending, approved, totalAmount };
  }, [rows]);

  // Filter requests based on search and status
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const matchesSearch = !searchTerm ||
        row.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'All Status' || row.status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [rows, searchTerm, statusFilter]);

  const getStatusChip = (status) => {
    const s = String(status || '').toLowerCase();
    let color = 'warning';
    let label = 'pending';
    if (s === 'approved') { color = 'success'; label = 'approved'; }
    else if (s === 'rejected') { color = 'error'; label = 'rejected'; }
    else if (s === 'intercompany') { color = 'secondary'; label = 'intercompany'; }
    else if (s === 'payment done') { color = 'success'; label = 'payment done'; }
    else if (s) { label = s; }

    return (
      <Chip size="small" label={label} color={color} variant="outlined" sx={{ textTransform: 'lowercase' }} />
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box>
        <Typography variant="h5" fontWeight={700}>My Requests</Typography>
        <Typography variant="body2" color="text.secondary">Track and manage your petty cash reimbursement requests</Typography>
      </Box>

      {/* Dashboard Cards */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
            <Box sx={{
              bgcolor: '#e3f2fd',
              borderRadius: 2,
              p: 1.5,
              mr: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Description sx={{ color: '#1976d2', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Total Requests
              </Typography>
              <Typography variant="h6" fontWeight={800}>
                {stats.totalRequests}
              </Typography>
            </Box>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
            <Box sx={{
              bgcolor: '#fff3e0',
              borderRadius: 2,
              p: 1.5,
              mr: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Schedule sx={{ color: '#f57c00', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Pending
              </Typography>
              <Typography variant="h6" fontWeight={800}>
                {stats.pending}
              </Typography>
            </Box>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
            <Box sx={{
              bgcolor: '#e8f5e8',
              borderRadius: 2,
              p: 1.5,
              mr: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle sx={{ color: '#2e7d32', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Approved
              </Typography>
              <Typography variant="h6" fontWeight={800}>
                {stats.approved}
              </Typography>
            </Box>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
            <Box sx={{
              bgcolor: '#e8f5e8',
              borderRadius: 2,
              p: 1.5,
              mr: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AttachMoney sx={{ color: '#2e7d32', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Total Amount
              </Typography>
              <Typography variant="h6" fontWeight={800}>
                {fmtMoney(stats.totalAmount)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">Your Requests</Typography>
          <Typography variant="body2" color="text.secondary">All your petty cash reimbursement requests</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/new-request">New Request</Button>
      </Box>

      {/* Filters Card */}
      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            fullWidth
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 520, flex: 1 }}
          />
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Status Filter</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status Filter"
              input={<OutlinedInput label="Status Filter" />}
            >
              <MenuItem value="All Status">All Status</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Approved">Approved</MenuItem>
              <MenuItem value="Rejected">Rejected</MenuItem>
              <MenuItem value="In-review">In Review</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Table Content */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={32} />
            </Box>
          ) : filteredRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 8 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                {rows.length === 0 ? 'No requests found' : 'No matching requests'}
              </Typography>
              <Typography variant="body2">
                {error || (rows.length === 0 ? 'Create a new petty cash request to get started.' : 'Try adjusting your search or filter criteria.')}
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Company</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Amount</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="left">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((r, index) => (
                  <TableRow
                    key={r.id || index}
                    hover
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" fontWeight="medium">
                        {r.dateOfPurchase ? new Date(r.dateOfPurchase).toLocaleDateString() :
                          r.date ? new Date(r.date).toLocaleDateString() : '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Submitted: {r.createdAt ? new Date(r.createdAt).toLocaleDateString() :
                          r.date ? new Date(r.date).toLocaleDateString() : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={r.category}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {r.company}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {r.location}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold">
                        {fmtMoney(r.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(r.status)}
                    </TableCell>
                    <TableCell align="left">
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton size="small" sx={{ color: '#1976d2' }} onClick={() => navigate(`/my-requests/${r.id}`)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {String(r.status).toLowerCase() === 'pending' && (
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              sx={{ color: '#f57c00' }}
                              onClick={() => {
                                setEditReq({
                                  id: r.id,
                                  company: r.company || '',
                                  category: r.category || '',
                                  location: r.location || '',
                                  amount: r.amount || '',
                                  description: r.description || r.reason || '',
                                  dateOfPurchase: r.dateOfPurchase || r.date || '',
                                });
                                setEditOpen(true);
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                          <Tooltip title="Delete">
                            <IconButton size="small" sx={{ color: '#d32f2f' }} onClick={async () => {
                              if (!window.confirm('Delete this request? This cannot be undone.')) return;
                              try {
                                await axiosClient.delete(`/requests/${r.id}`);
                                setToast({ open: true, message: 'Request deleted', severity: 'success' });
                                load();
                              } catch (e) {
                                setToast({ open: true, message: e?.response?.data?.message || 'Failed to delete', severity: 'error' });
                              }
                            }}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Request Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Request</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel id="edit-company">Company</InputLabel>
                <Select
                  labelId="edit-company"
                  value={editReq?.company || ''}
                  label="Company"
                  onChange={(e) => setEditReq(prev => ({ ...prev, company: e.target.value }))}
                  input={<OutlinedInput label="Company" />}
                >
                  {companies.map(c => (
                    <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel id="edit-category">Category</InputLabel>
                <Select
                  labelId="edit-category"
                  value={editReq?.category || ''}
                  label="Category"
                  onChange={(e) => setEditReq(prev => ({ ...prev, category: e.target.value }))}
                  input={<OutlinedInput label="Category" />}
                >
                  {categories.map(c => (
                    <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel id="edit-location">Location</InputLabel>
                <Select
                  labelId="edit-location"
                  value={editReq?.location || ''}
                  label="Location"
                  onChange={(e) => setEditReq(prev => ({ ...prev, location: e.target.value }))}
                  input={<OutlinedInput label="Location" />}
                >
                  {locations.map(loc => (
                    <MenuItem key={loc} value={loc}>{loc}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" type="number" label="Amount" value={editReq?.amount || ''} onChange={(e) => setEditReq(prev => ({ ...prev, amount: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" type="date" label="Date of Purchase" InputLabelProps={{ shrink: true }} value={editReq?.dateOfPurchase ? String(editReq.dateOfPurchase).substring(0, 10) : ''} onChange={(e) => setEditReq(prev => ({ ...prev, dateOfPurchase: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" multiline minRows={2} label="Description" value={editReq?.description || ''} onChange={(e) => setEditReq(prev => ({ ...prev, description: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={saving} onClick={async () => {
            try {
              setSaving(true);
              await axiosClient.put(`/requests/${editReq.id}`, {
                company: editReq.company,
                category: editReq.category,
                amount: editReq.amount,
                location: editReq.location,
                description: editReq.description,
                dateOfPurchase: editReq.dateOfPurchase
              });
              setToast({ open: true, message: 'Request updated', severity: 'success' });
              setEditOpen(false);
              load();
            } catch (e) {
              setToast({ open: true, message: e?.response?.data?.message || 'Failed to update', severity: 'error' });
            } finally {
              setSaving(false);
            }
          }}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast(prev => ({ ...prev, open: false }))}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default MyRequests;
