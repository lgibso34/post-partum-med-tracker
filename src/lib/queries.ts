import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { supabase, type DoseRecord, type MedicineRecord } from './supabase';
import { nowIsoUtc, takenAtForDate } from './time';

export const medicineKey = ['medicines'] as const;
const dosesKey = (date: string) => ['doses', date] as const;

export function useMedicines() {
  return useQuery({
    queryKey: medicineKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .eq('archived', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as MedicineRecord[];
    },
  });
}

export function useAllDosesForMedicine(medicineId: string | null) {
  return useQuery({
    queryKey: ['doses', 'medicine', medicineId],
    enabled: !!medicineId,
    queryFn: async () => {
      if (!medicineId) return [] as DoseRecord[];
      const { data, error } = await supabase
        .from('doses')
        .select('*')
        .eq('medicine_id', medicineId)
        .order('taken_at', { ascending: false });
      if (error) throw error;
      return data as DoseRecord[];
    },
  });
}

export function useAddMedicine(): UseMutationResult<
  MedicineRecord,
  Error,
  { name: string; color?: string; dose_interval_hours?: number | null }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from('medicines')
        .insert({
          name: input.name,
          color: input.color ?? null,
          dose_interval_hours: input.dose_interval_hours ?? null,
          archived: false,
          sort_order: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as MedicineRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: medicineKey }),
  });
}

export function useArchiveMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('medicines')
        .update({ archived: true })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as MedicineRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: medicineKey }),
  });
}

export function useRenameMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('medicines')
        .update({ name: input.name })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as MedicineRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: medicineKey }),
  });
}

export function useUpdateMedicineNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; notes: string }) => {
      const { data, error } = await supabase
        .from('medicines')
        .update({ notes: input.notes })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as MedicineRecord;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: medicineKey });
      const prev = qc.getQueryData<MedicineRecord[]>(medicineKey);
      qc.setQueryData<MedicineRecord[]>(medicineKey, (old) =>
        old?.map((m) => (m.id === input.id ? { ...m, notes: input.notes } : m))
      );
      return { prev };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(medicineKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: medicineKey }),
  });
}

export function useUpdateMedicineInterval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; dose_interval_hours: number | null }) => {
      const { data, error } = await supabase
        .from('medicines')
        .update({ dose_interval_hours: input.dose_interval_hours })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as MedicineRecord;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: medicineKey });
      const prev = qc.getQueryData<MedicineRecord[]>(medicineKey);
      qc.setQueryData<MedicineRecord[]>(medicineKey, (old) =>
        old?.map((m) =>
          m.id === input.id ? { ...m, dose_interval_hours: input.dose_interval_hours } : m
        )
      );
      return { prev };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(medicineKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: medicineKey }),
  });
}

export function useAddDose(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { medicineId: string; userId: string; takenAt?: string }) => {
      const { data, error } = await supabase
        .from('doses')
        .insert({
          medicine_id: input.medicineId,
          taken_at: input.takenAt ?? takenAtForDate(date),
          logged_by: input.userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DoseRecord;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: dosesKey(date) });
      const prev = qc.getQueryData(dosesKey(date));
      const optimistic: DoseRecord = {
        id: `optim-${Math.random().toString(36).slice(2)}`,
        medicine_id: input.medicineId,
        taken_at: input.takenAt ?? takenAtForDate(date),
        logged_by: input.userId,
        note: null,
        created_at: nowIsoUtc(),
      };
      qc.setQueryData(
        dosesKey(date),
        (old: { list: DoseRecord[]; byMedicine: Record<string, DoseRecord[]> } | undefined) => {
          const next = {
            list: [...(old?.list ?? []), optimistic],
            byMedicine: { ...(old?.byMedicine ?? {}) },
          };
          next.byMedicine[input.medicineId] = [
            ...(next.byMedicine[input.medicineId] ?? []),
            optimistic,
          ];
          return next;
        }
      );
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(dosesKey(date), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['doses'] }),
  });
}

export function useUpdateDose(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; taken_at: string }) => {
      const { data, error } = await supabase
        .from('doses')
        .update({ taken_at: input.taken_at })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as DoseRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doses'] }),
  });
}

export function useDeleteDose(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('doses').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: dosesKey(date) });
      const prev = qc.getQueryData(dosesKey(date));
      qc.setQueryData(
        dosesKey(date),
        (old: { list: DoseRecord[]; byMedicine: Record<string, DoseRecord[]> } | undefined) => {
          if (!old) return old;
          const list = old.list.filter((d) => d.id !== id);
          const byMedicine: Record<string, DoseRecord[]> = {};
          for (const key of Object.keys(old.byMedicine)) {
            byMedicine[key] = old.byMedicine[key].filter((d) => d.id !== id);
          }
          return { list, byMedicine };
        }
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(dosesKey(date), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['doses'] }),
  });
}
