import { useState } from 'react';
import { useAddDose, useDeleteDose, useMedicines, useUpdateDose } from '../lib/queries';
import { hhmmToIso, isoToHHmm, isoToYmd, nowIsoUtc, todayInTZ } from '../lib/time';
import type { DoseRecord } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { AddingContext } from './HistoryColumn';

export type DoseEditorModalProps = {
  visible: boolean;
  editing: DoseRecord | null;
  addingContext: AddingContext | null;
  addDateValue: string;
  setAddDateValue: (v: string) => void;
  modalValue: string;
  setModalValue: (v: string) => void;
  modalError: string | null;
  setModalError: (v: string | null) => void;
  accent: string;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

export function useDoseEditor(): {
  openEdit: (d: DoseRecord) => void;
  openAdd: (medicineId: string, dateStr: string) => void;
  modalProps: DoseEditorModalProps;
} {
  const { userId } = useAuth();
  const medicinesQ = useMedicines();
  const [editing, setEditing] = useState<DoseRecord | null>(null);
  const [addingContext, setAddingContext] = useState<AddingContext | null>(null);
  const [addDateValue, setAddDateValue] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const operationDate = editing
    ? isoToYmd(editing.taken_at)
    : addingContext?.date ?? todayInTZ();
  const addDose = useAddDose(operationDate);
  const updateDose = useUpdateDose(operationDate);
  const deleteDose = useDeleteDose(operationDate);

  const activeMedicineId = editing?.medicine_id ?? addingContext?.medicineId ?? null;
  const accent =
    medicinesQ.data?.find((m) => m.id === activeMedicineId)?.color || '#0ea5e9';

  const openEdit = (d: DoseRecord) => {
    setAddingContext(null);
    setEditing(d);
    setModalValue(isoToHHmm(d.taken_at));
    setModalError(null);
  };

  const openAdd = (medicineId: string, dateStr: string) => {
    setEditing(null);
    setAddingContext({ medicineId, date: dateStr });
    setAddDateValue(dateStr);
    setModalValue(isoToHHmm(nowIsoUtc()));
    setModalError(null);
  };

  const closeModal = () => {
    setEditing(null);
    setAddingContext(null);
    setModalError(null);
  };

  const handleSave = () => {
    if (editing) {
      const iso = hhmmToIso(isoToYmd(editing.taken_at), modalValue);
      if (!iso) {
        setModalError('Use 24-hour HH:MM (e.g. 14:30)');
        return;
      }
      updateDose.mutate(
        { id: editing.id, taken_at: iso },
        { onSuccess: closeModal }
      );
      return;
    }
    if (addingContext && userId) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(addDateValue.trim())) {
        setModalError('Use date format YYYY-MM-DD');
        return;
      }
      const iso = hhmmToIso(addDateValue.trim(), modalValue);
      if (!iso) {
        setModalError('Use 24-hour HH:MM (e.g. 14:30)');
        return;
      }
      addDose.mutate(
        { medicineId: addingContext.medicineId, userId, takenAt: iso },
        { onSuccess: closeModal }
      );
    }
  };

  const handleDelete = () => {
    if (!editing) return;
    deleteDose.mutate(editing.id);
    closeModal();
  };

  return {
    openEdit,
    openAdd,
    modalProps: {
      visible: editing !== null || addingContext !== null,
      editing,
      addingContext,
      addDateValue,
      setAddDateValue,
      modalValue,
      setModalValue,
      modalError,
      setModalError,
      accent,
      onClose: closeModal,
      onSave: handleSave,
      onDelete: handleDelete,
    },
  };
}
