import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Tooltip } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import UploadFileIcon from '@mui/icons-material/UploadFile';

/**
 * AttachmentButton
 *
 * Renders a clickable button for an attachment file.
 * Performs a HEAD request to verify the file exists before allowing the user
 * to open it. If the file is missing (404), the button is shown as disabled
 * with a tooltip explaining the file is unavailable.
 *
 * When `onReplace` is provided (employee viewing their own request), a
 * "Re-upload" button appears next to missing files so they can replace them.
 *
 * Props:
 *   fileUrl    {string}    Full URL to the file
 *   label      {string}    Display label (original filename)
 *   onReplace  {function}  Called with (File) when user picks a replacement file.
 *   sx         {object}    Optional MUI sx overrides for the main button
 */
export default function AttachmentButton({ fileUrl, label, onReplace, sx = {} }) {
  const [status, setStatus] = useState('checking');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!fileUrl) { setStatus('missing'); return; }
    let cancelled = false;
    fetch(fileUrl, { method: 'HEAD' })
      .then((res) => { if (!cancelled) setStatus(res.ok ? 'available' : 'missing'); })
      .catch(() => { if (!cancelled) setStatus('missing'); });
    return () => { cancelled = true; };
  }, [fileUrl]);

  const displayLabel = label || 'Attachment';

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onReplace) return;
    e.target.value = '';
    setUploading(true);
    try { await onReplace(file); setStatus('available'); }
    catch { /* parent handles error toast */ }
    finally { setUploading(false); }
  };

  // Shared sx for all button states — ensures minimum 44px touch target on mobile
  const baseSx = {
    justifyContent: 'flex-start',
    textTransform: 'none',
    minHeight: 44,           // iOS HIG minimum touch target
    maxWidth: '100%',        // never overflow parent on mobile
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    ...sx,
  };

  if (status === 'checking') {
    return (
      <Button variant="outlined" size="small" disabled
        startIcon={<CircularProgress size={14} />}
        sx={baseSx}
      >
        {displayLabel}
      </Button>
    );
  }

  if (status === 'missing') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', maxWidth: '100%' }}>
        <Tooltip title="This file is no longer available on the server. Please re-upload using the button on the right.">
          <span style={{ maxWidth: '100%', overflow: 'hidden' }}>
            <Button
              variant="outlined"
              size="small"
              disabled
              startIcon={<BrokenImageIcon fontSize="small" />}
              sx={{
                ...baseSx,
                color: 'text.disabled',
                borderColor: 'divider',
                textDecoration: 'line-through',
              }}
            >
              {displayLabel}
            </Button>
          </span>
        </Tooltip>

        {onReplace && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.zip,.jfif,.PNG,.JPG,.JPEG,.PDF"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Button
              variant="contained"
              size="small"
              color="warning"
              startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : <UploadFileIcon fontSize="small" />}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: 'none', minHeight: 44 }}
            >
              {uploading ? 'Uploading…' : 'Re-upload'}
            </Button>
          </>
        )}
      </Box>
    );
  }

  // available — opens file in new tab
  return (
    <Button
      component="a"
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      variant="outlined"
      size="small"
      startIcon={<InsertDriveFileIcon fontSize="small" />}
      sx={baseSx}
    >
      {displayLabel}
    </Button>
  );
}
