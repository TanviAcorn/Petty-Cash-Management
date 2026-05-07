import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Chip, Button, Stack,
  CircularProgress, Alert, Snackbar, Tooltip, Divider, IconButton,
  Collapse,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import axiosClient from '../api/axiosClient';

const statusColor = (s) => {
  switch ((s || '').toLowerCase()) {
    case 'approved': return 'success';
    case 'rejected': return 'error';
    case 'processed': return 'info';
    case 'payment done': return 'success';
    case 'pending': return 'warning';
    default: return 'default';
  }
};

function RequestRow({ row, onSendReminder, sendingId }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow hover>
        <TableCell>
          <IconButton size="small" onClick={() => setExpanded(p => !p)}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography fontWeight={600} variant="body2">#{row.id}</Typography>
        </TableCell>
        <TableCell>
          <Typography fontWeight={600} variant="body2">{row.employeeName}</Typography>
          <Typography variant="caption" color="text.secondary">{row.employeeEmail}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{row.company || '—'}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{row.category || '—'}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">
            {new Date(row.submittedAt).toLocaleDateString('en-GB')}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            label={row.status}
            color={statusColor(row.status)}
            variant="outlined"
            sx={{ textTransform: 'lowercase' }}
          />
        </TableCell>
        <TableCell align="center">
          <Chip
            size="small"
            icon={<BrokenImageIcon />}
            label={`${row.missingCount} / ${row.totalAttachments}`}
            color="error"
            variant="outlined"
          />
        </TableCell>
        <TableCell align="center">
          <Tooltip title={`Send re-upload reminder to ${row.employeeEmail}`}>
            <span>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={sendingId === row.id ? <CircularProgress size={12} /> : <EmailIcon fontSize="small" />}
                disabled={sendingId === row.id}
                onClick={() => onSendReminder(row)}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                Send Reminder
              </Button>
            </span>
          </Tooltip>
        </TableCell>
      </TableRow>

      {/* Expanded: list of missing files */}
      <TableRow>
        <TableCell colSpan={9} sx={{ py: 0, borderBottom: expanded ? undefined : 'none' }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1.5, px: 3, bgcolor: 'action.hover', borderRadius: 1, my: 0.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Missing Files ({row.missingCount})
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {row.missingFiles.map((f, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BrokenImageIcon fontSize="small" color="error" />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      <strong>{f.originalName}</strong>
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ({f.mimetype || 'unknown type'} · {f.size ? Math.round(f.size / 1024) + ' KB' : 'unknown size'})
                      </Typography>
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function MissingAttachments() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ affectedRequests: 0, totalMissingFiles: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [sentIds, setSentIds] = useState(new Set());
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await axiosClient.get('/requests/missing-attachments');
      setData(res.data || []);
      setSummary(res.summary || { affectedRequests: 0, totalMissingFiles: 0 });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleSendReminder = async (row) => {
    setSendingId(row.id);
    try {
      await axiosClient.post('/requests/send-reupload-reminder', {
        requestId: row.id,
        employeeEmail: row.employeeEmail,
        employeeName: row.employeeName,
        missingFiles: row.missingFiles.map(f => f.originalName),
      });
      setSentIds(prev => new Set([...prev, row.id]));
      setToast({ open: true, message: `Reminder sent to ${row.employeeEmail}`, severity: 'success' });
    } catch (err) {
      setToast({ open: true, message: err?.response?.data?.message || 'Failed to send reminder', severity: 'error' });
    } finally {
      setSendingId(null);
    }
  };

  const handleSendAllReminders = async () => {
    const unsent = data.filter(r => !sentIds.has(r.id));
    for (const row of unsent) {
      await handleSendReminder(row);
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Missing Attachments Report</Typography>
          <Typography variant="body2" color="text.secondary">
            Requests where employee-uploaded files were lost during the April 2026 server migration.
            Send reminder emails to ask employees to re-upload their files.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchReport}
            disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
          {data.length > 0 && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<EmailIcon />}
              onClick={handleSendAllReminders}
              disabled={loading || sendingId !== null || data.every(r => sentIds.has(r.id))}
              sx={{ textTransform: 'none' }}
            >
              Send All Reminders ({data.filter(r => !sentIds.has(r.id)).length})
            </Button>
          )}
        </Stack>
      </Box>

      {/* Summary cards */}
      {!loading && !error && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary">Affected Requests</Typography>
              <Typography variant="h4" fontWeight={800} color="error.main">{summary.affectedRequests}</Typography>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary">Total Missing Files</Typography>
              <Typography variant="h4" fontWeight={800} color="error.main">{summary.totalMissingFiles}</Typography>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary">Reminders Sent</Typography>
              <Typography variant="h4" fontWeight={800} color="success.main">{sentIds.size}</Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Info banner */}
      {!loading && !error && data.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>How this works:</strong> Click "Send Reminder" to email the employee asking them to log in and re-upload their missing files.
          Employees will see a <strong>"Re-upload"</strong> button next to each missing attachment on their request page.
          Once they re-upload, the file will be available immediately.
        </Alert>
      )}

      {/* Table */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : data.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main' }} />
              <Typography variant="h6" fontWeight={700} color="success.main">All attachments are present</Typography>
              <Typography variant="body2" color="text.secondary">No missing files detected.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={40} />
                    <TableCell>Request</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Submitted</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Missing / Total</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((row) => (
                    <RequestRow
                      key={row.id}
                      row={row}
                      onSendReminder={handleSendReminder}
                      sendingId={sendingId}
                      alreadySent={sentIds.has(row.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast(p => ({ ...p, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
