import React, { useState, useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import { BillContext } from '../../context/BillContext';
import { BillItem, BillCategory, SUPPORTED_CURRENCIES } from '../../types';
import { computeSplitsFromItems } from '../../utils/calculations';
import { formatAmount } from '../../utils/formatting';
import { getBillCategoryIcon } from '../../utils/icons';
import ReceiptItemsModal from '../../components/ReceiptItemsModal';
import DatePickerModal from '../../components/DatePickerModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../services/supabase';

type AIBillReviewScreenProps = {
  navigation: any;
  route: any;
};

const CATEGORIES: BillCategory[] = ['food', 'transport', 'utilities', 'entertainment', 'shopping', 'other'];

const AIBillReviewScreen: React.FC<AIBillReviewScreenProps> = ({ navigation, route }) => {
  const { billData, participants, imageUrl, groupId } = route.params as {
    billData: {
      suggestedTitle: string;
      suggestedCategory: BillCategory;
      totalAmount: number;
      items: BillItem[];
    };
    participants: { id: string; name: string }[];
    imageUrl: string;
    groupId?: string;
  };

  const authContext = useContext(AuthContext);
  const billContext = useContext(BillContext);

  if (!authContext || !billContext) return null;

  const { user } = authContext;
  const { createBill } = billContext;
  const currencySymbol = SUPPORTED_CURRENCIES.find(c => c.code === (user?.preferredCurrency || 'PHP'))?.symbol ?? '₱';

  const [title, setTitle] = useState(billData.suggestedTitle || '');
  const [category, setCategory] = useState<BillCategory>(billData.suggestedCategory || 'other');
  const [billDate, setBillDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [items, setItems] = useState<BillItem[]>(billData.items || []);
  const [adjustingItemIndex, setAdjustingItemIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const modal = useConfirmationModal();

  const allParticipantIds = participants.map(p => p.id);

  const splits = useMemo(() => computeSplitsFromItems(items, allParticipantIds), [items, allParticipantIds]);

  const totalAmount = useMemo(
    () => parseFloat(items.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)),
    [items]
  );

  const getAssignedLabel = (item: BillItem): string => {
    if (item.assignedTo.length === 0) return 'Unassigned';
    if (item.assignedTo.length === participants.length) return 'Everyone';
    return item.assignedTo
      .map(id => participants.find(p => p.id === id)?.name || 'Unknown')
      .join(', ');
  };

  const handleConfirmItem = (updatedItem: BillItem) => {
    if (adjustingItemIndex === null) return;
    const newItems = [...items];
    newItems[adjustingItemIndex] = updatedItem;
    setItems(newItems);
    setAdjustingItemIndex(null);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please enter a bill title.' });
      return;
    }

    try {
      setLoading(true);

      let attachmentUrl: string | undefined;
      if (imageUrl && user) {
        const ext = imageUrl.split('.').pop()?.toLowerCase() ?? 'jpg';
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const storagePath = `${user.id}/ai_${Date.now()}.${ext}`;
        const base64 = await FileSystem.readAsStringAsync(imageUrl, { encoding: 'base64' });
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const { error: uploadError } = await supabase.storage
          .from('bill-attachments')
          .upload(storagePath, bytes, { contentType, upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('bill-attachments').getPublicUrl(storagePath);
          attachmentUrl = urlData.publicUrl;
        }
      }

      const billPayload: any = {
        title: title.trim(),
        totalAmount,
        paidBy: user!.id,
        participants: allParticipantIds,
        splitMethod: 'item-based' as any,
        splits,
        category,
        billDate: billDate.getTime(),
        attachmentUrl,
        receiptItems: items,
        ...(groupId && { groupId }),
      };

      await createBill(billPayload);
      modal.showModal({
        type: 'success',
        title: 'Success',
        message: 'Bill created successfully!',
        onConfirm: () => navigation.popToTop(),
      });
    } catch (err: any) {
      modal.showModal({ type: 'error', title: 'Error', message: err?.message || 'Failed to create bill. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review AI Bill</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Bill details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          <TextInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            outlineColor={COLORS.gray300}
            activeOutlineColor={COLORS.primary}
            textColor={COLORS.black}
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryOption, category === cat && styles.categoryActive]}
                onPress={() => setCategory(cat)}
              >
                <MaterialCommunityIcons
                  name={getBillCategoryIcon(cat) as any}
                  size={20}
                  color={category === cat ? COLORS.white : COLORS.gray600}
                />
                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.dateField} onPress={() => setShowDatePicker(true)}>
            <MaterialCommunityIcons name="calendar" size={18} color={COLORS.primary} />
            <Text style={styles.dateText}>
              {billDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Receipt items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receipt Items</Text>
          <Text style={styles.tapHint}>Tap any row to adjust assignment</Text>
          {items.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.itemRow}
              onPress={() => setAdjustingItemIndex(index)}
            >
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>
                  {item.name} × {item.quantity}
                </Text>
                <Text style={styles.itemAssigned}>{getAssignedLabel(item)}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemPrice}>{currencySymbol}{item.totalPrice.toFixed(2)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.gray400} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Split summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Split Summary</Text>
          {splits.map((split, index) => {
            const participant = participants.find(p => p.id === split.userId);
            const name = participant
              ? (participant.id === user?.id ? 'You (Payer)' : participant.name)
              : 'Unknown';
            return (
              <View key={index} style={styles.splitRow}>
                <Text style={styles.splitName}>{name}</Text>
                <Text style={styles.splitAmount}>{formatAmount(split.amount, user?.preferredCurrency)}</Text>
              </View>
            );
          })}
          <View style={styles.splitDivider} />
          <View style={styles.splitRow}>
            <Text style={styles.splitTotalLabel}>Total</Text>
            <Text style={styles.splitTotalAmount}>{formatAmount(totalAmount, user?.preferredCurrency)}</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="check" size={20} color={COLORS.white} />
                <Text style={styles.createButtonText}>Confirm & Create</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Item adjustment modal (single item) */}
      {adjustingItemIndex !== null && (
        <ReceiptItemsModal
          visible={true}
          items={[items[adjustingItemIndex]]}
          participants={participants}
          currencySymbol={currencySymbol}
          onConfirm={confirmed => handleConfirmItem(confirmed[0])}
          onCancel={() => setAdjustingItemIndex(null)}
        />
      )}

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(date: Date) => { setBillDate(date); setShowDatePicker(false); }}
        selectedDate={billDate}
        title="Select Bill Date"
      />

      <ConfirmationModal
        visible={modal.isVisible}
        type={modal.config?.type}
        title={modal.config?.title}
        message={modal.config?.message}
        onConfirm={modal.handleConfirm}
        onCancel={modal.handleCancel}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray600,
    marginBottom: SPACING.sm,
  },
  categoryScroll: {
    marginBottom: SPACING.md,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  categoryActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
  },
  categoryTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  dateText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  tapHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.black,
  },
  itemAssigned: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
    marginTop: 2,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemPrice: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.black,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  splitName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray700,
  },
  splitAmount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.black,
  },
  splitDivider: {
    height: 1,
    backgroundColor: COLORS.gray200,
    marginVertical: SPACING.sm,
  },
  splitTotalLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.black,
  },
  splitTotalAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.primary,
  },
  buttonContainer: {
    margin: SPACING.lg,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  createButtonDisabled: {
    backgroundColor: COLORS.gray300,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
});

export default AIBillReviewScreen;
