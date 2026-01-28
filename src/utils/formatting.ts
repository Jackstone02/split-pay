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

/**
 * Format amount with Philippine Peso symbol and commas
 * @param amount - The amount to format
 * @param showSign - Whether to show + or - sign (default: false)
 * @returns Formatted currency string (e.g., "₱1,234.56" or "+₱1,234.56")
 */
export const formatPeso = (amount: number, showSign: boolean = false): string => {
  const formattedAmount = formatCurrency(Math.abs(amount));

//   if (showSign) {
//     const sign = amount >= 0 ? '+' : '-';
//     return `${sign}₱${formattedAmount}`;
//   }

  return `₱${formattedAmount}`;
};
