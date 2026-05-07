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
 *                          If omitted, no re-upload button is shown.
 *   sx         {object}    Optional MUI sx overrides for the main button
 */
export default function AttachmentButton({ fileUrl, label, onReplace, sx = {} }) {
  // 'checking' | 'available' | 'missing'
  const [status, setStatus] = useState('checking');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!fileUrl) {
      setStatus('missing');
      return;
    }

    let cancelled = false;

    fetch(fileUrl, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? 'available' : 'missing');
      })
      .catch(() => {
        if (!cancelled) setStatus('missing');
      });

    return () => { cancelled = true; };
  }, [fileUrl]);

  const displayLabel = label || 'Attachment';

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onReplace) return;
    e.target.value = '';
    setUploading(true);
    try {
      await onReplace(file);
      setStatus('available');
    } catch {
      // parent handles error toast
    } finally {
      setUploading(false);
    }
  };

  if (status === 'checking') {
    return (
      <Button
        variant="outlined"
        size="small"
        disabled
        startIcon={<CircularProgress size={12} />}
        sx={{ justifyContent: 'flex-start', textTransform: 'none', ...sx }}
      >
        {displayLabel}
      </Button>
    );
  }

  if (status === 'missing') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        <Tooltip title="This file is no longer available on the server (lost during a server migration). Please re-upload using the button on the right.">
          <span>
            <Button
              variant="outlined"
              size="small"
              disabled
              startIcon={<BrokenImageIcon fontSize="small" />}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: 'text.disabled',
                borderColor: 'divider',
                textDecoration: 'line-through',
                ...sx,
              }}
            >
              {displayLabel}
            </Button>
          </span>
        </Tooltip>

        {/* Re-upload button — only shown when the parent provides onReplace */}
        {onReplace && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.zip,.jfif,.PNG,.JPG,.JPEG,.PDF"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Tooltip title={`Re-upload "${displayLabel}"`}>
              <span>
                <Button
                  variant="contained"
                  size="small"
                  color="warning"
                  startIcon={uploading ? <CircularProgress size={12} color="inherit" /> : <UploadFileIcon fontSize="small" />}
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', py: 0.5 }}
                >
                  {uploading ? 'Uploading…' : 'Re-upload'}
                </Button>
              </span>
            </Tooltip>
          </>
        )}
      </Box>
    );
  }

  // available
  return (
    <Button
      component="a"
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      variant="outlined"
      size="small"
      startIcon={<InsertDriveFileIcon fontSize="small" />}
      sx={{ justifyContent: 'flex-start', textTransform: 'none', ...sx }}
    >
      {displayLabel}
    </Button>
  );
}
