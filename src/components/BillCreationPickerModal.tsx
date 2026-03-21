import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

type Props = {
  visible: boolean;
  onSelectManual: () => void;
  onSelectScanReceipt: () => void;
  onSelectAskAI: () => void;
  onClose: () => void;
};

const BillCreationPickerModal: React.FC<Props> = ({
  visible,
  onSelectManual,
  onSelectScanReceipt,
  onSelectAskAI,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>How do you want to create this bill?</Text>

          <TouchableOpacity style={styles.option} onPress={onSelectManual}>
            <View style={[styles.iconWrap, { backgroundColor: '#EEF2FF' }]}>
              <MaterialCommunityIcons name="pencil" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Manual Entry</Text>
              <Text style={styles.optionSubtitle}>Fill in the details yourself</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={onSelectScanReceipt}>
            <View style={[styles.iconWrap, { backgroundColor: '#FFF7ED' }]}>
              <MaterialCommunityIcons name="receipt" size={24} color="#F97316" />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Scan Receipt</Text>
              <Text style={styles.optionSubtitle}>Upload a photo, assign items</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={onSelectAskAI}>
            <View style={[styles.iconWrap, { backgroundColor: '#F0FDF4' }]}>
              <MaterialCommunityIcons name="robot" size={24} color="#16A34A" />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Ask AI</Text>
              <Text style={styles.optionSubtitle}>Upload receipt + describe how to split</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.gray300,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: SPACING.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray500,
  },
  cancelButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  cancelText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray500,
    fontWeight: '600',
  },
});

export default BillCreationPickerModal;
