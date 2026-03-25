import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { BillItem } from '../types';

type Participant = {
  id: string;
  name: string;
};

type Props = {
  visible: boolean;
  items: BillItem[];
  participants: Participant[];
  currencySymbol: string;
  onConfirm: (items: BillItem[]) => void;
  onCancel: () => void;
};

const SPLIT_METHODS = ['specific', 'equal', 'percentage'] as const;

const ReceiptItemsModal: React.FC<Props> = ({
  visible,
  items,
  participants,
  currencySymbol,
  onConfirm,
  onCancel,
}) => {
  const [localItems, setLocalItems] = useState<BillItem[]>([]);

  useEffect(() => {
    if (visible) {
      // Reset with incoming items, default all to 'equal' with all participants
      setLocalItems(items.map(item => ({
        ...item,
        splitMethod: item.splitMethod || 'equal',
        assignedTo: item.assignedTo.length > 0 ? item.assignedTo : participants.map(p => p.id),
        percentages: item.percentages || {},
      })));
    }
  }, [visible, items, participants]);

  const updateItem = (index: number, patch: Partial<BillItem>) => {
    setLocalItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const toggleParticipant = (itemIndex: number, participantId: string) => {
    const item = localItems[itemIndex];
    const isSelected = item.assignedTo.includes(participantId);
    const newAssigned = isSelected
      ? item.assignedTo.filter(id => id !== participantId)
      : [...item.assignedTo, participantId];
    updateItem(itemIndex, { assignedTo: newAssigned });
  };

  const runningTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    participants.forEach(p => { totals[p.id] = 0; });

    localItems.forEach(item => {
      if (!item.assignedTo || item.assignedTo.length === 0) return;
      if (item.splitMethod === 'specific' && item.assignedTo[0]) {
        totals[item.assignedTo[0]] = (totals[item.assignedTo[0]] || 0) + item.totalPrice;
      } else if (item.splitMethod === 'equal') {
        const share = item.totalPrice / item.assignedTo.length;
        item.assignedTo.forEach(uid => {
          totals[uid] = (totals[uid] || 0) + share;
        });
      } else if (item.splitMethod === 'percentage' && item.percentages) {
        item.assignedTo.forEach(uid => {
          const pct = item.percentages![uid] || 0;
          totals[uid] = (totals[uid] || 0) + item.totalPrice * (pct / 100);
        });
      }
    });

    return totals;
  }, [localItems, participants]);

  const canConfirm = localItems.every(item => item.assignedTo.length > 0);

  const renderItem = ({ item, index }: { item: BillItem; index: number }) => {
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>
              × {item.quantity}  {currencySymbol}{item.totalPrice.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Split method tabs */}
        <View style={styles.methodTabs}>
          {SPLIT_METHODS.map(method => (
            <TouchableOpacity
              key={method}
              style={[styles.methodTab, item.splitMethod === method && styles.methodTabActive]}
              onPress={() => updateItem(index, {
                splitMethod: method,
                assignedTo: method === 'specific' ? (item.assignedTo.slice(0, 1) || []) : item.assignedTo,
              })}
            >
              <Text style={[styles.methodTabText, item.splitMethod === method && styles.methodTabTextActive]}>
                {method === 'specific' ? 'One Person' : method === 'equal' ? 'Equal' : 'Percent'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Participant selection */}
        {item.splitMethod === 'specific' ? (
          <View style={styles.participantList}>
            {participants.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.participantRow, item.assignedTo[0] === p.id && styles.participantRowSelected]}
                onPress={() => updateItem(index, { assignedTo: [p.id] })}
              >
                <MaterialCommunityIcons
                  name={item.assignedTo[0] === p.id ? 'radiobox-marked' : 'radiobox-blank'}
                  size={18}
                  color={item.assignedTo[0] === p.id ? COLORS.primary : COLORS.gray400}
                />
                <Text style={styles.participantName}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : item.splitMethod === 'equal' ? (
          <View style={styles.participantList}>
            {participants.map(p => {
              const isSelected = item.assignedTo.includes(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.participantRow, isSelected && styles.participantRowSelected]}
                  onPress={() => toggleParticipant(index, p.id)}
                >
                  <MaterialCommunityIcons
                    name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={18}
                    color={isSelected ? COLORS.primary : COLORS.gray400}
                  />
                  <Text style={styles.participantName}>{p.name}</Text>
                  {isSelected && item.assignedTo.length > 0 && (
                    <Text style={styles.shareAmount}>
                      {currencySymbol}{(item.totalPrice / item.assignedTo.length).toFixed(2)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          // Percentage
          <View style={styles.participantList}>
            {participants.map(p => {
              const isSelected = item.assignedTo.includes(p.id);
              const pct = (item.percentages?.[p.id] || 0).toString();
              return (
                <View key={p.id} style={styles.percentRow}>
                  <TouchableOpacity
                    style={styles.percentCheckbox}
                    onPress={() => toggleParticipant(index, p.id)}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={18}
                      color={isSelected ? COLORS.primary : COLORS.gray400}
                    />
                    <Text style={styles.participantName}>{p.name}</Text>
                  </TouchableOpacity>
                  {isSelected && (
                    <TextInput
                      value={pct}
                      onChangeText={val => {
                        const newPcts = { ...(item.percentages || {}), [p.id]: parseFloat(val) || 0 };
                        updateItem(index, { percentages: newPcts });
                      }}
                      keyboardType="decimal-pad"
                      mode="outlined"
                      style={styles.pctInput}
                      outlineColor={COLORS.gray300}
                      activeOutlineColor={COLORS.primary}
                      textColor={COLORS.black}
                      right={<TextInput.Affix text="%" />}
                      dense
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receipt Items</Text>
          <TouchableOpacity onPress={() => canConfirm && onConfirm(localItems)} disabled={!canConfirm}>
            <Text style={[styles.doneText, !canConfirm && styles.doneTextDisabled]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Items list */}
        <FlatList
          data={localItems}
          keyExtractor={(_, i) => i.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />

        {/* Sticky footer — running totals */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Running Totals</Text>
          <View style={styles.totalsGrid}>
            {participants.map(p => (
              <View key={p.id} style={styles.totalRow}>
                <Text style={styles.totalName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.totalAmount}>
                  {currencySymbol}{(runningTotals[p.id] || 0).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            onPress={() => canConfirm && onConfirm(localItems)}
            disabled={!canConfirm}
          >
            <Text style={styles.confirmButtonText}>Confirm Items</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50 || '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.black,
  },
  cancelText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray500,
  },
  doneText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '700',
  },
  doneTextDisabled: {
    color: COLORS.gray300,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.black,
  },
  itemMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray500,
    marginTop: 2,
  },
  methodTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray100,
    borderRadius: BORDER_RADIUS.sm,
    padding: 2,
    marginBottom: SPACING.sm,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm - 2,
  },
  methodTabActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  methodTabText: {
    fontSize: FONT_SIZES.xs || 11,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  methodTabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  participantList: {
    gap: 4,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    gap: 8,
  },
  participantRowSelected: {
    backgroundColor: '#EEF2FF',
  },
  participantName: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.black,
  },
  shareAmount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  percentCheckbox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  pctInput: {
    width: 90,
    height: 36,
    backgroundColor: COLORS.white,
    fontSize: FONT_SIZES.sm,
  },
  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    padding: SPACING.md,
  },
  footerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray600,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalsGrid: {
    marginBottom: SPACING.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray700 || COLORS.black,
    flex: 1,
  },
  totalAmount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.black,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.gray300,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
});

export default ReceiptItemsModal;
