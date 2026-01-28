import { Platform, Dimensions } from 'react-native';

/**
 * Detect if the current device is a tablet (iPad)
 */
export const isTablet = (): boolean => {
  if (Platform.OS === 'ios') {
    return Platform.isPad || false;
  }

  // For Android, consider devices with width >= 600dp as tablets
  const { width, height } = Dimensions.get('window');
  const aspectRatio = height / width;
  return (width >= 600 || height >= 600) && aspectRatio < 1.6;
};

/**
 * Get responsive padding based on device type
 */
export const getResponsivePadding = (mobilePadding: number, tabletMultiplier: number = 1.5): number => {
  return isTablet() ? mobilePadding * tabletMultiplier : mobilePadding;
};

/**
 * Get responsive font size based on device type
 */
export const getResponsiveFontSize = (baseFontSize: number, tabletMultiplier: number = 1.2): number => {
  return isTablet() ? baseFontSize * tabletMultiplier : baseFontSize;
};

/**
 * Get responsive dimensions for layouts
 */
export const getResponsiveDimensions = () => {
  const { width, height } = Dimensions.get('window');
  const tablet = isTablet();

  return {
    isTablet: tablet,
    screenWidth: width,
    screenHeight: height,
    maxContentWidth: tablet ? 800 : width,
    horizontalPadding: tablet ? 40 : 16,
  };
};
