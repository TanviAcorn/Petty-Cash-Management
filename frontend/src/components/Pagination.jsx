import React from 'react';
import {
  Box,
  Button,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';

const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  loading = false,
  showItemsPerPageSelector = true,
  showTotalItems = true,
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && !loading) {
      onPageChange(newPage);
    }
  };

  const handleItemsPerPageChange = (event) => {
    const newItemsPerPage = parseInt(event.target.value, 10);
    onItemsPerPageChange(newItemsPerPage);
  };

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        p: 2,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {/* Items per page selector */}
      {showItemsPerPageSelector && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Rows per page:
          </Typography>
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              disabled={loading}
            >
              <MenuItem value={5}>5</MenuItem>
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Total items info */}
      {showTotalItems && totalItems > 0 && (
        <Typography variant="body2" color="text.secondary">
          {startItem}-{endItem} of {totalItems} items
        </Typography>
      )}

      {/* Pagination controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Page numbers */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {getVisiblePages().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                  ...
                </Typography>
              ) : (
                <Button
                  variant={currentPage === page ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => handlePageChange(page)}
                  disabled={loading}
                  sx={{ minWidth: 36, height: 32 }}
                >
                  {page}
                </Button>
              )}
            </React.Fragment>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default Pagination;
