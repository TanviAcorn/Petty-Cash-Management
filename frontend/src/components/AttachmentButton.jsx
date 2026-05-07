import React, { useEffect, useState } from 'react';
import { Button, Tooltip, CircularProgress } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';

/**
 * AttachmentButton
 *
 * Renders a clickable button for an attachment file.
 * Performs a HEAD request to verify the file exists before allowing the user
 * to open it. If the file is missing (404), the button is shown as disabled
 * with a tooltip explaining the file is unavailable.
 *
 * Props:
 *   fileUrl   {string}  Full URL to the file (e.g. https://host/api/file/xxx.pdf)
 *   label     {string}  Display label (original filename)
 *   sx        {object}  Optional MUI sx overrides
 */
export default function AttachmentButton({ fileUrl, label, sx = {} }) {
  // 'checking' | 'available' | 'missing'
  const [status, setStatus] = useState('checking');

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
      <Tooltip title="This file is no longer available on the server (it may have been lost during a server migration). Please contact the employee to re-upload.">
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
