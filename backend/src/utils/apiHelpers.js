/**
 * Utility functions for API request handling and error management
 */

/**
 * Create a standardized success response
 * @param {*} data - Response data
 * @param {string} message - Optional success message
 * @returns {Object} Standardized success response
 */
function createSuccessResponse(data, message = null) {
  return {
    success: true,
    data: data,
    ...(message && { message })
  };
}

/**
 * Create a standardized error response
 * @param {string} message - Error message
 * @param {*} error - Optional error details (only in development)
 * @returns {Object} Standardized error response
 */
function createErrorResponse(message, error = null) {
  const response = {
    success: false,
    message: message
  };

  // Include error details only in development mode
  if (process.env.NODE_ENV === 'development' && error) {
    response.error = error.message || error;
  }

  return response;
}

/**
 * Validate required fields in request body
 * @param {Object} body - Request body
 * @param {Array<string>} requiredFields - Array of required field names
 * @throws {Error} If any required field is missing
 */
function validateRequiredFields(body, requiredFields) {
  const missing = requiredFields.filter(field => !body[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} date - Date string to validate
 * @param {string} fieldName - Name of the field for error message
 * @throws {Error} If date format is invalid
 */
function validateDateFormat(date, fieldName) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(date)) {
    throw new Error(`Invalid ${fieldName} format. Expected YYYY-MM-DD`);
  }

  // Validate it's a real date
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid ${fieldName}. Not a valid date`);
  }
}

/**
 * Validate date range (end date must be after start date)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} startFieldName - Name of start date field
 * @param {string} endFieldName - Name of end date field
 * @throws {Error} If end date is not after start date
 */
function validateDateRange(startDate, endDate, startFieldName, endFieldName) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end <= start) {
    throw new Error(`${endFieldName} must be after ${startFieldName}`);
  }
}

/**
 * Handle async route errors
 * Wraps async route handlers to catch errors and pass to error middleware
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function with error handling
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Check if API credentials are configured
 * @param {string} apiKey - API key to check
 * @param {string} serviceName - Name of the service for error message
 * @throws {Error} If API key is not configured
 */
function validateApiCredentials(apiKey, serviceName) {
  if (!apiKey) {
    throw new Error(`${serviceName} API credentials not configured. Please contact system administrator.`);
  }
}

/**
 * Parse and handle API errors
 * @param {Error} error - Error object
 * @param {string} serviceName - Name of the service
 * @returns {Object} Parsed error information
 */
function parseApiError(error, serviceName) {
  const errorInfo = {
    service: serviceName,
    message: 'Service temporarily unavailable',
    statusCode: 503
  };

  // Rate limiting
  if (error.response && error.response.status === 429) {
    errorInfo.message = `${serviceName} is temporarily busy. Please try again in a moment.`;
    errorInfo.statusCode = 429;
  }
  // Authentication error
  else if (error.response && error.response.status === 401) {
    errorInfo.message = `${serviceName} authentication failed. Please contact support.`;
    errorInfo.statusCode = 401;
  }
  // Not found
  else if (error.response && error.response.status === 404) {
    errorInfo.message = `${serviceName} endpoint not found.`;
    errorInfo.statusCode = 404;
  }
  // Network/timeout errors
  else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    errorInfo.message = `${serviceName} is not responding. Please try again later.`;
    errorInfo.statusCode = 504;
  }
  // Validation errors
  else if (error.message && (error.message.includes('Missing required') || error.message.includes('Invalid'))) {
    errorInfo.message = error.message;
    errorInfo.statusCode = 400;
  }

  return errorInfo;
}

/**
 * Sanitize input to prevent injection attacks
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  validateRequiredFields,
  validateDateFormat,
  validateDateRange,
  asyncHandler,
  validateApiCredentials,
  parseApiError,
  sanitizeInput
};
