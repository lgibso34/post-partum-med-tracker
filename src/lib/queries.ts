import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { supabase, type DoseRecord, type MedicineRecord } from './supabase';
import { dayBoundsUtc, nowIsoUtc, takenAtForDate } from './time';

export const medicineKey = ['medicines'] as const;
export const dosesKey = (date: string) => ['doses', date] as const;

const DEV_MOCK = false// __DEV__ && process.env.EXPO_PUBLIC_SKIP_LOGIN === '1';

const mockMedicines: MedicineRecord[] = [
  { id: 'm1', name: 'Tylenol', color: '#ef4444', notes: null, archived: false, sort_order: 0, created_at: '', updated_at: '' },
  { id: 'm2', name: 'Ibuprofen', color: '#f97316', notes: null, archived: false, sort_order: 1, created_at: '', updated_at: '' },
  { id: 'm3', name: 'Iron', color: '#10b981', notes: null, archived: false, sort_order: 2, created_at: '', updated_at: '' },
  { id: 'm4', name: 'Prenatal', color: '#a855f7', notes: null, archived: false, sort_order: 3, created_at: '', updated_at: '' },
];

function mockDosesForToday(): DoseRecord[] {
  const mk = (id: string, medicine_id: string, hour: number, minute: number): DoseRecord => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return {
      id,
      medicine_id,
      taken_at: d.toISOString(),
      logged_by: 'dev-user',
      note: null,
      created_at: d.toISOString(),
    };
  };
  return [
    mk('d1', 'm1', 8, 14),
    mk('d2', 'm1', 12, 45),
    mk('d3', 'm2', 9, 2),
    mk('d4', 'm2', 14, 10),
    mk('d5', 'm3', 7, 30),
    mk('d6', 'm4', 7, 35),
  ];
}

export function useMedicines() {
  return useQuery({
    queryKey: medicineKey,
    queryFn: async () => {
      if (DEV_MOCK) return mockMedicines;
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
      if (DEV_MOCK) {
        return mockDosesForToday().filter((d) => d.medicine_id === medicineId);
      }
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

export function useDosesForDate(date: string) {
  return useQuery({
    queryKey: dosesKey(date),
    queryFn: async () => {
      if (DEV_MOCK) {
        const list = mockDosesForToday();
        const byMedicine: Record<string, DoseRecord[]> = {};
        for (const d of list) (byMedicine[d.medicine_id] ??= []).push(d);
        return { list, byMedicine };
      }
      const { startIso, endIso } = dayBoundsUtc(date);
      const { data, error } = await supabase
        .from('doses')
        .select('*')
        .gte('taken_at', startIso)
        .lt('taken_at', endIso)
        .order('taken_at', { ascending: true });
      if (error) throw error;
      const list = (data ?? []) as DoseRecord[];
      const byMedicine: Record<string, DoseRecord[]> = {};
      for (const d of list) {
        (byMedicine[d.medicine_id] ??= []).push(d);
      }
      return { list, byMedicine };
    },
  });
}

export function useAddMedicine(): UseMutationResult<
  MedicineRecord,
  Error,
  { name: string; color?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from('medicines')
        .insert({
          name: input.name,
          color: input.color ?? null,
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
