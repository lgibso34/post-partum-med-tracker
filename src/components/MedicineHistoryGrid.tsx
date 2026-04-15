import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useMedicines } from '../lib/queries';
import {
  GRID_GAP,
  GRID_H_PAD,
  HistoryColumn,
  columnCountFor,
} from './HistoryColumn';
import { AddMedicineCard } from './AddMedicineCard';
import { DoseEditorModal } from './DoseEditorModal';
import { useDoseEditor } from './useDoseEditor';

export function MedicineHistoryGrid() {
  const { width } = useWindowDimensions();
  const medicinesQ = useMedicines();
  const { openEdit, openAdd, modalProps } = useDoseEditor();

  const cols = columnCountFor(width);
  const available = width - GRID_H_PAD * 2;
  const columnWidth = Math.floor((available - GRID_GAP * (cols - 1)) / cols);

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        {medicinesQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.mutedText}>Loading medicines…</Text>
          </View>
        ) : medicinesQ.isError ? (
          <View style={styles.center}>
            <Text style={styles.error}>Failed to load medicines</Text>
            <Text style={styles.errorHint}>
              {(medicinesQ.error as Error).message}
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, { gap: GRID_GAP }]}>
            {medicinesQ.data?.map((m) => (
              <HistoryColumn
                key={m.id}
                medicine={m}
                width={columnWidth}
                onEdit={openEdit}
                onAdd={openAdd}
              />
            ))}
            <AddMedicineCard width={columnWidth} />
          </View>
        )}
      </ScrollView>
      <DoseEditorModal {...modalProps} />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: GRID_H_PAD,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  mutedText: { fontSize: 13, color: '#78716c' },
  error: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  errorHint: { fontSize: 12, color: '#78716c' },
});
