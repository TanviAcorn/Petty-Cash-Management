import React from 'react';
import { Box, Typography } from '@mui/material';

const PendingApproval = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Pending Approval</Typography>
      <Typography>Requests awaiting your approval</Typography>
    </Box>
  );
};

export default PendingApproval;
