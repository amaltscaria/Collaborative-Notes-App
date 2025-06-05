// frontend/src/components/notes/NotesList.tsx
import React, { useState } from 'react';
import { useNotes } from '../../contexts/NotesContext';
import { useAuth } from '../../contexts/AuthContext';

const NotesList: React.FC = () => {
  const { state, createNote, deleteNote, selectNote } = useNotes();
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;

    try {
      setIsCreating(true);
      const note = await createNote(newNoteTitle.trim());
      setNewNoteTitle('');
      selectNote(note); // Auto-select the new note for editing
    } catch (error) {
      console.error('Failed to create note:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent note selection when clicking delete
    
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteNote(noteId);
      } catch (error) {
        console.error('Failed to delete note:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const isOwner = (note: any) => {
    return note.owner._id === user?._id;
  };

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Notes</h2>
        
        {/* Create New Note Form */}
        <form onSubmit={handleCreateNote} className="flex gap-2">
          <input
            type="text"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            placeholder="Enter note title..."
            className="input-field flex-1"
            disabled={isCreating}
          />
          <button
            type="submit"
            disabled={isCreating || !newNoteTitle.trim()}
            className={`btn-primary ${
              isCreating || !newNoteTitle.trim()
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      {/* Error Message */}
      {state.error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <p className="text-red-700 text-sm">{state.error}</p>
        </div>
      )}

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto">
        {state.notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="text-4xl mb-4">📝</div>
            <p className="text-lg font-medium mb-2">No notes yet</p>
            <p className="text-sm">Create your first note to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {state.notes.map((note) => (
              <div
                key={note._id}
                onClick={() => selectNote(note)}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  state.selectedNote?._id === note._id
                    ? 'bg-primary-50 border-r-2 border-primary-500'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Note Title */}
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {note.title}
                    </h3>
                    
                    {/* Note Content Preview */}
                    {note.content && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                        {truncateContent(note.content)}
                      </p>
                    )}
                    
                    {/* Metadata */}
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <span>{formatDate(note.updatedAt)}</span>
                      
                      {/* Owner/Collaborator indicator */}
                      {isOwner(note) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Owner
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Shared
                        </span>
                      )}
                      
                      {/* Collaborators count */}
                      {note.collaborators.length > 0 && (
                        <span className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                          </svg>
                          {note.collaborators.length + 1}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="ml-2 flex-shrink-0">
                    {isOwner(note) && (
                      <button
                        onClick={(e) => handleDeleteNote(note._id, e)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        title="Delete note"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 102 0v3a1 1 0 11-2 0V9zm4 0a1 1 0 10-2 0v3a1 1 0 002 0V9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesList;