// src/utils/helpers.ts

/**
 * Formats a given date string into a more readable format.
 * @param dateString - The date string (e.g., ISO 8601).
 * @returns Formatted date string.
 */
export const formatDate = (dateString: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

/**
 * Capitalizes the first letter of a string.
 * @param str - The input string.
 * @returns The string with the first letter capitalized.
 */
export const capitalizeFirstLetter = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Simulates an API call delay.
 * @param ms - Milliseconds to delay.
 */
export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Formats a price number to a currency string.
 * @param price - The price number.
 * @param currency - The currency code (e.g., 'USD', 'EUR').
 * @returns Formatted currency string.
 */
export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);