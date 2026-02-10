import { useState, useEffect } from 'react';

/**
 * Custom hook to access and use regional settings (currency, language, timezone)
 * These settings are stored in localStorage and can be updated from the Settings page
 */
export const useRegionalSettings = () => {
  const [settings, setSettings] = useState({
    currency: 'USD',
    language: 'en',
    timezone: 'UTC'
  });

  // Load settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem('regionalSettings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setSettings(parsed);
        }
      } catch (error) {
        console.error('Error loading regional settings:', error);
      }
    };

    loadSettings();

    // Listen for settings updates
    const handleSettingsUpdate = (event) => {
      if (event.detail) {
        setSettings({
          currency: event.detail.currency || 'USD',
          language: event.detail.language || 'en',
          timezone: event.detail.timezone || 'UTC'
        });
      }
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Helper function to format currency
  const formatCurrency = (amount, currencyOverride) => {
    const curr = currencyOverride || settings.currency;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: curr
      }).format(Number(amount || 0));
    } catch (error) {
      console.error('Error formatting currency:', error);
      return `${curr} ${amount}`;
    }
  };

  // Helper function to format date with timezone
  const formatDate = (date, options = {}) => {
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleString(settings.language, {
        timeZone: settings.timezone === 'IST' ? 'Asia/Kolkata' : 
                  settings.timezone === 'PST' ? 'America/Los_Angeles' :
                  settings.timezone === 'CET' ? 'Europe/Paris' : 'UTC',
        ...options
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return date?.toString() || '';
    }
  };

  return {
    currency: settings.currency,
    language: settings.language,
    timezone: settings.timezone,
    formatCurrency,
    formatDate
  };
};

export default useRegionalSettings;
