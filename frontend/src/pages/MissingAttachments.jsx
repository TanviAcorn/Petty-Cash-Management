import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Chip, Button, Stack,
  CircularProgress, Alert, Snackbar, Tooltip, IconButton, Collapse,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
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
    case 'attachment reuploaded': return 'success';
    case 'pending': return 'warning';
    default: return 'default';
  }
};

const isResolved = (row) =>
  (row.status || '').toLowerCase() === 'attachment reuploaded' || row.missingCount === 0;

// ── Per-row component ─────────────────────────────────────────────────────
function RequestRow({ row, onUpload, uploadingId }) {
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef(null);
  const resolved = isResolved(row);
  const uploading = uploadingId === row.id;

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    await onUpload(row, files);
  };

  return (
    <>
      <TableRow hover sx={{ bgcolor: resolved ? 'success.50' : undefined }}>
        {/* Expand toggle */}
        <TableCell>
          <IconButton size="small" onClick={() => setExpanded(p => !p)}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>

        {/* Request ID */}
        <TableCell>
          <Typography fontWeight={600} variant="body2">#{row.id}</Typography>
        </TableCell>

        {/* Employee */}
        <TableCell>
          <Typography fontWeight={600} variant="body2">{row.employeeName}</Typography>
          <Typography variant="caption" color="text.secondary">{row.employeeEmail}</Typography>
        </TableCell>

        {/* Company */}
        <TableCell>
          <Typography variant="body2">{row.company || '—'}</Typography>
        </TableCell>

        {/* Category */}
        <TableCell>
          <Typography variant="body2">{row.category || '—'}</Typography>
        </TableCell>

        {/* Submitted */}
        <TableCell>
          <Typography variant="body2">
            {new Date(row.submittedAt).toLocaleDateString('en-GB')}
          </Typography>
        </TableCell>

        {/* Status */}
        <TableCell>
          <Chip
            size="small"
            label={resolved ? 'Attachment Reuploaded' : row.status}
            color={resolved ? 'success' : statusColor(row.status)}
            variant={resolved ? 'filled' : 'outlined'}
            icon={resolved ? <CheckCircleIcon /> : undefined}
            sx={{ textTransform: 'lowercase' }}
          />
        </TableCell>

        {/* Missing / Total */}
        <TableCell align="center">
          {resolved ? (
            <Chip size="small" icon={<CheckCircleIcon />} label="Resolved" color="success" variant="outlined" />
          ) : (
            <Chip
              size="small"
              icon={<BrokenImageIcon />}
              label={`${row.missingCount} / ${row.totalAttachments}`}
              color="error"
              variant="outlined"
            />
          )}
        </TableCell>

        {/* Action — Upload button */}
        <TableCell align="center">
          {resolved ? (
            <Typography variant="caption" color="success.main" fontWeight={600}>✓ Uploaded</Typography>
          ) : (
            <>
              {/* Visually-hidden file input — works on iOS/Android */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.zip,.jfif"
                style={{
                  position: 'absolute', width: '1px', height: '1px',
                  padding: 0, margin: '-1px', overflow: 'hidden',
                  clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0,
                }}
                onChange={handleFileChange}
              />
              <Tooltip title={`Upload missing files for ${row.employeeName} (Request #${row.id})`}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={uploading ? <CircularProgress size={12} color="inherit" /> : <UploadFileIcon fontSize="small" />}
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded: list of missing files */}
      <TableRow>
        <TableCell colSpan={9} sx={{ py: 0, borderBottom: expanded ? undefined : 'none' }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1.5, px: 3, bgcolor: 'action.hover', borderRadius: 1, my: 0.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {resolved
                  ? 'Previously Missing Files (now resolved)'
                  : `Missing Files (${row.missingCount}) — click Upload to restore them`}
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {row.missingFiles.map((f, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {resolved
                      ? <CheckCircleIcon fontSize="small" color="success" />
                      : <BrokenImageIcon fontSize="small" color="error" />}
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

// ── Main page ─────────────────────────────────────────────────────────────
export default function MissingAttachments() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ affectedRequests: 0, totalMissingFiles: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await axiosClient.get('/requests/missing-attachments');
      const rows = res.data || [];
      setData(rows);
      setSummary(res.summary || { affectedRequests: 0, totalMissingFiles: 0 });
      setResolvedCount(rows.filter(isResolved).length);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Admin uploads files on behalf of an employee
  const handleUpload = async (row, files) => {
    setUploadingId(row.id);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('attachments', f));

      await axiosClient.post(`/requests/${row.id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setToast({
        open: true,
        message: `${files.length} file(s) uploaded for ${row.employeeName} (Request #${row.id})`,
        severity: 'success',
      });

      // Refresh the report so the row updates to "Resolved"
      await fetchReport();
    } catch (err) {
      setToast({
        open: true,
        message: err?.response?.data?.message || 'Upload failed',
        severity: 'error',
      });
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Missing Attachments</Typography>
          <Typography variant="body2" color="text.secondary">
            Requests where employee-uploaded files were lost during the April 2026 server migration.
            Click <strong>Upload</strong> on any row to restore the missing files on behalf of the employee.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchReport}
          disabled={loading}
          sx={{ textTransform: 'none' }}
        >
          Refresh
        </Button>
      </Box>

      {/* Summary cards */}
      {!loading && !error && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, mb: 3 }}>
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
              <Typography variant="caption" color="text.secondary">Resolved</Typography>
              <Typography variant="h4" fontWeight={800} color="success.main">{resolvedCount}</Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Info banner */}
      {!loading && !error && data.filter(r => !isResolved(r)).length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>How to restore:</strong> Click the <strong>Upload</strong> button on any row, select the file(s) from your computer,
          and they will be uploaded directly to the employee's request. The status will update to "Attachment Reuploaded" automatically.
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
                      onUpload={handleUpload}
                      uploadingId={uploadingId}
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
        autoHideDuration={5000}
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
