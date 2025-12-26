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
	fuzzy: {
		name: 'Fuzzy Search',
		sql: `-- Levenshtein distance (edit distance)
SELECT levenshtein('hello', 'hallo') as lev_dist;

-- Damerau-Levenshtein (includes transpositions)
SELECT dlevenshtein('hello', 'ehllo') as dlev_dist;

-- Jaro-Winkler similarity (0-1, higher = more similar)
SELECT jaro_winkler('MARTHA', 'MARHTA') as jw_similarity;

-- Hamming distance (same-length strings)
SELECT hamming('karolin', 'kathrin') as hamming_dist;

-- Spellfix edit distance
SELECT edit_distance('receive', 'recieve') as spell_dist;

-- Phonetic functions for name matching
SELECT 
  soundex('Robert') as soundex_robert,
  soundex('Rupert') as soundex_rupert,
  phonetic_hash('Robert') as phash_robert,
  caverphone('Robert') as caver_robert;

-- Find similar names using fuzzy matching
DROP TABLE IF EXISTS names;
CREATE TABLE names (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO names VALUES (1,'Robert'),(2,'Rupert'),(3,'Robin'),(4,'Richard');

SELECT a.name, b.name as similar_to, 
       levenshtein(a.name, b.name) as edit_dist,
       soundex(a.name) = soundex(b.name) as same_soundex
FROM names a, names b 
WHERE a.id < b.id AND levenshtein(a.name, b.name) <= 3
ORDER BY edit_dist;`,
	},
	regex: {
		name: 'Regular Expressions',
		sql: `-- Check if pattern matches (returns 1 or 0)
SELECT regexp_like('hello world', 'w\\w+') as has_match;

-- Extract first match
SELECT regexp_substr('Order #12345 shipped', '#(\\d+)') as order_num;

-- Replace all matches
SELECT regexp_replace('hello   world', '\\s+', ' ') as cleaned;

-- Capture specific group (0=full, 1=first group, etc.)
SELECT regexp_capture('John Smith <john@example.com>', '<(.+)>', 1) as email;

-- Practical example: validate and parse emails
DROP TABLE IF EXISTS contacts;
CREATE TABLE contacts (id INTEGER PRIMARY KEY, info TEXT);
INSERT INTO contacts VALUES 
  (1, 'Contact: alice@company.com'),
  (2, 'Email bob_smith@test.org'),
  (3, 'No email here'),
  (4, 'Reach jane.doe@example.co.uk');

SELECT 
  id,
  info,
  regexp_like(info, '[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}') as has_email,
  regexp_substr(info, '[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}') as extracted_email
FROM contacts;`,
	},
	fts: {
		name: 'Full Text Search',
		sql: `-- Snippet example
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
