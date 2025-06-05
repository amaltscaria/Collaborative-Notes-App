// frontend/src/contexts/NotesContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
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
  | { type: 'OPTIMISTIC_UPDATE'; payload: { id: string; updates: Partial<Note> } };

const initialState: NotesState = {
  notes: [],
  loading: false,
  error: null,
  selectedNote: null,
};

// useReducer for complex state management
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
      return {
        ...state,
        notes: state.notes.map(note => 
          note._id === action.payload._id ? action.payload : note
        ),
        selectedNote: state.selectedNote?._id === action.payload._id ? action.payload : state.selectedNote,
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
      return { ...state, selectedNote: action.payload };
    
    case 'OPTIMISTIC_UPDATE':
      // Optimistic UI update - update immediately, sync later
      return {
        ...state,
        notes: state.notes.map(note =>
          note._id === action.payload.id
            ? { ...note, ...action.payload.updates }
            : note
        ),
        selectedNote: state.selectedNote?._id === action.payload.id
          ? { ...state.selectedNote, ...action.payload.updates }
          : state.selectedNote
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

  // Fetch all notes
  const fetchNotes = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.get('/notes');
      dispatch({ type: 'SET_NOTES', payload: response.data.data.notes });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to fetch notes' });
    }
  };

  // Create new note
  const createNote = async (title: string, content: string = ''): Promise<Note> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await api.post('/notes', { title, content });
      const newNote = response.data.data.note;
      dispatch({ type: 'ADD_NOTE', payload: newNote });
      return newNote;
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to create note' });
      throw error;
    }
  };

  // Update note with optimistic updates
  const updateNote = async (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => {
    try {
      // Optimistic update - update UI immediately
      dispatch({ type: 'OPTIMISTIC_UPDATE', payload: { id, updates } });
      
      // Send to server
      const response = await api.put(`/notes/${id}`, updates);
      
      // Update with server response (in case server modified data)
      dispatch({ type: 'UPDATE_NOTE', payload: response.data.data.note });
    } catch (error: any) {
      // Revert optimistic update by refetching
      await fetchNotes();
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to update note' });
      throw error;
    }
  };

  // Delete note
  const deleteNote = async (id: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await api.delete(`/notes/${id}`);
      dispatch({ type: 'DELETE_NOTE', payload: id });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to delete note' });
      throw error;
    }
  };

  // Select note for editing
  const selectNote = (note: Note | null) => {
    dispatch({ type: 'SET_SELECTED_NOTE', payload: note });
  };

  // Optimistic update for real-time collaboration
  const optimisticUpdate = (id: string, updates: Partial<Note>) => {
    dispatch({ type: 'OPTIMISTIC_UPDATE', payload: { id, updates } });
  };

  // Load notes on mount
  useEffect(() => {
    fetchNotes();
  }, []);

  const value: NotesContextType = {
    state,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    selectNote,
    optimisticUpdate,
  };

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