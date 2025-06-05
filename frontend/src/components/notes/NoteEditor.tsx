// frontend/src/components/notes/NoteEditor.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNotes } from '../../contexts/NotesContext';
import { useSocket } from '../../hooks';
import { useAutoSave, useDebounce } from '../../hooks';

const NoteEditor: React.FC = () => {
  const { state, updateNote, selectNote } = useNotes();
  const { socket, connected } = useSocket();
  const { selectedNote } = state;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Debounced values for auto-save
  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContent = useDebounce(content, 1000);

  // Auto-save function
  const autoSave = useCallback(async (data: { title: string; content: string }) => {
    if (!selectedNote || (!data.title.trim() && !data.content.trim())) return;
    
    try {
      await updateNote(selectedNote._id, {
        title: data.title.trim() || 'Untitled',
        content: data.content
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [selectedNote, updateNote]);

  // Use auto-save hook
  const { isSaving, lastSaved } = useAutoSave(
    { title: debouncedTitle, content: debouncedContent },
    autoSave,
    2000
  );

  // Load selected note data
  useEffect(() => {
    if (selectedNote) {
      setTitle(selectedNote.title);
      setContent(selectedNote.content);
      setHasUnsavedChanges(false);
      setIsEditing(true);
      
      // Join note room for real-time collaboration
      if (socket && connected) {
        socket.emit('joinNote', selectedNote._id);
      }
    } else {
      setTitle('');
      setContent('');
      setIsEditing(false);
      setHasUnsavedChanges(false);
    }

    // Cleanup: leave note room when switching notes
    return () => {
      if (socket && connected && selectedNote) {
        socket.emit('leaveNote', selectedNote._id);
      }
    };
  }, [selectedNote, socket, connected]);

  // Handle real-time updates from socket
  useEffect(() => {
    if (!socket || !selectedNote) return;

    const handleNoteUpdate = (data: any) => {
      if (data.noteId === selectedNote._id) {
        // Update from another user - don't trigger auto-save
        setTitle(data.title || '');
        setContent(data.content || '');
      }
    };

    socket.on('noteContentUpdated', handleNoteUpdate);

    return () => {
      socket.off('noteContentUpdated', handleNoteUpdate);
    };
  }, [socket, selectedNote]);

  // Emit real-time changes to other users
  const emitChange = useCallback((newTitle: string, newContent: string) => {
    if (socket && connected && selectedNote) {
      socket.emit('noteContentChange', {
        noteId: selectedNote._id,
        title: newTitle,
        content: newContent
      });
    }
  }, [socket, connected, selectedNote]);

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setHasUnsavedChanges(true);
    emitChange(newTitle, content);
  };

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasUnsavedChanges(true);
    emitChange(title, newContent);
  };

  // Handle close editor
  const handleClose = () => {
    selectNote(null);
  };

  // Get user permission for current note
  const getUserPermission = () => {
    if (!selectedNote) return 'none';
    // Add permission logic here when we implement collaborators
    return 'write'; // For now, assume write permission
  };

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
          </div>
        </div>

        {/* Note Info */}
        <div className="text-sm text-gray-500">
          <span>Last edited: </span>
          <span>
            {new Date(selectedNote.updatedAt).toLocaleString()}
          </span>
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
            className="w-full text-2xl font-bold text-gray-900 placeholder-gray-400 border-0 focus:ring-0 focus:outline-none bg-transparent resize-none"
          />
        </div>

        {/* Content Textarea */}
        <div className="flex-1 p-4">
          <textarea
            value={content}
            onChange={handleContentChange}
            placeholder="Start writing your note..."
            disabled={!canEdit}
            className="w-full h-full text-gray-900 placeholder-gray-400 border-0 focus:ring-0 focus:outline-none bg-transparent resize-none text-base leading-relaxed"
          />
        </div>
      </div>

      {/* Read-only indicator */}
      {!canEdit && (
        <div className="p-3 bg-yellow-50 border-t border-yellow-200">
          <p className="text-sm text-yellow-800">
            You have read-only access to this note
          </p>
        </div>
      )}
    </div>
  );
};

export default NoteEditor;