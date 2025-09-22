const axios = require('axios');

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/GBP';
let ratesCache = {};
let lastUpdated = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

async function getExchangeRate(fromCurrency, toCurrency = 'GBP') {
    try {
        const now = Date.now();
        
        // Use cached rates if they're still valid
        if (lastUpdated && (now - lastUpdated) < CACHE_DURATION && ratesCache[fromCurrency]) {
            return ratesCache[fromCurrency];
        }
        
        // Fetch fresh rates
        const response = await axios.get(EXCHANGE_RATE_API);
        ratesCache = response.data.rates;
        lastUpdated = now;
        
        if (!ratesCache[fromCurrency]) {
            throw new Error(`Unsupported currency: ${fromCurrency}`);
        }
        
        // Convert to target currency (default: GBP)
        return toCurrency === 'GBP' 
            ? ratesCache[fromCurrency] 
            : ratesCache[toCurrency] / ratesCache[fromCurrency];
            
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        // Fallback rates if API fails
        const fallbackRates = {
            'INR': 100,
            'USD': 1.3,
            'EUR': 1.1,
            'GBP': 1
        };
        return fallbackRates[fromCurrency] || 1;
    }
}

module.exports = { getExchangeRate };