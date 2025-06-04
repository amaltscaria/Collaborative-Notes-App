import expresss from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./config/database.js";
import setupSocket from "./config/socket.js";

// Load environment variables
dotenv.config();

const app = expresss();
const server = createServer(app);
const io = setupSocket(server);

// Middleware

app.use(
  cors({
    origin: process.env.FRONT_END_URL || "http://localhost:5173",
    credentials: true, // Allows cookies cross - site
  })
);
app.use(expresss.json());

// Test Route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Notes API is running!",
    timestamp: new Date().toISOString(),
  });
});

const startServer = async () => {
  try {
    // connect to DB right
    await connectDB();

    // Setup socket after db connection
    setupSocket(server);

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.log("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

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
