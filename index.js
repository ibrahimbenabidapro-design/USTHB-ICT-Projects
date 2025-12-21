import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api", (req, res) => {
  res.json({ message: "TIC Projects Platform API is running", version: "1.0.0" });
});

import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import userRoutes from "./routes/users.js";

app.use("/auth", authRoutes);
app.use("/projects", projectRoutes);
app.use("/users", userRoutes);

// Global error handler - catches all errors from routes
app.use((err, req, res, next) => {
  console.error("[CRITICAL ERROR] Unhandled error:");
  console.error("Error message:", err.message);
  console.error("Error stack:", err.stack);
  console.error("URL:", req.method, req.url);
  console.error("Body:", req.body);
  
  // Send error response
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

app.get("*", (req, res) => {
  if (!req.path.startsWith("/api") && !req.path.startsWith("/auth") && !req.path.startsWith("/projects") && !req.path.startsWith("/users")) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[✓] Server running on port ${PORT}`);
  console.log(`[✓] Frontend: http://localhost:${PORT}`);
  console.log(`[✓] API: http://localhost:${PORT}/api`);
  console.log(`[INFO] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[INFO] Database: ${process.env.DATABASE_URL ? 'Configured' : 'NOT CONFIGURED'}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('[CRITICAL] Server error:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception:', err.message);
  console.error('[CRITICAL] Stack:', err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled rejection at:', promise);
  console.error('[CRITICAL] Reason:', reason);
});
