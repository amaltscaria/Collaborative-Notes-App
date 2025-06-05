// frontend/src/components/notes/NoteEditor.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotes } from '../../contexts/NotesContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../hooks';
import { useAutoSave, useDebounce } from '../../hooks';


type TimeoutId = ReturnType<typeof setTimeout>;

const NoteEditor: React.FC = () => {
  const { state, updateNote, selectNote } = useNotes();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const { selectedNote } = state;

  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  
  const currentNoteId = useRef<string | null>(null);
  const lastNoteVersion = useRef<string>('');
  const isUpdatingFromSocket = useRef<boolean>(false);
  const emitChangeRef = useRef<TimeoutId | null>(null);

  const getUserPermission = useCallback((): 'none' | 'read' | 'write' => {
    if (!selectedNote || !user) return 'none';
    
    // Check if user is the owner
    if (selectedNote.owner._id === user._id) {
      return 'write';
    }
    
    // Check if user is a collaborator
    const collaborator = selectedNote.collaborators.find(
      collab => collab.user._id === user._id
    );
    
    return collaborator?.permission || 'none';
  }, [selectedNote?.owner._id, selectedNote?.collaborators, user?._id]);

  // Debounced values for auto-save
  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContent = useDebounce(content, 1000);


  const autoSave = useCallback(async (data: { title: string; content: string }): Promise<void> => {
    if (!selectedNote || (!data.title.trim() && !data.content.trim())) return;
    
    // Don't auto-save if user doesn't have write permission
    if (getUserPermission() !== 'write') {
      console.log('Auto-save skipped: User does not have write permission');
      return;
    }

    // Don't auto-save if we're updating from socket
    if (isUpdatingFromSocket.current) {
      console.log('Auto-save skipped: Updating from socket');
      return;
    }
    
    try {
      await updateNote(selectedNote._id, {
        title: data.title.trim() || 'Untitled',
        content: data.content
      });
      setHasUnsavedChanges(false);
      lastNoteVersion.current = data.title + '|' + data.content;
    } catch (error) {
      console.error('Auto-save failed:', error);
      setHasUnsavedChanges(true);
    }
  }, [selectedNote?._id, updateNote, getUserPermission]);

  // Use auto-save hook
  const { isSaving, lastSaved } = useAutoSave(
    { title: debouncedTitle, content: debouncedContent },
    autoSave,
    2000
  );
  useEffect(() => {
    if (!selectedNote) {
      setTitle('');
      setContent('');
      setIsEditing(false);
      setHasUnsavedChanges(false);
      currentNoteId.current = null;
      lastNoteVersion.current = '';
      return;
    }

    // Only update if this is a different note or the note data has actually changed
    const newVersion = selectedNote.title + '|' + selectedNote.content;
    const isDifferentNote = currentNoteId.current !== selectedNote._id;
    const hasContentChanged = lastNoteVersion.current !== newVersion && !isUpdatingFromSocket.current;

    if (isDifferentNote || hasContentChanged) {
      console.log('Loading note data:', {
        isDifferentNote,
        hasContentChanged,
        noteId: selectedNote._id,
        title: selectedNote.title
      });

      setTitle(selectedNote.title);
      setContent(selectedNote.content);
      setHasUnsavedChanges(false);
      setIsEditing(true);
      lastNoteVersion.current = newVersion;
      
      if (isDifferentNote) {
        currentNoteId.current = selectedNote._id;
      }
    }
  }, [selectedNote?._id, selectedNote?.title, selectedNote?.content, selectedNote?.updatedAt]);

  
  useEffect(() => {
    if (!socket || !connected || !selectedNote) {
      return;
    }

    const noteId = selectedNote._id;

    // Only join if we're not already in this note room
    if (currentNoteId.current !== noteId) {
      console.log('Joining note room:', noteId);
      
      // Leave previous room if exists
      if (currentNoteId.current) {
        socket.emit('leaveNote', currentNoteId.current);
        console.log('Left previous note room:', currentNoteId.current);
      }
      
      // Join new room
      socket.emit('joinNote', noteId);
      currentNoteId.current = noteId;
    }

    // Cleanup: leave room when note changes or component unmounts
    return () => {
      if (noteId && socket.connected) {
        socket.emit('leaveNote', noteId);
        console.log('Left note room on cleanup:', noteId);
      }
    };
  }, [socket, connected, selectedNote?._id]);

  
  useEffect(() => {
    if (!socket || !selectedNote) return;

    const handleNoteUpdate = (data: {
      noteId: string;
      title?: string;
      content?: string;
      updatedBy?: string;
      timestamp?: string;
    }) => {
      if (data.noteId !== selectedNote._id) return;
      
      // Don't update if the change came from this user
      if (data.updatedBy === user?._id) {
        console.log('Ignoring update from self');
        return;
      }

      console.log('Received real-time update:', data);
      
      // Prevent auto-save during socket update
      isUpdatingFromSocket.current = true;
      
      // Update local state
      setTitle(data.title || '');
      setContent(data.content || '');
      setHasUnsavedChanges(false);
      
      // Update version tracking
      lastNoteVersion.current = (data.title || '') + '|' + (data.content || '');
      
      // Re-enable auto-save after a short delay
      setTimeout(() => {
        isUpdatingFromSocket.current = false;
      }, 100);
    };

    socket.on('noteContentUpdated', handleNoteUpdate);

    return () => {
      socket.off('noteContentUpdated', handleNoteUpdate);
    };
  }, [socket, selectedNote?._id, user?._id]);

  // ✅ FIXED: Type-safe emit changes with debouncing
  const emitChange = useCallback((newTitle: string, newContent: string): void => {
    if (!socket || !connected || !selectedNote || isUpdatingFromSocket.current) return;

    // Clear existing timeout
    if (emitChangeRef.current) {
      clearTimeout(emitChangeRef.current);
      emitChangeRef.current = null;
    }

    // Set new timeout
    emitChangeRef.current = setTimeout(() => {
      socket.emit('noteContentChange', {
        noteId: selectedNote._id,
        title: newTitle,
        content: newContent
      });
      emitChangeRef.current = null;
    }, 300);
  }, [socket, connected, selectedNote?._id]);

  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (isUpdatingFromSocket.current) return;
    
    const newTitle = e.target.value;
    setTitle(newTitle);
    setHasUnsavedChanges(true);
    emitChange(newTitle, content);
  };

  // ✅ FIXED: Handle content change with proper typing
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    if (isUpdatingFromSocket.current) return;
    
    const newContent = e.target.value;
    setContent(newContent);
    setHasUnsavedChanges(true);
    emitChange(title, newContent);
  };


  const handleClose = (): void => {
    if (emitChangeRef.current) {
      clearTimeout(emitChangeRef.current);
      emitChangeRef.current = null;
    }
    selectNote(null);
  };


  useEffect(() => {
    return () => {
      if (emitChangeRef.current) {
        clearTimeout(emitChangeRef.current);
        emitChangeRef.current = null;
      }
    };
  }, []);

  const permission = getUserPermission();
  const canEdit = permission === 'write';

  if (!isEditing || !selectedNote) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">📝</div>
          <p className="text-lg font-medium mb-2">No note selected</p>
          <p className="text-sm">Select a note from the list to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close editor"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          
          <div className="flex items-center space-x-2">
            {/* Save Status */}
            {isSaving ? (
              <div className="flex items-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400 mr-2"></div>
                Saving...
              </div>
            ) : hasUnsavedChanges ? (
              <span className="text-sm text-yellow-600">Unsaved changes</span>
            ) : lastSaved ? (
              <span className="text-sm text-green-600">Saved</span>
            ) : null}

            {/* Connection Status */}
            <div className="flex items-center space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-green-500' : 'bg-red-500'
                }`}
                title={connected ? 'Connected' : 'Disconnected'}
              />
              <span className="text-xs text-gray-500">
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Permission indicator */}
            <span className={`text-xs px-2 py-1 rounded-full ${
              permission === 'write' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {permission === 'write' ? 'Editor' : 'Read-only'}
            </span>
          </div>
        </div>

        {/* Note Info */}
        <div className="text-sm text-gray-500">
          <span>Last edited: </span>
          <span>
            {new Date(selectedNote.updatedAt).toLocaleString()}
          </span>
          {selectedNote.lastEditedBy && (
            <span className="ml-2">
              by {selectedNote.lastEditedBy.username}
            </span>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex flex-col">
        {/* Title Input */}
        <div className="p-4 border-b border-gray-100">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Note title..."
            disabled={!canEdit}
            className={`w-full text-2xl font-bold text-gray-900 placeholder-gray-400 border-0 focus:ring-0 focus:outline-none bg-transparent resize-none ${
              !canEdit ? 'cursor-not-allowed opacity-60' : ''
            }`}
          />
        </div>

        {/* Content Textarea */}
        <div className="flex-1 p-4">
          <textarea
            value={content}
            onChange={handleContentChange}
            placeholder="Start writing your note..."
            disabled={!canEdit}
            className={`w-full h-full text-gray-900 placeholder-gray-400 border-0 focus:ring-0 focus:outline-none bg-transparent resize-none text-base leading-relaxed ${
              !canEdit ? 'cursor-not-allowed opacity-60' : ''
            }`}
          />
        </div>
      </div>

      {/* Status indicators */}
      {!canEdit && permission !== 'none' && (
        <div className="p-3 bg-yellow-50 border-t border-yellow-200">
          <p className="text-sm text-yellow-800">
            You have read-only access to this note
          </p>
        </div>
      )}

      {permission === 'none' && (
        <div className="p-3 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-800">
            You do not have access to this note
          </p>
        </div>
      )}
    </div>
  );
};

export default NoteEditor;