// frontend/src/hooks/index.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

// Custom hook for Socket.IO connection
export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const { token, user } = useAuth();
  
  // Use ref to prevent infinite loops
  const socketRef = useRef<Socket | null>(null);
  const isInitializing = useRef(false);

  useEffect(() => {
    if (!token || !user) {
      // Clean up existing socket if no auth
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Prevent multiple socket creation
    if (isInitializing.current || (socketRef.current && socketRef.current.connected)) {
      return;
    }

    isInitializing.current = true;

    // Create socket connection
    const socketURL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling'], // Ensure stable connection
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;

    // Authentication
    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('authenticate', { token });
    });

    newSocket.on('authenticated', (data) => {
      console.log('Socket authenticated:', data);
      setConnected(true);
      isInitializing.current = false;
    });

    newSocket.on('authError', (error) => {
      console.error('Socket auth error:', error);
      setConnected(false);
      isInitializing.current = false;
    });

    // Real-time note updates - MOVED to individual components
    // This prevents the hook from depending on NotesContext

    newSocket.on('userJoined', (data) => {
      console.log('User joined note:', data);
    });

    newSocket.on('userLeft', (data) => {
      console.log('User left note:', data);
    });

    newSocket.on('userTyping', (data) => {
      console.log('User typing:', data);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
      isInitializing.current = false;
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
      isInitializing.current = false;
    });

    setSocket(newSocket);

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setSocket(null);
      setConnected(false);
      isInitializing.current = false;
    };
  }, [token, user?._id]); // ✅ REMOVED optimisticUpdate dependency

  return { socket, connected };
};

// Custom hook for debounced values (useful for search, auto-save)
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Custom hook for auto-save functionality
export const useAutoSave = (
  data: any,
  saveFunction: (data: any) => Promise<void>,
  delay: number = 2000
) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debouncedData = useDebounce(data, delay);
  const initialData = useRef(data);

  useEffect(() => {
    const save = async () => {
      // Don't save if data hasn't changed from initial
      if (JSON.stringify(debouncedData) === JSON.stringify(initialData.current)) {
        return;
      }

      try {
        setIsSaving(true);
        await saveFunction(debouncedData);
        setLastSaved(new Date());
        initialData.current = debouncedData;
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    };

    save();
  }, [debouncedData, saveFunction]);

  return { isSaving, lastSaved };
};

// Custom hook for local storage
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
};

// Custom hook for window size (responsive design)
export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

// Custom hook for previous value
export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};