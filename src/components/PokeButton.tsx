import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { supabaseApi } from '../services/supabaseApi';
import { sendPokeNotification, getDeviceId } from '../services/notificationService';
import { AuthContext } from '../context/AuthContext';
import ConfirmationModal from './ConfirmationModal';
import { useConfirmationModal } from '../hooks/useConfirmationModal';

export interface PokeButtonProps {
  friendId: string;
  friendName: string;
  billId?: string;
  billTitle?: string;
  amount?: number;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'button';
  onPokeSuccess?: () => void;
  onPokeError?: (error: string) => void;
}

const PokeButton: React.FC<PokeButtonProps> = ({
  friendId,
  friendName,
  billId,
  billTitle,
  amount,
  disabled = false,
  size = 'small',
  variant = 'button',
  onPokeSuccess,
  onPokeError,
}) => {
  const [loading, setLoading] = useState(false);
  const modal = useConfirmationModal();
  const authContext = React.useContext(AuthContext);
  const user = authContext?.user;

  const handlePoke = async () => {
    if (!user) {
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: 'You must be logged in to send a poke',
        confirmText: 'OK',
        showCancel: false,
      });
      return;
    }

    setLoading(true);

    try {
      // Get friend's push token
      const friendPushToken = await supabaseApi.getPushToken(friendId);

      if (!friendPushToken) {
        modal.showModal({
          type: 'warning',
          title: 'Notifications Disabled',
          message: `${friendName} hasn't enabled notifications yet. They won't receive this poke.`,
          confirmText: 'Send Anyway',
          cancelText: 'Cancel',
          showCancel: true,
          onConfirm: async () => {
            await completePoke(null);
          },
          onCancel: () => {
            setLoading(false);
          },
        });
        return;
      }

      await completePoke(friendPushToken);
    } catch (error: any) {
      console.error('Error sending poke:', error);
      const errorMessage = error?.message || 'Failed to send poke. Please try again.';

      modal.showModal({
        type: 'error',
        title: 'Poke Failed',
        message: errorMessage,
        confirmText: 'Retry',
        cancelText: 'Cancel',
        showCancel: true,
        onConfirm: async () => {
          await handlePoke();
        },
      });

      onPokeError?.(errorMessage);
      setLoading(false);
    }
  };

  const completePoke = async (pushToken: string | null) => {
    try {
      // Save poke to database
      await supabaseApi.sendPoke({
        fromUserId: user!.id,
        toUserId: friendId,
        billId,
        amount,
        message: billTitle ? `Reminder about "${billTitle}"` : undefined,
      });

      // Send push notification if token exists
      if (pushToken) {
        await sendPokeNotification({
          fromUserId: user!.id,
          fromUserName: user!.name,
          toUserId: friendId,
          toPushToken: pushToken,
          billId,
          billTitle,
          amount,
        });
      }

      // Create activity records for both sender and recipient
      await supabaseApi.createPokeActivity({
        fromUserId: user!.id,
        fromUserName: user!.name,
        toUserId: friendId,
        toUserName: friendName,
        billId,
        billTitle,
        amount,
      });

      // Success! Let parent component handle the feedback
      setLoading(false);
      onPokeSuccess?.();
    } catch (error: any) {
      throw error;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'medium':
        return 20;
      case 'large':
        return 24;
      default:
        return 16;
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small':
        return FONT_SIZES.small;
      case 'medium':
        return FONT_SIZES.medium;
      case 'large':
        return FONT_SIZES.large;
      default:
        return FONT_SIZES.small;
    }
  };

  const renderButton = () => {
    if (variant === 'icon') {
      return (
        <TouchableOpacity
          style={[
            styles.iconButton,
            disabled && styles.disabled,
            size === 'large' && styles.iconButtonLarge,
          ]}
          onPress={handlePoke}
          disabled={disabled || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.warning} />
          ) : (
            <MaterialCommunityIcons
              name="gesture-tap"
              size={getIconSize()}
              color={disabled ? COLORS.gray400 : COLORS.warning}
            />
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.button,
          disabled && styles.disabled,
          size === 'medium' && styles.buttonMedium,
          size === 'large' && styles.buttonLarge,
        ]}
        onPress={handlePoke}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <>
            <MaterialCommunityIcons
              name="gesture-tap"
              size={getIconSize()}
              color={COLORS.white}
            />
            <Text style={[styles.buttonText, { fontSize: getTextSize() }]}>Poke</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      {renderButton()}

      <ConfirmationModal
        visible={modal.isVisible}
        type={modal.config.type}
        icon={modal.config.icon}
        iconColor={modal.config.iconColor}
        title={modal.config.title}
        message={modal.config.message}
        confirmText={modal.config.confirmText}
        cancelText={modal.config.cancelText}
        onConfirm={modal.handleConfirm}
        onCancel={modal.handleCancel}
        showCancel={modal.config.showCancel}
        isLoading={modal.isLoading}
      />
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
    minHeight: 32,
  },
  buttonMedium: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 40,
  },
  buttonLarge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: 48,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.warning + '20', // 20% opacity
  },
  iconButtonLarge: {
    width: 40,
    height: 40,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default PokeButton;
