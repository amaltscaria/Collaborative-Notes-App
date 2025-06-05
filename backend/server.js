import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import connectDB from "./config/database.js";
import { initializeSocket } from "./config/socket.js";
import authRoutes from "./routes/authRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";

dotenv.config();

const app = express();
const server = createServer(app);

app.use(
  cors({
    origin: process.env.FRONT_END_URL || "http://localhost:5173",
  })
);
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/notes", noteRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Notes API is running!",
    timestamp: new Date().toISOString(),
  });
});

const startServer = async () => {
  try {
    await connectDB();

    // Initialize Socket.IO ONCE here
    initializeSocket(server);

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      // ← Use server.listen() not app.listen()
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 Socket.IO ready`);
    });
  } catch (error) {
    console.log("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown remains the same...

// Single cleanup for both server and database
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  await mongoose.connection.close();
  console.log("✅ Database connection closed");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  await mongoose.connection.close();
  console.log("✅ Database connection closed");
  process.exit(0);
});
