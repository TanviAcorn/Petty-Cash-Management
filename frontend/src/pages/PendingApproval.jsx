import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  OutlinedInput,
  Button,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Checkbox,
  Chip,
  Avatar,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextareaAutosize,
  Snackbar,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaylistAddCheckCircleIcon from '@mui/icons-material/PlaylistAddCheckCircle';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import axiosClient from '../api/axiosClient';
import { alpha } from '@mui/material/styles';

const StatCard = ({ icon, label, value, color = 'primary' }) => (
  <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, bgcolor: 'background.paper', borderColor: 'divider' }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 2.5 }}>
      <Box sx={(theme)=>({ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1, bgcolor: alpha(theme.palette[color].main, 0.15), color: theme.palette[color].main })}>
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={700}>{value}</Typography>
      </Box>
    </CardContent>
  </Card>
);

const statusColor = (s) => {
  switch ((s || '').toLowerCase()) {
    case 'approved': return { color: 'success', label: 'approved' };
    case 'rejected': return { color: 'error', label: 'rejected' };
    case 'intercompany': return { color: 'secondary', label: 'intercompany' };
    default: return { color: 'warning', label: 'pending' };
  }
};

const PendingApproval = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected] = useState([]);
  const [actionDialog, setActionDialog] = useState({
    open: false,
    requestId: null,
    action: '', // 'approve' or 'reject'
    rejectionReason: '',
    approvalReason: '',
  });
  const navigate = useNavigate();
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch only pending requests to align with page purpose
        const { data } = await axiosClient.get('/requests', { params: { status: 'pending' }, signal: controller.signal });
        const list = Array.isArray(data?.data || data) ? (data.data || data) : [];
        setRows(list);
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Failed to load requests');
        setRows([]);
      } finally { setLoading(false); }
    };
    fetchData();
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.length; // page contains only pending
    const approved = 0;
    const rejected = 0;
    return { total, pending, approved, rejected };
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = rows; // already pending-only from server
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        String(r.employeeName || '').toLowerCase().includes(s) ||
        String(r.company || '').toLowerCase().includes(s) ||
        String(r.category || '').toLowerCase().includes(s) ||
        String(r.reason || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [rows, statusFilter, search]);

  const displayName = (r) => {
    if (r.employeeName && r.employeeName.toLowerCase() !== 'unknown user') return r.employeeName;
    const email = r.employeeEmail || '';
    const namePart = email.split('@')[0] || '';
    if (!namePart) return 'User';
    return namePart.replace(/[._-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  };

  const handleActionClick = (requestId, action) => {
    setActionDialog({
      open: true,
      requestId,
      action,
      rejectionReason: '',
      approvalReason: '',
    });
  };

  const handleActionConfirm = async () => {
    try {
      const { requestId, action, rejectionReason, approvalReason } = actionDialog;
      
      // Show loading state
      setLoading(true);
      
      // Make the API call to update status
      const response = await axiosClient.put(`/requests/${requestId}/status`, {
        status: action === 'approve' ? 'approved' : 'rejected',
        ...(action === 'reject' ? { rejectionReason } : { approvalReason })
      });

      // Refresh the data from server
      const { data } = await axiosClient.get('/requests', { 
        params: { status: 'pending' },
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const updatedList = Array.isArray(data?.data || data) ? (data.data || data) : [];
      setRows(updatedList);
      
      showSnackbar(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`, 'success');
    } catch (error) {
      console.error('Error updating request status:', error);
      showSnackbar(`Failed to update request status: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setLoading(false);
      handleCloseDialog();
    }
  };

  const handleCloseDialog = () => {
    setActionDialog({
      open: false,
      requestId: null,
      action: '',
      rejectionReason: '',
      approvalReason: '',
    });
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({
      ...prev,
      open: false,
    }));
  };

  const toggleSelectAll = (checked) => {
    if (checked) setSelected(filteredRows.map(r => r.id));
    else setSelected([]);
  };
  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Pending Approval</Typography>
          <Typography variant="body2" color="text.secondary">Review and approve petty cash reimbursement requests</Typography>
        </Box>
      </Box>

      {/* Stat Cards */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <StatCard icon={<PlaylistAddCheckCircleIcon />} label="Total Requests" value={stats.total} color="info" />
        <StatCard icon={<AccessTimeOutlinedIcon />} label="Pending" value={stats.pending} color="warning" />
        <StatCard icon={<CheckCircleOutlineIcon />} label="Approved" value={stats.approved} color="success" />
        <StatCard icon={<CancelOutlinedIcon />} label="Rejected" value={stats.rejected} color="error" />
      </Box>

      {/* Filters Card - match Approved spacing */}
      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search requests..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="action"/></InputAdornment>) }}
            sx={{ width: 320, maxWidth: '100%' }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select input={<OutlinedInput />} value={statusFilter} disabled>
              <MenuItem value="pending">Pending</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Requests Table - compact like Approved */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        {error || 'No requests found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => {
                      const sc = statusColor(r.status);
                      return (
                        <TableRow key={r.id || `${r.employeeName}-${r.createdAt}`} hover>
                          <TableCell sx={{ minWidth: 260 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box>
                                <Typography fontWeight={600} lineHeight={1.2}>{r.employeeName}</Typography>
                                <Typography variant="caption" color="text.secondary">{r.employeeEmail || ''}</Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {r.date ? new Date(r.date).toLocaleDateString() : '-'}
                            <Typography variant="caption" color="text.secondary" display="block">Requested: {r.date ? new Date(r.date).toLocaleDateString() : '-'}</Typography>
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.company}</TableCell>
                          <TableCell>{r.location}</TableCell>
                          <TableCell align="right">{new Intl.NumberFormat(undefined, { style: 'currency', currency: r.currency || 'USD' }).format(Number(r.amount || 0))}</TableCell>
                          <TableCell>
                            <Chip size="small" label={sc.label} color={sc.color} variant="outlined" sx={{ textTransform: 'lowercase' }} />
                          </TableCell>
                          <TableCell align="center" sx={{ minWidth: 120 }}>
                            <IconButton 
                              color="success" 
                              size="small" 
                              aria-label="approve"
                              onClick={() => handleActionClick(r.id, 'approve')}
                            >
                              <CheckOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              color="error" 
                              size="small" 
                              aria-label="reject"
                              onClick={() => handleActionClick(r.id, 'reject')}
                            >
                              <CloseOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" aria-label="view details" onClick={() => navigate(`/requests/${r.id}`)}>
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialog.open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionDialog.action === 'approve' ? 'Approve Request' : 'Reject Request'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {actionDialog.action === 'approve' 
              ? 'Please provide a reason for approval:' 
              : 'Please provide a reason for rejection:'}
          </DialogContentText>
          <TextareaAutosize
            autoFocus
            margin="dense"
            id="reason"
            placeholder={`Enter reason for ${actionDialog.action}`}
            minRows={3}
            style={{ width: '100%', marginTop: '16px', padding: '8px' }}
            value={actionDialog.action === 'approve' ? actionDialog.approvalReason : actionDialog.rejectionReason}
            onChange={(e) => setActionDialog(prev => ({
              ...prev,
              ...(actionDialog.action === 'approve' 
                ? { approvalReason: e.target.value }
                : { rejectionReason: e.target.value })
            }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleActionConfirm} 
            color={actionDialog.action === 'approve' ? 'success' : 'error'}
            variant="contained"
            disabled={
              (actionDialog.action === 'reject' && !actionDialog.rejectionReason.trim()) ||
              (actionDialog.action === 'approve' && !actionDialog.approvalReason.trim())
            }
          >
            {actionDialog.action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PendingApproval;
