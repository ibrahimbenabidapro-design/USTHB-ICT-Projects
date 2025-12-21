import express from "express";
import pool from "../db/postgres.js";
import { authenticateToken } from "../middleware/auth.js";
import multer from "multer";

const router = express.Router();

// Use memory storage for Vercel serverless compatibility
// Files are stored in req.file.buffer instead of disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.split('.').pop().toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed"));
  }
});

router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const result = await pool.query(`
      SELECT id, username, full_name, profile_picture, bio, created_at
      FROM users
      WHERE username ILIKE $1 OR full_name ILIKE $1
      LIMIT 20
    `, [`%${q}%`]);

    res.json({ users: result.rows });
  } catch (err) {
    console.error("[ERROR] GET /users/search:", err.message, err.stack);
    res.status(500).json({ error: "Failed to search users" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, email, full_name, profile_picture, bio, created_at
      FROM users WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("[ERROR] GET /users/me:", err.message, err.stack);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/me", authenticateToken, upload.single("profile_picture"), async (req, res) => {
  try {
    const { username, full_name, bio } = req.body;

    // Validate required fields
    if (!username || username.trim() === "") {
      return res.status(400).json({ error: "Username is required" });
    }

    const currentUserResult = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentUser = currentUserResult.rows[0];

    if (username && username !== currentUser.username) {
      const existingResult = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [username, req.user.id]
      );
      if (existingResult.rows.length > 0) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    let profilePicture = currentUser.profile_picture;
    
    // Handle in-memory file buffer from multer
    if (req.file) {
      // Option 1: Store as base64 (simple, but database grows)
      // profilePicture = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      
      // Option 2: Upload to Cloudinary (recommended for production)
      // See VERCEL_SETUP.md for Cloudinary integration
      // For now, keep existing picture if upload service is not configured
      if (process.env.CLOUDINARY_URL) {
        // Placeholder - would be handled by cloudinary integration
        // Example: profilePicture = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
        console.warn("[WARN] Cloudinary integration not yet configured. Keeping existing profile picture.");
      } else {
        console.warn("[WARN] Profile picture upload ignored - no external storage configured. Configure CLOUDINARY_URL in .env");
      }
    }

    await pool.query(`
      UPDATE users SET username = $1, full_name = $2, bio = $3, profile_picture = $4
      WHERE id = $5
    `, [
      username || currentUser.username,
      full_name || currentUser.full_name,
      bio || currentUser.bio,
      profilePicture,
      req.user.id
    ]);

    const updatedResult = await pool.query(`
      SELECT id, username, email, full_name, profile_picture, bio, created_at
      FROM users WHERE id = $1
    `, [req.user.id]);

    res.json({ message: "Profile updated successfully", user: updatedResult.rows[0] });
  } catch (err) {
    console.error("[ERROR] PUT /users/me - Profile update failed:");
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    console.error("Request body:", req.body);
    console.error("Request user ID:", req.user?.id);
    console.error("Multer file info:", req.file ? { mimetype: req.file.mimetype, size: req.file.size, encoding: req.file.encoding } : "No file");
    
    res.status(500).json({ error: "Failed to update profile", details: process.env.NODE_ENV === "development" ? err.message : undefined });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userResult = await pool.query(`
      SELECT id, username, full_name, profile_picture, bio, created_at
      FROM users WHERE id = $1
    `, [req.params.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const projectsResult = await pool.query(`
      SELECT projects.*, project_files.file_path,
        COALESCE(AVG(reviews.rating), 0)::FLOAT as avg_rating,
        COUNT(reviews.id) as review_count
      FROM projects
      LEFT JOIN project_files ON project_files.project_id = projects.id
      LEFT JOIN reviews ON reviews.project_id = projects.id
      WHERE projects.author_id = $1
      GROUP BY projects.id, project_files.file_path
      ORDER BY projects.created_at DESC
    `, [req.params.id]);

    res.json({ user: userResult.rows[0], projects: projectsResult.rows });
  } catch (err) {
    console.error("[ERROR] GET /users/:id:", err.message, err.stack);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
