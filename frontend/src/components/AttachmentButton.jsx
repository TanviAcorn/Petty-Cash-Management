import React, { useRef, useState } from 'react';
import { Box, Button, CircularProgress, Tooltip } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import UploadFileIcon from '@mui/icons-material/UploadFile';

/**
 * AttachmentButton
 *
 * Renders a clickable link-button for an attachment file.
 *
 * Design decision: We no longer do a HEAD check before rendering.
 * The HEAD check was causing all attachments to appear as "checking" or
 * "missing" on mobile devices due to network timing and CORS preflight
 * issues. Instead we render the link immediately and rely on the backend's
 * /api/file/:filename endpoint which returns a user-friendly HTML 404 page
 * when a file is genuinely missing.
 *
 * Files that are known to be missing (passed via `isMissing` prop from the
 * MissingAttachments admin page) still show the strikethrough + Re-upload UI.
 *
 * Props:
 *   fileUrl    {string}    Full URL to the file
 *   label      {string}    Display label (original filename)
 *   onReplace  {function}  Called with (File) when user picks a replacement.
 *                          When provided AND isMissing=true, shows Re-upload button.
 *   isMissing  {boolean}   Explicitly mark as missing (from server-side check).
 *                          Default: false — renders as available link.
 *   sx         {object}    Optional MUI sx overrides
 */
export default function AttachmentButton({ fileUrl, label, onReplace, isMissing = false, sx = {} }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const displayLabel = label || 'Attachment';

  // Shared sx — 44px min touch target (iOS HIG), filename truncation
  const baseSx = {
    justifyContent: 'flex-start',
    textTransform: 'none',
    minHeight: 44,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    ...sx,
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onReplace) return;
    e.target.value = '';
    setUploading(true);
    try { await onReplace(file); }
    catch { /* parent handles error toast */ }
    finally { setUploading(false); }
  };

  // ── Missing file (explicitly flagged) ────────────────────────────────────
  if (isMissing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', maxWidth: '100%' }}>
        <Tooltip title="This file is no longer available on the server. Please re-upload using the button on the right.">
          <span style={{ maxWidth: '100%', overflow: 'hidden' }}>
            <Button
              variant="outlined"
              size="small"
              disabled
              startIcon={<BrokenImageIcon fontSize="small" />}
              sx={{ ...baseSx, color: 'text.disabled', borderColor: 'divider', textDecoration: 'line-through' }}
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

  // ── Available file — render as direct link, no HEAD check ────────────────
  if (!fileUrl) {
    return (
      <Button variant="outlined" size="small" disabled sx={baseSx}>
        {displayLabel}
      </Button>
    );
  }

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
