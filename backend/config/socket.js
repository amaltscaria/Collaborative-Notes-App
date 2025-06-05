// backend/config/socket.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      //   credentials: true,
    },
  });

  // Store connected users
  const connectedUsers = new Map();

  io.on("connection", (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);

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

        // Store authenticated user info
        socket.userId = user._id.toString();
        socket.username = user.username;
        socket.join(`user_${socket.userId}`);
        connectedUsers.set(socket.userId, socket.id);

        console.log(
          `✅ User authenticated: ${user.username} (${socket.userId})`
        );
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

      socket.leave(`note_${noteId}`);
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

      socket.to(`note_${noteId}`).emit("userTyping", {
        userId: socket.userId,
        username: socket.username,
        noteId,
        isTyping,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.id}`);

      if (socket.userId) {
        connectedUsers.delete(socket.userId);
      }
    });
  });

  console.log("🚀 Socket.IO initialized with JWT authentication");

  return io;
};
