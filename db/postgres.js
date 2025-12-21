import pkg from 'pg';
const { Pool } = pkg;

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.warn('[WARN] DATABASE_URL not set - database features will be unavailable');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Increase timeout for Vercel cold starts
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 5, // Limit connections for serverless
});

// Log connection errors
pool.on('error', (err) => {
  console.error('[ERROR] Unexpected pool error:', err.message);
});

pool.on('connect', () => {
  console.log('[INFO] Database pool connection established');
});

// Initialize schema on startup (non-blocking)
async function initializeSchema() {
  try {
    console.log('[INFO] Initializing database schema...');
    const client = await pool.connect();
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        profile_picture TEXT,
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        author_id INTEGER NOT NULL REFERENCES users(id),
        section TEXT,
        group_number TEXT,
        full_name TEXT,
        matricule TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create reviews table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        reviewer_id INTEGER NOT NULL REFERENCES users(id),
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, reviewer_id)
      )
    `);

    // Create project_files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_files (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        file_path TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    client.release();
    console.log('[INFO] Database schema initialized successfully');
  } catch (err) {
    console.error('[ERROR] Failed to initialize database schema:', err.message);
    console.error('[ERROR] Stack:', err.stack);
    if (process.env.NODE_ENV === 'development') {
      process.exit(1);
    } else {
      // On production (Vercel), continue even if schema init fails
      console.error('[WARN] Continuing without schema initialization - manual setup may be required');
    }
  }
}

// Initialize schema asynchronously (don't block server startup)
initializeSchema().catch(err => {
  console.error('[CRITICAL] Schema initialization failed:', err.message);
});

export default pool;
