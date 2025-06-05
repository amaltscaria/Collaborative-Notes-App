// frontend/src/components/dashboard/Dashboard.tsx
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">Notes App</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, <span className="font-medium">{user?.username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="btn-secondary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Welcome to Your Notes Dashboard
              </h2>
              <p className="text-gray-600 mb-8">
                Start creating and organizing your notes. Collaborate with others in real-time.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="card text-center">
                  <div className="text-primary-600 text-4xl mb-4">📝</div>
                  <h3 className="text-lg font-semibold mb-2">Create Notes</h3>
                  <p className="text-gray-600">Write and organize your thoughts</p>
                </div>
                
                <div className="card text-center">
                  <div className="text-primary-600 text-4xl mb-4">🤝</div>
                  <h3 className="text-lg font-semibold mb-2">Collaborate</h3>
                  <p className="text-gray-600">Share and edit notes with others</p>
                </div>
                
                <div className="card text-center">
                  <div className="text-primary-600 text-4xl mb-4">⚡</div>
                  <h3 className="text-lg font-semibold mb-2">Real-time</h3>
                  <p className="text-gray-600">See changes instantly</p>
                </div>
              </div>

              <div className="mt-8">
                <button className="btn-primary mr-4">
                  Create New Note
                </button>
                <button className="btn-secondary">
                  Browse Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;