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

const uploadDir = path.join(__dirname, "..", "public", "uploads");

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
    cb(null, "project-" + uniqueName + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.get("/", (req, res) => {
  try {
    const { section, group } = req.query;
    
    let query = `
      SELECT
        projects.id,
        projects.title,
        projects.description,
        projects.section,
        projects.group_number,
        projects.full_name,
        projects.matricule,
        projects.created_at,
        users.username AS author_name,
        users.id AS author_id,
        project_files.file_path,
        COALESCE(AVG(reviews.rating), 0) as avg_rating,
        COUNT(reviews.id) as review_count
      FROM projects
      JOIN users ON users.id = projects.author_id
      LEFT JOIN project_files ON project_files.project_id = projects.id
      LEFT JOIN reviews ON reviews.project_id = projects.id
    `;
    
    const conditions = [];
    const params = [];
    
    if (section) {
      conditions.push("projects.section = ?");
      params.push(section);
    }
    if (group) {
      conditions.push("projects.group_number = ?");
      params.push(group);
    }
    
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    
    query += " GROUP BY projects.id ORDER BY projects.created_at DESC";
    
    const projects = db.prepare(query).all(...params);
    res.json({ projects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load projects" });
  }
});

router.get("/:id", (req, res) => {
  try {
    const project = db.prepare(`
      SELECT
        projects.id,
        projects.title,
        projects.description,
        projects.section,
        projects.group_number,
        projects.full_name,
        projects.matricule,
        projects.created_at,
        users.username AS author_name,
        users.id AS author_id,
        project_files.file_path,
        COALESCE(AVG(reviews.rating), 0) as avg_rating,
        COUNT(reviews.id) as review_count
      FROM projects
      JOIN users ON users.id = projects.author_id
      LEFT JOIN project_files ON project_files.project_id = projects.id
      LEFT JOIN reviews ON reviews.project_id = projects.id
      WHERE projects.id = ?
      GROUP BY projects.id
    `).get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ project });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.post("/", authenticateToken, upload.single("file"), (req, res) => {
  try {
    const { title, description, section, group_number, full_name, matricule } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    if (title.length < 3) {
      return res.status(400).json({ error: "Title must be at least 3 characters" });
    }

    if (description.length < 10) {
      return res.status(400).json({ error: "Description must be at least 10 characters" });
    }

    const result = db.prepare(`
      INSERT INTO projects (title, description, author_id, section, group_number, full_name, matricule)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, req.user.id, section || null, group_number || null, full_name || null, matricule || null);

    const projectId = result.lastInsertRowid;

    if (req.file) {
      const filePath = `/uploads/${req.file.filename}`;
      db.prepare(`INSERT INTO project_files (project_id, file_path) VALUES (?, ?)`).run(projectId, filePath);
    }

    const project = db.prepare(`
      SELECT projects.*, users.username AS author_name, project_files.file_path
      FROM projects
      JOIN users ON users.id = projects.author_id
      LEFT JOIN project_files ON project_files.project_id = projects.id
      WHERE projects.id = ?
    `).get(projectId);

    res.status(201).json({ message: "Project created successfully", project });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.put("/:id", authenticateToken, (req, res) => {
  try {
    const { title, description, section, group_number, full_name, matricule } = req.body;
    const projectId = req.params.id;

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.author_id !== req.user.id) {
      return res.status(403).json({ error: "You can only edit your own projects" });
    }

    db.prepare(`
      UPDATE projects SET title = ?, description = ?, section = ?, group_number = ?, full_name = ?, matricule = ?
      WHERE id = ?
    `).run(title, description, section, group_number, full_name, matricule, projectId);

    res.json({ message: "Project updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/:id", authenticateToken, (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.author_id !== req.user.id) {
      return res.status(403).json({ error: "You can only delete your own projects" });
    }

    db.prepare("DELETE FROM reviews WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM project_files WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);

    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

router.post("/:id/reviews", authenticateToken, (req, res) => {
  try {
    const { rating, comment } = req.body;
    const projectId = req.params.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const existingReview = db.prepare("SELECT * FROM reviews WHERE project_id = ? AND reviewer_id = ?").get(projectId, req.user.id);

    if (existingReview) {
      db.prepare("UPDATE reviews SET rating = ?, comment = ? WHERE id = ?").run(rating, comment || null, existingReview.id);
      res.json({ message: "Review updated successfully" });
    } else {
      db.prepare("INSERT INTO reviews (project_id, reviewer_id, rating, comment) VALUES (?, ?, ?, ?)").run(projectId, req.user.id, rating, comment || null);
      res.status(201).json({ message: "Review added successfully" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add review" });
  }
});

router.get("/:id/reviews", (req, res) => {
  try {
    const projectId = req.params.id;
    const reviews = db.prepare(`
      SELECT reviews.*, users.username, users.profile_picture
      FROM reviews
      JOIN users ON users.id = reviews.reviewer_id
      WHERE reviews.project_id = ?
      ORDER BY reviews.created_at DESC
    `).all(projectId);

    res.json({ reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

router.get("/:id/my-review", authenticateToken, (req, res) => {
  try {
    const projectId = req.params.id;
    const review = db.prepare("SELECT * FROM reviews WHERE project_id = ? AND reviewer_id = ?").get(projectId, req.user.id);
    res.json({ review: review || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch review" });
  }
});

export default router;
