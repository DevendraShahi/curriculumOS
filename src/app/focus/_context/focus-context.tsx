"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  FocusState,
  FocusSession,
  FocusMode,
  AmbientSound,
  FocusChecklistItem,
} from "@/types/focus";

const STORAGE_KEY = "focus_state_v2";

const defaultState: FocusState = {
  currentSession: null,
  history: [],
  ambientSound: "silent",
  currentMode: "deep_build",
  isFullscreen: false,
};

function loadFromStorage(): FocusState {
  if (typeof window === "undefined") return defaultState;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...defaultState,
        ...parsed,
        currentSession: null,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return defaultState;
}

function saveToStorage(state: FocusState) {
  if (typeof window === "undefined") return;
  try {
    const toSave = {
      ...state,
      currentSession: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore storage errors
  }
}

interface FocusContextValue extends FocusState {
  startSession: (
    taskName: string,
    goalType: FocusMode,
    expectedOutcome?: string,
    durationMinutes?: number,
    checklistItems?: string[]
  ) => void;
  endSession: (completed: boolean) => void;
  updateSessionTime: (seconds: number) => void;
  toggleChecklistItem: (itemId: string) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  incrementDistraction: () => void;
  setAmbientSound: (sound: AmbientSound) => void;
  setCurrentMode: (mode: FocusMode) => void;
  setFullscreen: (fullscreen: boolean) => void;
  clearHistory: () => void;
  deleteSession: (id: string) => void;
  totalFocusMinutes: number;
  todaySessions: FocusSession[];
  weekStreak: number;
}

const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FocusState>(defaultState);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      const stored = loadFromStorage();
      setState(stored);
    }
  }, []);

  useEffect(() => {
    if (isInitializedRef.current) {
      saveToStorage(state);
    }
  }, [state]);

  const startSession = useCallback((
    taskName: string,
    goalType: FocusMode,
    expectedOutcome?: string,
    durationMinutes: number = 25,
    checklistItems: string[] = []
  ) => {
    const checklist: FocusChecklistItem[] = checklistItems
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => ({
        id: `check_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text: item,
        completed: false,
      }));

    const session: FocusSession = {
      id: `session_${Date.now()}`,
      taskName,
      goalType,
      expectedOutcome,
      checklist,
      durationMinutes,
      actualDurationSeconds: 0,
      isActive: true,
      mode: goalType,
      ambientSound: state.ambientSound,
      startedAt: new Date().toISOString(),
      completed: false,
      distractionCount: 0,
    };
    setState(prev => ({ ...prev, currentSession: session }));
  }, [state.ambientSound]);

  const endSession = useCallback((completed: boolean) => {
    setState(prev => {
      if (!prev.currentSession) return prev;

      const completedSession: FocusSession = {
        ...prev.currentSession,
        isActive: false,
        completedAt: new Date().toISOString(),
        completed,
      };

      return {
        ...prev,
        currentSession: null,
        history: [completedSession, ...prev.history].slice(0, 50),
      };
    });
  }, []);

  const updateSessionTime = useCallback((seconds: number) => {
    setState(prev => {
      if (!prev.currentSession) return prev;
      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          actualDurationSeconds: seconds,
        },
      };
    });
  }, []);

  const toggleChecklistItem = useCallback((itemId: string) => {
    setState((prev) => {
      if (!prev.currentSession) return prev;
      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          checklist: prev.currentSession.checklist.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  completed: !item.completed,
                }
              : item
          ),
        },
      };
    });
  }, []);

  const pauseSession = useCallback(() => {
    setState((prev) => {
      if (!prev.currentSession) return prev;
      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          isActive: false,
        },
      };
    });
  }, []);

  const resumeSession = useCallback(() => {
    setState((prev) => {
      if (!prev.currentSession) return prev;
      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          isActive: true,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (!state.currentSession || !state.currentSession.isActive) return;
    const totalSeconds = state.currentSession.durationMinutes * 60;
    if (state.currentSession.actualDurationSeconds >= totalSeconds) return;

    const timer = window.setInterval(() => {
      setState((prev) => {
        if (!prev.currentSession || !prev.currentSession.isActive) return prev;
        const session = prev.currentSession;
        const sessionTotalSeconds = session.durationMinutes * 60;
        const nextSeconds = session.actualDurationSeconds + 1;

        if (nextSeconds >= sessionTotalSeconds) {
          const completedSession: FocusSession = {
            ...session,
            actualDurationSeconds: sessionTotalSeconds,
            isActive: false,
            completedAt: new Date().toISOString(),
            completed: true,
          };
          return {
            ...prev,
            currentSession: null,
            history: [completedSession, ...prev.history].slice(0, 50),
          };
        }

        return {
          ...prev,
          currentSession: {
            ...session,
            actualDurationSeconds: nextSeconds,
          },
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state.currentSession]);

  const incrementDistraction = useCallback(() => {
    setState(prev => {
      if (!prev.currentSession) return prev;
      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          distractionCount: prev.currentSession.distractionCount + 1,
        },
      };
    });
  }, []);

  const setAmbientSound = useCallback((sound: AmbientSound) => {
    setState(prev => ({ ...prev, ambientSound: sound }));
  }, []);

  const setCurrentMode = useCallback((mode: FocusMode) => {
    setState(prev => ({ ...prev, currentMode: mode }));
  }, []);

  const setFullscreen = useCallback((fullscreen: boolean) => {
    setState(prev => ({ ...prev, isFullscreen: fullscreen }));
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({ ...prev, history: [] }));
  }, []);

  const deleteSession = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      history: prev.history.filter(s => s.id !== id),
    }));
  }, []);

  const totalFocusMinutes = state.history.reduce((acc, session) => {
    return acc + (session.completed ? session.durationMinutes : Math.floor(session.actualDurationSeconds / 60));
  }, 0);

  const todaySessions = state.history.filter(session => {
    const sessionDate = new Date(session.startedAt);
    const today = new Date();
    return sessionDate.toDateString() === today.toDateString();
  });

  const weekStreak = (() => {
    const today = new Date();
    let streak = 0;

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const hasSession = state.history.some(session => {
        const sessionDate = new Date(session.startedAt);
        return sessionDate.toDateString() === checkDate.toDateString();
      });

      if (hasSession) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  })();

  const value: FocusContextValue = {
    ...state,
    startSession,
    endSession,
    updateSessionTime,
    toggleChecklistItem,
    pauseSession,
    resumeSession,
    incrementDistraction,
    setAmbientSound,
    setCurrentMode,
    setFullscreen,
    clearHistory,
    deleteSession,
    totalFocusMinutes,
    todaySessions,
    weekStreak,
  };

  return (
    <FocusContext.Provider value={value}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error("useFocus must be used within a FocusProvider");
  }
  return context;
}
