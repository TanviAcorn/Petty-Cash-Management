/**
 * Formats a number as a currency string with proper error handling
 * @param {number|string} amount - The amount to format
 * @param {string} [currency='GBP'] - The currency code (defaults to GBP)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'GBP') => {
  try {
    // Ensure amount is a valid number
    const amountValue = Number(amount) || 0;
    
    // Get a safe currency code with fallbacks
    let safeCurrency = 'GBP'; // Default fallback
    if (currency && typeof currency === 'string' && currency.trim() !== '') {
      const trimmedCurrency = currency.trim().toUpperCase();
      // Only use the provided currency if it's a valid ISO 4217 currency code (basic check)
      if (/^[A-Z]{3}$/.test(trimmedCurrency)) {
        safeCurrency = trimmedCurrency;
      }
    }
    
    // Format the amount with the currency
    return new Intl.NumberFormat(undefined, { 
      style: 'currency', 
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amountValue);
  } catch (error) {
    console.error('Error formatting currency:', error, { amount, currency });
    // Fallback to basic formatting if Intl.NumberFormat fails
    return `£${(Number(amount) || 0).toFixed(2)}`;
  }
};

/**
 * Gets the currency symbol for a given currency code
 * @param {string} [currency='GBP'] - The currency code
 * @returns {string} The currency symbol
 */
export const getCurrencySymbol = (currency = 'GBP') => {
  try {
    let safeCurrency = 'GBP';
    if (currency && typeof currency === 'string' && currency.trim() !== '') {
      const trimmedCurrency = currency.trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(trimmedCurrency)) {
        safeCurrency = trimmedCurrency;
      }
    }
    return (0)
      .toLocaleString(undefined, {
        style: 'currency',
        currency: safeCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/[0-9.,\s]/g, '');
  } catch (error) {
    console.error('Error getting currency symbol:', error, { currency });
    return '£';
  }
};
