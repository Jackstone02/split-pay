import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

export type ModalType = 'info' | 'success' | 'error' | 'warning' | 'confirm';

export interface ConfirmationModalProps {
  visible: boolean;
  type?: ModalType;
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  isLoading?: boolean;
  loadingText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  type = 'info',
  icon,
  iconColor,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  showCancel = false,
  isLoading = false,
  loadingText = 'Processing...',
}) => {
  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: icon || 'check-circle',
          color: iconColor || COLORS.success,
          confirmColor: COLORS.success,
        };
      case 'error':
        return {
          icon: icon || 'alert-circle',
          color: iconColor || COLORS.danger,
          confirmColor: COLORS.danger,
        };
      case 'warning':
        return {
          icon: icon || 'alert',
          color: iconColor || COLORS.warning,
          confirmColor: COLORS.warning,
        };
      case 'confirm':
        return {
          icon: icon || 'help-circle',
          color: iconColor || COLORS.primary,
          confirmColor: COLORS.primary,
        };
      default:
        return {
          icon: icon || 'information',
          color: iconColor || COLORS.primary,
          confirmColor: COLORS.primary,
        };
    }
  };

  const config = getTypeConfig();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !isLoading && handleCancel()}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <MaterialCommunityIcons name={config.icon as any} size={48} color={config.color} />
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>

          <View style={styles.modalButtonContainer}>
            {showCancel && (
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancel}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: config.confirmColor },
                isLoading && styles.confirmButtonDisabled,
                !showCancel && styles.fullWidthButton,
              ]}
              onPress={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }} />
                  <Text style={styles.confirmButtonText}>{loadingText}</Text>
                </>
              ) : (
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidthButton: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: COLORS.gray200,
  },
  cancelButtonText: {
    color: COLORS.black,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
});

export default ConfirmationModal;
