# Collaborative Notes App

Real-time collaborative notes with React, TypeScript, Node.js, and Socket.IO.

## ✨ Features
- 🔐 **Auth**: JWT login/register
- 📝 **Notes**: Create, edit, delete with auto-save
- ⚡ **Real-time**: Live collaboration via WebSockets
- 👥 **Sharing**: Invite collaborators (read/write permissions)
- 📱 **Responsive**: Works on all devices

## 🚀 Quick Start

### Backend
```bash
cd backend
npm install
cp .env.example .env  # Add MongoDB URI + JWT secret
npm run dev           # Runs on :3000
```

### Frontend  
```bash
cd frontend
npm install
npm run dev          # Runs on :5173
```

### Environment Setup
```env
# backend/.env
MONGODB_URI=mongodb://localhost:27017/notes
JWT_SECRET=your-secret-key
CLIENT_URL=http://localhost:5173
```

## 🛠 Tech Stack

**Frontend:** React 18, TypeScript, Tailwind, Context API, Socket.IO  
**Backend:** Node.js, Express, MongoDB, JWT, Socket.IO  
**Features:** Auto-save, optimistic UI, real-time sync, role-based access

## 📁 Project Structure
```
├── frontend/src/
│   ├── components/     # Auth, Notes, UI components
│   ├── contexts/       # AuthContext, NotesContext  
│   ├── hooks/          # useSocket, useAutoSave, useDebounce
│   └── lib/            # API client, validation
├── backend/
│   ├── controllers/    # Auth, Notes logic
│   ├── models/         # User, Note schemas
│   ├── routes/         # API endpoints
│   └── config/         # Database, Socket setup
```

## 🔧 Key Implementation Details

### Auto-save Logic
- Debounced saving (2s delay)
- Prevents save on note loading
- User edit tracking to avoid conflicts

### Real-time Collaboration  
- Socket.IO rooms per note
- Live cursor positions
- Conflict resolution (last-write-wins)

### Security
- JWT auth with middleware
- Role-based note permissions
- Input validation (Zod + server-side)

## 🐛 Major Issues Solved
- ✅ **Infinite re-renders** - Fixed useEffect dependencies
- ✅ **403 errors on load** - Added user edit tracking  
- ✅ **Socket loops** - Proper cleanup functions
- ✅ **Auto-save conflicts** - Manual save logic

## 📚 API Endpoints
```
POST /api/auth/login              # Login user
GET  /api/notes                   # Get user notes  
POST /api/notes                   # Create note
PUT  /api/notes/:id               # Update note
POST /api/notes/:id/collaborators # Add collaborator
```

## 🔌 Socket Events
```javascript
socket.emit('joinNote', noteId)
socket.on('noteContentUpdated', data)
```

## ✅ Requirements Met
- ✅ React + TypeScript + Tailwind
- ✅ Context API state management  
- ✅ Protected routes + auth
- ✅ Form validation (Zod)
- ✅ Optimistic UI updates
- ✅ Custom hooks, useReducer, error boundaries
- ✅ Node/Express + JWT auth
- ✅ RESTful APIs + role-based access
- ✅ WebSocket real-time updates
- ✅ Collaborative editing

---

**Built by [Amal T Scaria](https://github.com/amaltscaria)** | Full-stack TypeScript app with real-time collaboration