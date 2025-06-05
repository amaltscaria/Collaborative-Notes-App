// backend/config/socket.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Store connected users and rate limiting
  const connectedUsers = new Map();
  const connectionAttempts = new Map();
  const userRooms = new Map(); // Track which rooms each user is in

  io.on("connection", (socket) => {
    const clientIP = socket.handshake.address;
    
    // ✅ ADD: Rate limiting to prevent spam connections
    const now = Date.now();
    const attempts = connectionAttempts.get(clientIP) || [];
    const recentAttempts = attempts.filter(time => now - time < 60000); // 1 minute window
    
    if (recentAttempts.length > 10) { // Max 10 connections per minute per IP
      console.log(`🚫 Rate limit exceeded for ${clientIP}`);
      socket.disconnect(true);
      return;
    }
    
    recentAttempts.push(now);
    connectionAttempts.set(clientIP, recentAttempts);

    console.log(`🔗 User connected: ${socket.id} (${recentAttempts.length}/10)`);

    // Handle user authentication with JWT verification
    socket.on("authenticate", async (data) => {
      try {
        const { token } = data;

        if (!token) {
          socket.emit("authError", { message: "No token provided" });
          return;
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find user in database
        const user = await User.findById(decoded.userId);

        if (!user) {
          socket.emit("authError", { message: "User not found" });
          return;
        }

        // ✅ PREVENT: Multiple authentications for same user
        if (socket.userId) {
          console.log(`⚠️ User ${socket.userId} already authenticated`);
          return;
        }

        // Store authenticated user info
        socket.userId = user._id.toString();
        socket.username = user.username;
        socket.join(`user_${socket.userId}`);
        
        // ✅ PREVENT: Duplicate user connections
        const existingSocketId = connectedUsers.get(socket.userId);
        if (existingSocketId && io.sockets.sockets.get(existingSocketId)) {
          console.log(`⚠️ Disconnecting duplicate connection for user ${socket.username}`);
          io.sockets.sockets.get(existingSocketId).disconnect(true);
        }
        
        connectedUsers.set(socket.userId, socket.id);
        userRooms.set(socket.userId, new Set());

        console.log(`✅ User authenticated: ${user.username} (${socket.userId})`);
        socket.emit("authenticated", {
          success: true,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
          },
        });
      } catch (error) {
        console.error("Socket auth error:", error);
        socket.emit("authError", {
          message:
            error.name === "JsonWebTokenError"
              ? "Invalid token"
              : "Authentication failed",
        });
      }
    });

    // Handle joining note rooms for collaboration (requires authentication)
    socket.on("joinNote", async (noteId) => {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      try {
        // ✅ PREVENT: Joining same room multiple times
        const currentRooms = userRooms.get(socket.userId) || new Set();
        if (currentRooms.has(noteId)) {
          console.log(`⚠️ User ${socket.username} already in note: ${noteId}`);
          return;
        }

        // Verify user has access to this note
        const Note = (await import("../models/Note.js")).default;
        const note = await Note.findById(noteId);

        if (!note) {
          socket.emit("error", { message: "Note not found" });
          return;
        }

        if (!note.hasAccess(socket.userId)) {
          socket.emit("error", { message: "Access denied to this note" });
          return;
        }

        socket.join(`note_${noteId}`);
        currentRooms.add(noteId);
        userRooms.set(socket.userId, currentRooms);
        
        console.log(`📝 User ${socket.username} joined note: ${noteId}`);

        // Notify others that someone joined
        socket.to(`note_${noteId}`).emit("userJoined", {
          userId: socket.userId,
          username: socket.username,
          noteId,
        });
      } catch (error) {
        console.error("Join note error:", error);
        socket.emit("error", { message: "Failed to join note" });
      }
    });

    // Handle leaving note rooms
    socket.on("leaveNote", (noteId) => {
      if (!socket.userId) return;

      const currentRooms = userRooms.get(socket.userId) || new Set();
      if (!currentRooms.has(noteId)) {
        console.log(`⚠️ User ${socket.username} not in note: ${noteId}`);
        return;
      }

      socket.leave(`note_${noteId}`);
      currentRooms.delete(noteId);
      userRooms.set(socket.userId, currentRooms);
      
      console.log(`📝 User ${socket.username} left note: ${noteId}`);

      // Notify others that someone left
      socket.to(`note_${noteId}`).emit("userLeft", {
        userId: socket.userId,
        username: socket.username,
        noteId,
      });
    });

    // Handle real-time note content changes
    socket.on("noteContentChange", (data) => {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      const { noteId, content, title } = data;

      // ✅ VERIFY: User is actually in the note room
      const currentRooms = userRooms.get(socket.userId) || new Set();
      if (!currentRooms.has(noteId)) {
        socket.emit("error", { message: "Not in note room" });
        return;
      }

      // Broadcast to all users in the note room except sender
      socket.to(`note_${noteId}`).emit("noteContentUpdated", {
        noteId,
        content,
        title,
        updatedBy: socket.userId,
        updatedByUsername: socket.username,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle typing indicators
    socket.on("typing", (data) => {
      if (!socket.userId) return;

      const { noteId, isTyping } = data;

      // ✅ VERIFY: User is in the note room
      const currentRooms = userRooms.get(socket.userId) || new Set();
      if (!currentRooms.has(noteId)) return;

      socket.to(`note_${noteId}`).emit("userTyping", {
        userId: socket.userId,
        username: socket.username,
        noteId,
        isTyping,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(`🔌 User disconnected: ${socket.id} (${reason})`);

      if (socket.userId) {
        // Clean up user data
        connectedUsers.delete(socket.userId);
        userRooms.delete(socket.userId);
        
        // Leave all rooms this user was in
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room.startsWith('note_')) {
            const noteId = room.replace('note_', '');
            socket.to(room).emit("userLeft", {
              userId: socket.userId,
              username: socket.username,
              noteId,
            });
          }
        });
      }
    });

    // ✅ ADD: Handle connection errors
    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // ✅ ADD: Clean up old connection attempts every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of connectionAttempts.entries()) {
      const recentAttempts = attempts.filter(time => now - time < 300000); // 5 minutes
      if (recentAttempts.length === 0) {
        connectionAttempts.delete(ip);
      } else {
        connectionAttempts.set(ip, recentAttempts);
      }
    }
  }, 300000); // 5 minutes

  console.log("🚀 Socket.IO initialized with JWT authentication and rate limiting");

  return io;
};