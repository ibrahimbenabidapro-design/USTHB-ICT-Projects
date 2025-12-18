import express from "express";
import db from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "public", "uploads", "avatars");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "avatar-" + uniqueName + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed"));
  }
});

router.get("/search", (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const users = db.prepare(`
      SELECT id, username, full_name, profile_picture, bio, created_at
      FROM users
      WHERE username LIKE ? OR full_name LIKE ?
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`);

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to search users" });
  }
});

router.get("/me", authenticateToken, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, email, full_name, profile_picture, bio, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/me", authenticateToken, upload.single("profile_picture"), (req, res) => {
  try {
    const { username, full_name, bio } = req.body;

    const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (username && username !== currentUser.username) {
      const existingUser = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, req.user.id);
      if (existingUser) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    let profilePicture = currentUser.profile_picture;
    if (req.file) {
      profilePicture = `/uploads/avatars/${req.file.filename}`;
    }

    db.prepare(`
      UPDATE users SET username = ?, full_name = ?, bio = ?, profile_picture = ?
      WHERE id = ?
    `).run(
      username || currentUser.username,
      full_name || currentUser.full_name,
      bio || currentUser.bio,
      profilePicture,
      req.user.id
    );

    const updatedUser = db.prepare(`
      SELECT id, username, email, full_name, profile_picture, bio, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/:id", (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, full_name, profile_picture, bio, created_at
      FROM users WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const projects = db.prepare(`
      SELECT projects.*, project_files.file_path,
        COALESCE(AVG(reviews.rating), 0) as avg_rating,
        COUNT(reviews.id) as review_count
      FROM projects
      LEFT JOIN project_files ON project_files.project_id = projects.id
      LEFT JOIN reviews ON reviews.project_id = projects.id
      WHERE projects.author_id = ?
      GROUP BY projects.id
      ORDER BY projects.created_at DESC
    `).all(req.params.id);

    res.json({ user, projects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
