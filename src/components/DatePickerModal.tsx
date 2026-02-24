import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { isTablet } from '../utils/deviceUtils';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  selectedDate?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedDate,
  minimumDate,
  maximumDate,
  title = 'Select Date',
}) => {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedDay, setSelectedDay] = useState(currentDate.getDate());

  const monthScrollRef = useRef<ScrollView>(null);
  const dayScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);
  const ITEM_HEIGHT = 46;

  const tablet = isTablet();

  useEffect(() => {
    if (selectedDate) {
      setCurrentDate(selectedDate);
      setSelectedYear(selectedDate.getFullYear());
      setSelectedMonth(selectedDate.getMonth());
      setSelectedDay(selectedDate.getDate());
    }
  }, [selectedDate, visible]);

  // Auto-scroll to selected date (or today if none) when modal opens
  useEffect(() => {
    if (visible) {
      const target = selectedDate || new Date();
      const targetMonth = target.getMonth();
      const targetDay = target.getDate();
      const targetYear = target.getFullYear();

      // Center the selected item in the 250px scroll view
      const SCROLL_VIEW_HEIGHT = 250;
      const centerOffset = (SCROLL_VIEW_HEIGHT - ITEM_HEIGHT) / 2;

      const timer = setTimeout(() => {
        monthScrollRef.current?.scrollTo({ y: Math.max(0, targetMonth * ITEM_HEIGHT - centerOffset), animated: false });
        dayScrollRef.current?.scrollTo({ y: Math.max(0, (targetDay - 1) * ITEM_HEIGHT - centerOffset), animated: false });
        const years = getYearRange();
        const yearIndex = years.findIndex(y => y === targetYear);
        if (yearIndex >= 0) {
          yearScrollRef.current?.scrollTo({ y: Math.max(0, yearIndex * ITEM_HEIGHT - centerOffset), animated: false });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getYearRange = () => {
    const currentYear = new Date().getFullYear();
    const minYear = minimumDate ? minimumDate.getFullYear() : currentYear - 10;
    const maxYear = maximumDate ? maximumDate.getFullYear() : currentYear + 10;
    const years = [];
    for (let year = maxYear; year >= minYear; year--) {
      years.push(year);
    }
    return years;
  };

  const handleConfirm = () => {
    const newDate = new Date(selectedYear, selectedMonth, selectedDay);

    // Validate against min/max dates
    if (minimumDate && newDate < minimumDate) {
      return;
    }
    if (maximumDate && newDate > maximumDate) {
      return;
    }

    onSelect(newDate);
    onClose();
  };

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, tablet && styles.modalContainerTablet]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.gray600} />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerContainer}>
            {/* Month Picker */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Month</Text>
              <ScrollView
                ref={monthScrollRef}
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {months.map((month, index) => (
                  <TouchableOpacity
                    key={month}
                    style={[
                      styles.pickerItem,
                      selectedMonth === index && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedMonth(index);
                      // Adjust day if it exceeds days in new month
                      const daysInNewMonth = getDaysInMonth(selectedYear, index);
                      if (selectedDay > daysInNewMonth) {
                        setSelectedDay(daysInNewMonth);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedMonth === index && styles.pickerItemTextSelected,
                      ]}
                    >
                      {month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Day Picker */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Day</Text>
              <ScrollView
                ref={dayScrollRef}
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {days.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.pickerItem,
                      selectedDay === day && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedDay(day)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedDay === day && styles.pickerItemTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Year Picker */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Year</Text>
              <ScrollView
                ref={yearScrollRef}
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {getYearRange().map((year) => (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.pickerItem,
                      selectedYear === year && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedYear(year)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedYear === year && styles.pickerItemTextSelected,
                      ]}
                    >
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalContainerTablet: {
    maxWidth: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  pickerContainer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  column: {
    flex: 1,
  },
  columnLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gray600,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 250,
  },
  scrollContent: {
    paddingVertical: SPACING.xs,
  },
  pickerItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
    alignItems: 'center',
  },
  pickerItemSelected: {
    backgroundColor: COLORS.primary,
  },
  pickerItemText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray700,
    fontWeight: '500',
  },
  pickerItemTextSelected: {
    color: COLORS.white,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.gray200,
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default DatePickerModal;
