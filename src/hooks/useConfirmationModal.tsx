import { useState, useCallback } from 'react';
import { ModalType } from '../components/ConfirmationModal';

export interface ConfirmationModalConfig {
  type?: ModalType;
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  showCancel?: boolean;
}

export const useConfirmationModal = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ConfirmationModalConfig>({
    title: '',
    message: '',
  });

  const showModal = useCallback((modalConfig: ConfirmationModalConfig) => {
    setConfig(modalConfig);
    setIsVisible(true);
    setIsLoading(false);
  }, []);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    setIsLoading(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (config.onConfirm) {
      setIsLoading(true);
      try {
        await config.onConfirm();
        hideModal();
      } catch (error) {
        setIsLoading(false);
        throw error;
      }
    } else {
      hideModal();
    }
  }, [config, hideModal]);

  const handleCancel = useCallback(() => {
    if (config.onCancel) {
      config.onCancel();
    }
    hideModal();
  }, [config, hideModal]);

  return {
    isVisible,
    isLoading,
    config,
    showModal,
    hideModal,
    handleConfirm,
    handleCancel,
  };
};
