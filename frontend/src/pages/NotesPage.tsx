// frontend/src/pages/NotesPage.tsx
import React from 'react';
import { NotesProvider } from '../contexts/NotesContext';
import NotesList from '../components/notes/NotesList';
import NoteEditor from '../components/notes/NoteEditor';
import { useAuth } from '../contexts/AuthContext';
import { useWindowSize } from '../hooks';

const NotesPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { width } = useWindowSize();
  const isMobile = width < 768;

  const handleLogout = () => {
    logout();
  };

  return (
    <NotesProvider>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
                <span className="ml-3 text-sm text-gray-500">
                  Collaborative note-taking
                </span>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  <span className="font-medium">{user?.username}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Notes List Sidebar */}
          <div className={`${
            isMobile ? 'w-full' : 'w-80'
          } bg-white border-r border-gray-200 flex flex-col`}>
            <NotesList />
          </div>

          {/* Note Editor */}
          {!isMobile && (
            <div className="flex-1 flex flex-col">
              <NoteEditor />
            </div>
          )}
        </div>
      </div>
    </NotesProvider>
  );
};

export default NotesPage;