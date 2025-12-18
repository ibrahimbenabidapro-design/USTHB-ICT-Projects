import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'tic_projects.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    profile_picture TEXT,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    section TEXT,
    group_number TEXT,
    full_name TEXT,
    matricule TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    UNIQUE(project_id, reviewer_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )
`);

// Add new columns if they don't exist (for existing databases)
try {
  db.exec(`ALTER TABLE projects ADD COLUMN section TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN group_number TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN full_name TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN matricule TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN full_name TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN profile_picture TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN bio TEXT`);
} catch (e) {}

export default db;
