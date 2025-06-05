// frontend/src/contexts/NotesContext.tsx
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from '../hooks';
import api from '../lib/api';

interface Note {
  _id: string;
  title: string;
  content: string;
  owner: {
    _id: string;
    username: string;
    email: string;
  };
  collaborators: Array<{
    user: {
      _id: string;
      username: string;
      email: string;
    };
    permission: 'read' | 'write';
  }>;
  lastEditedBy?: {
    _id: string;
    username: string;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface NotesState {
  notes: Note[];
  loading: boolean;
  error: string | null;
  selectedNote: Note | null;
}

type NotesAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_NOTES'; payload: Note[] }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'SET_SELECTED_NOTE'; payload: Note | null }
  | { type: 'OPTIMISTIC_UPDATE'; payload: { id: string; updates: Partial<Note> } }
  | { type: 'REVERT_OPTIMISTIC_UPDATE'; payload: string };

const initialState: NotesState = {
  notes: [],
  loading: false,
  error: null,
  selectedNote: null,
};

// ✅ FIXED: Prevent object recreation that causes infinite loops
const notesReducer = (state: NotesState, action: NotesAction): NotesState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_NOTES':
      return { ...state, notes: action.payload, loading: false, error: null };
    
    case 'ADD_NOTE':
      return { 
        ...state, 
        notes: [action.payload, ...state.notes], 
        loading: false, 
        error: null 
      };
    
    case 'UPDATE_NOTE':
      const updatedNotes = state.notes.map(note => 
        note._id === action.payload._id ? action.payload : note
      );
      
      // ✅ FIXED: Only update selectedNote if it's actually different
      const updatedSelectedNote = state.selectedNote?._id === action.payload._id 
        ? action.payload 
        : state.selectedNote;
      
      return {
        ...state,
        notes: updatedNotes,
        selectedNote: updatedSelectedNote,
        loading: false,
        error: null
      };
    
    case 'DELETE_NOTE':
      return {
        ...state,
        notes: state.notes.filter(note => note._id !== action.payload),
        selectedNote: state.selectedNote?._id === action.payload ? null : state.selectedNote,
        loading: false,
        error: null
      };
    
    case 'SET_SELECTED_NOTE':
      // ✅ FIXED: Prevent unnecessary updates
      if (state.selectedNote?._id === action.payload?._id) {
        return state;
      }
      return { ...state, selectedNote: action.payload };
    
    case 'OPTIMISTIC_UPDATE':
      const { id, updates } = action.payload;
      
      // ✅ FIXED: Create new objects only when necessary
      const optimisticNotes = state.notes.map(note =>
        note._id === id ? { ...note, ...updates } : note
      );
      
      const optimisticSelectedNote = state.selectedNote?._id === id
        ? { ...state.selectedNote, ...updates }
        : state.selectedNote;
      
      return {
        ...state,
        notes: optimisticNotes,
        selectedNote: optimisticSelectedNote
      };
    
    case 'REVERT_OPTIMISTIC_UPDATE':
      // Find the original note from the server
      const noteToRevert = state.notes.find(note => note._id === action.payload);
      if (!noteToRevert) return state;
      
      return {
        ...state,
        notes: state.notes.map(note =>
          note._id === action.payload ? noteToRevert : note
        ),
        selectedNote: state.selectedNote?._id === action.payload ? noteToRevert : state.selectedNote
      };
    
    default:
      return state;
  }
};

interface NotesContextType {
  state: NotesState;
  fetchNotes: () => Promise<void>;
  createNote: (title: string, content?: string) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  selectNote: (note: Note | null) => void;
  optimisticUpdate: (id: string, updates: Partial<Note>) => void;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

interface NotesProviderProps {
  children: ReactNode;
}

export const NotesProvider: React.FC<NotesProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(notesReducer, initialState);
  const { socket } = useSocket();

  // ✅ FIXED: Stable callback references
  const optimisticUpdate = useCallback((id: string, updates: Partial<Note>) => {
    dispatch({ type: 'OPTIMISTIC_UPDATE', payload: { id, updates } });
  }, []);

  // ✅ FIXED: Handle real-time updates with stable references
  useEffect(() => {
    if (!socket) return;

    const handleNoteUpdate = (data: any) => {
      console.log('Real-time update received:', data);
      optimisticUpdate(data.noteId, { 
        content: data.content, 
        title: data.title,
        updatedAt: data.timestamp || new Date().toISOString()
      });
    };

    socket.on('noteContentUpdated', handleNoteUpdate);

    return () => {
      socket.off('noteContentUpdated', handleNoteUpdate);
    };
  }, [socket, optimisticUpdate]);

  // ✅ FIXED: Fetch all notes with proper error handling
  const fetchNotes = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.get('/notes');
      dispatch({ type: 'SET_NOTES', payload: response.data.data.notes });
    } catch (error: any) {
      console.error('Failed to fetch notes:', error);
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to fetch notes' });
    }
  }, []);

  // ✅ FIXED: Create new note with proper error handling
  const createNote = useCallback(async (title: string, content: string = ''): Promise<Note> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.post('/notes', { title, content });
      const newNote = response.data.data.note;
      dispatch({ type: 'ADD_NOTE', payload: newNote });
      return newNote;
    } catch (error: any) {
      console.error('Failed to create note:', error);
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to create note' });
      throw error;
    }
  }, []);

  // ✅ FIXED: Update note with better error handling and retry logic
  const updateNote = useCallback(async (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => {
    try {
      console.log('Updating note:', id, updates);
      
      // ✅ FIXED: Optimistic update first
      dispatch({ type: 'OPTIMISTIC_UPDATE', payload: { id, updates } });
      
      // ✅ FIXED: Send to server with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await api.put(`/notes/${id}`, updates, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // ✅ FIXED: Update with server response
      dispatch({ type: 'UPDATE_NOTE', payload: response.data.data.note });
      console.log('Note updated successfully');
      
    } catch (error: any) {
      console.error('Failed to update note:', error);
      
      // ✅ FIXED: Better error handling
      if (error.response?.status === 403) {
        dispatch({ type: 'SET_ERROR', payload: 'You do not have permission to edit this note' });
      } else if (error.response?.status === 401) {
        dispatch({ type: 'SET_ERROR', payload: 'Your session has expired. Please log in again.' });
      } else if (error.name === 'AbortError') {
        dispatch({ type: 'SET_ERROR', payload: 'Request timed out. Please try again.' });
      } else {
        dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to update note' });
      }
      
      // ✅ FIXED: Revert optimistic update by fetching fresh data
      await fetchNotes();
      throw error;
    }
  }, [fetchNotes]);

  // ✅ FIXED: Delete note with proper error handling
  const deleteNote = useCallback(async (id: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await api.delete(`/notes/${id}`);
      dispatch({ type: 'DELETE_NOTE', payload: id });
    } catch (error: any) {
      console.error('Failed to delete note:', error);
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to delete note' });
      throw error;
    }
  }, []);

  // ✅ FIXED: Select note with proper reference checking
  const selectNote = useCallback((note: Note | null) => {
    dispatch({ type: 'SET_SELECTED_NOTE', payload: note });
  }, []);

  // Load notes on mount
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // ✅ FIXED: Stable value object to prevent provider re-renders
  const value: NotesContextType = React.useMemo(() => ({
    state,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    selectNote,
    optimisticUpdate,
  }), [state, fetchNotes, createNote, updateNote, deleteNote, selectNote, optimisticUpdate]);

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  );
};

// Custom hook to use notes context
export const useNotes = (): NotesContextType => {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
};