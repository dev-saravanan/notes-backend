-- USERS TABLE
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (id, email, name, password, created_at, updated_at) 
VALUES ('user123', 'user@example.com', 'John Doe', 'password123', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE users
SET password = 'newPassword123', updated_at = CURRENT_TIMESTAMP
WHERE id = 'user123';

-- Notes Table
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  labels TEXT,
  reminder DATETIME,
  background_color TEXT,
  archived INTEGER DEFAULT 0,
  trashed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);


INSERT INTO notes (id, title, description, labels, reminder, background_color, created_at, updated_at)
VALUES ('note123', 'Sample Title', 'This is a sample description.', 'label1,label2', '2024-07-18 12:00:00', 'blue', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE notes
SET title = 'Updated Title',
    description = 'This is an updated description.',
    labels = 'label3,label4',
    reminder = '2024-07-19 14:00:00',
    background_color = 'green',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'note123';
