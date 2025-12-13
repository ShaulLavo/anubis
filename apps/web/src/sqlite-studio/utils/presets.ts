export const PRESETS = {
	vector: {
		name: 'Vector Search',
		sql: `SELECT vec_version();
DROP TABLE IF EXISTS embeddings;
CREATE VIRTUAL TABLE embeddings USING vec0(vector float[4]);
INSERT INTO embeddings(rowid, vector) VALUES 
  (1, '[1.0, 0.0, 0.0, 0.0]'),
  (2, '[0.0, 1.0, 0.0, 0.0]'),
  (3, '[0.9, 0.1, 0.0, 0.0]');
SELECT rowid, distance FROM embeddings 
WHERE vector MATCH '[1.0, 0.0, 0.0, 0.0]' 
ORDER BY distance LIMIT 3;`,
	},
	soundex: {
		name: 'Soundex',
		sql: `SELECT soundex('Robert'), soundex('Rupert');
DROP TABLE IF EXISTS names;
CREATE TABLE names (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO names VALUES (1,'Robert'),(2,'Rupert'),(3,'Robin');
SELECT a.name, b.name as sounds_like
FROM names a, names b 
WHERE a.id < b.id AND soundex(a.name) = soundex(b.name);`,
	},
	fts: {
		name: 'Full Text Search',
		sql: `-- Ensure tables exist
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(title, content, content='', contentless_delete=1);
CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL);

-- Insert sample data if not exists
INSERT OR IGNORE INTO documents (id, title, content) VALUES (1, 'Introduction to SQLite', 'SQLite is a C library that provides a lightweight disk-based database. It allows accessing the database using SQL queries without a separate server process.');
INSERT OR IGNORE INTO documents_fts (rowid, title, content) VALUES (1, 'Introduction to SQLite', 'SQLite is a C library that provides a lightweight disk-based database. It allows accessing the database using SQL queries without a separate server process.');

-- Snippet example
SELECT 
  d.title,
  snippet(documents_fts, 1, '<b>', '</b>', '...', 10) as snippet,
  rank
FROM documents_fts f
JOIN documents d ON d.id = f.rowid
WHERE documents_fts MATCH 'sqlite'
ORDER BY rank;`,
	},
}
