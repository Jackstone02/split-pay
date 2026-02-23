/**
 * Format a number with comma separators
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with commas
 */
export const formatCurrency = (value: number, decimals: number = 2): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
  SGD: 'S$',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
};

/**
 * Format amount with the given currency symbol and commas.
 * Defaults to PHP (₱) when currencyCode is not provided or unrecognised.
 */
export const formatAmount = (amount: number, currencyCode?: string): string => {
  const symbol = (currencyCode && CURRENCY_SYMBOLS[currencyCode]) ?? '₱';
  return `${symbol}${formatCurrency(Math.abs(amount))}`;
};

/**
 * Format amount with Philippine Peso symbol and commas (backward-compatible alias).
 */
export const formatPeso = (amount: number): string => formatAmount(amount, 'PHP');
