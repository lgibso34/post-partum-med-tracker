import { create } from 'zustand';
import { todayInTZ } from '../lib/time';

type AppState = {
  selectedDate: string;
  setSelectedDate: (ymd: string) => void;
  goToToday: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  selectedDate: todayInTZ(),
  setSelectedDate: (ymd) => set({ selectedDate: ymd }),
  goToToday: () => set({ selectedDate: todayInTZ() }),
}));
