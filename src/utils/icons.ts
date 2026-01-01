import { BillCategory } from '../types';

/**
 * Get the icon name for a bill category
 */
export const getBillCategoryIcon = (category?: BillCategory): string => {
  switch (category) {
    case 'food':
      return 'food';
    case 'transport':
      return 'car';
    case 'utilities':
      return 'home-lightning-bolt';
    case 'entertainment':
      return 'movie';
    case 'shopping':
      return 'shopping';
    case 'other':
    default:
      return 'receipt';
  }
};

/**
 * Get the icon name for a group category
 */
export const getGroupCategoryIcon = (category?: string): string => {
  switch (category) {
    case 'trip':
      return 'airplane';
    case 'roommates':
      return 'home';
    case 'event':
      return 'party-popper';
    case 'other':
    default:
      return 'folder-account';
  }
};
