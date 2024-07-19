require("dotenv").config();

const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const port = process.env.API_PORT || 3000;

const app = express();
app.use(express.json());

const corsOptions = {
  origin: "http://192.168.65.98:8080",
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

const dbPath = path.join(__dirname, "notes_app.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(port, () => {
      console.log(`Server Running at http://localhost:${port}/`);
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// Authenticate Middleware Function
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "apsona", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.userId = payload.userId;
        next();
      }
    });
  }
};

// Register New User API
app.post("/api/register", async (request, response) => {
  const { email, name, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = uuidv4();

  const selectUserQuery = `SELECT * FROM users WHERE email = '${email}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const createUserQuery = `
        INSERT INTO users (id, email, name, password, created_at, updated_at) 
        VALUES 
        (
          '${userId}', 
          '${email}', 
          '${name}', 
          '${hashedPassword}', 
          CURRENT_TIMESTAMP, 
          CURRENT_TIMESTAMP
        );
`;
    await db.run(createUserQuery);
    response.send("Created new user");
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

// Login User API
app.post("/api/login", async (request, response) => {
  const { email, password } = request.body;
  const selectUserQuery = `SELECT * FROM users WHERE email = '${email}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("User does not exist");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { userId: dbUser.id };
      const jwtToken = jwt.sign(payload, "apsona");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// Change Password API
app.put("/api/reset-password", authenticateToken, async (request, response) => {
  const { oldPassword, newPassword } = request.body;
  const { userId } = request;

  const selectUserQuery = `SELECT * FROM users WHERE id = '${userId}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("User does not exist");
  } else {
    const isOldPasswordMatched = await bcrypt.compare(
      oldPassword,
      dbUser.password
    );
    if (isOldPasswordMatched) {
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      const updatePasswordQuery = `
          UPDATE users 
          SET password = '${hashedNewPassword}', updated_at = CURRENT_TIMESTAMP 
          WHERE id = '${userId}'
        `;
      await db.run(updatePasswordQuery);
      response.send("Password updated successfully");
    } else {
      response.status(400);
      response.send("Invalid old password");
    }
  }
});

// Create New Note API
app.post("/api/notes", authenticateToken, async (request, response) => {
  const { userId } = request;
  const {
    title = "",
    description = "",
    labels = "",
    reminder = null,
    backgroundColor = "",
  } = request.body;
  const noteId = uuidv4();

  const createNoteQuery = `
      INSERT INTO notes (id, user_id, title, description, labels, reminder, background_color, created_at, updated_at) 
      VALUES 
      (
        '${noteId}', 
        '${userId}', 
        '${title}', 
        '${description}', 
        '${labels}', 
        '${reminder}', 
        '${backgroundColor}', 
        CURRENT_TIMESTAMP, 
        CURRENT_TIMESTAMP
      );
    `;

  try {
    await db.run(createNoteQuery);
    response.status(201).send("Note created successfully");
  } catch (error) {
    response.status(500).send(`Error creating note: ${error.message}`);
  }
});

// Get All Notes API
app.get("/api/notes", authenticateToken, async (request, response) => {
  const { userId } = request;

  const selectNotesQuery = `
      SELECT * FROM notes 
      WHERE user_id = '${userId}'
      ORDER BY created_at DESC
    `;

  try {
    const notes = await db.all(selectNotesQuery);
    response.json(notes);
  } catch (error) {
    response.status(500).send(`Error fetching notes: ${error.message}`);
  }
});

// Update Note API
app.put("/api/notes/:id", authenticateToken, async (request, response) => {
  const { userId } = request;
  const { id } = request.params;
  const {
    title = "",
    description = "",
    labels = "",
    reminder = "",
    backgroundColor = "",
  } = request.body;

  const selectNoteQuery = `
      SELECT * FROM notes 
      WHERE id = '${id}' AND user_id = '${userId}'
    `;

  try {
    const dbNote = await db.get(selectNoteQuery);

    if (!dbNote) {
      response.status(404).send("Note not found");
      return;
    }

    const updateFields = {
      title: title !== "" ? title : dbNote.title,
      description: description !== "" ? description : dbNote.description,
      labels: labels !== "" ? labels : dbNote.labels,
      reminder: reminder !== "" ? reminder : dbNote.reminder,
      backgroundColor:
        backgroundColor !== "" ? backgroundColor : dbNote.background_color,
    };

    const updateNoteQuery = `
        UPDATE notes 
        SET 
          title = '${updateFields.title}', 
          description = '${updateFields.description}', 
          labels = '${updateFields.labels}', 
          reminder = ${
            updateFields.reminder ? `'${updateFields.reminder}'` : "NULL"
          }, 
          background_color = '${updateFields.backgroundColor}', 
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = '${id}' AND user_id = '${userId}'
      `;

    await db.run(updateNoteQuery);
    response.send("Note updated successfully");
  } catch (error) {
    response.status(500).send(`Error updating note: ${error.message}`);
  }
});

// Get Notes by Label API
app.get(
  "/api/notes/label/:label",
  authenticateToken,
  async (request, response) => {
    const { userId } = request;
    const { label } = request.params;

    const selectNotesByLabelQuery = `
    SELECT * FROM notes 
    WHERE user_id = '${userId}' AND labels LIKE '%${label}%'
    ORDER BY created_at DESC
  `;

    try {
      const notes = await db.all(selectNotesByLabelQuery);
      response.json(notes);
    } catch (error) {
      response
        .status(500)
        .send(`Error fetching notes by label: ${error.message}`);
    }
  }
);

// Archive Note API
app.put(
  "/api/notes/archive/:id",
  authenticateToken,
  async (request, response) => {
    const { userId } = request;
    const { id } = request.params;

    const selectNoteQuery = `
    SELECT * FROM notes 
    WHERE id = '${id}' AND user_id = '${userId}'
  `;

    try {
      const dbNote = await db.get(selectNoteQuery);

      if (!dbNote) {
        response.status(404).send("Note not found");
        return;
      }

      const archiveNoteQuery = `
      UPDATE notes 
      SET archived = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = '${id}' AND user_id = '${userId}'
    `;

      await db.run(archiveNoteQuery);
      response.send("Note archived successfully");
    } catch (error) {
      response.status(500).send(`Error archiving note: ${error.message}`);
    }
  }
);

// Get Archived Notes API
app.get("/api/notes/archived", authenticateToken, async (request, response) => {
  const { userId } = request;

  const selectArchivedNotesQuery = `
    SELECT * FROM notes 
    WHERE user_id = '${userId}' AND archived = 1
    ORDER BY created_at DESC
  `;

  try {
    const notes = await db.all(selectArchivedNotesQuery);
    response.json(notes);
  } catch (error) {
    response
      .status(500)
      .send(`Error fetching archived notes: ${error.message}`);
  }
});

// Get Notes with Upcoming Reminder API
app.get(
  "/api/notes/reminders",
  authenticateToken,
  async (request, response) => {
    const { userId } = request;

    const selectRemindersQuery = `
    SELECT * FROM notes 
    WHERE user_id = '${userId}' AND reminder IS NOT NULL AND reminder > CURRENT_TIMESTAMP
    ORDER BY reminder ASC
  `;

    try {
      const notes = await db.all(selectRemindersQuery);
      response.json(notes);
    } catch (error) {
      response.status(500).send(`Error fetching reminders: ${error.message}`);
    }
  }
);

// Delete Note API
app.delete("/api/notes/:id", authenticateToken, async (request, response) => {
  const { userId } = request;
  const { id } = request.params;

  const selectNoteQuery = `
    SELECT * FROM notes 
    WHERE id = '${id}' AND user_id = '${userId}'
  `;

  try {
    const dbNote = await db.get(selectNoteQuery);

    if (!dbNote) {
      response.status(404).send("Note not found");
      return;
    }

    const deleteNoteQuery = `
      UPDATE notes 
      SET trashed = 1, deleted_at = CURRENT_TIMESTAMP 
      WHERE id = '${id}' AND user_id = '${userId}'
    `;

    await db.run(deleteNoteQuery);
    response.send("Note moved to trash successfully");
  } catch (error) {
    response.status(500).send(`Error deleting note: ${error.message}`);
  }
});

// Get Trashed Notes API
app.get("/api/notes/trashed", authenticateToken, async (request, response) => {
  const { userId } = request;

  const selectTrashedNotesQuery = `
    SELECT * FROM notes 
    WHERE user_id = '${userId}' AND trashed = 1 AND deleted_at >= datetime('now', '-30 days')
    ORDER BY deleted_at DESC
  `;

  try {
    const notes = await db.all(selectTrashedNotesQuery);
    response.json(notes);
  } catch (error) {
    response.status(500).send(`Error fetching trashed notes: ${error.message}`);
  }
});

// Permanently Delete Note API
app.delete(
  "/api/notes/trashed/:id",
  authenticateToken,
  async (request, response) => {
    const { userId } = request;
    const { id } = request.params;

    const selectNoteQuery = `
    SELECT * FROM notes 
    WHERE id = '${id}' AND user_id = '${userId}' AND trashed = 1
  `;

    try {
      const dbNote = await db.get(selectNoteQuery);

      if (!dbNote) {
        response.status(404).send("Note not found");
        return;
      }

      const deleteNoteQuery = `
      DELETE FROM notes 
      WHERE id = '${id}' AND user_id = '${userId}'
    `;

      await db.run(deleteNoteQuery);
      response.send("Note permanently deleted");
    } catch (error) {
      response
        .status(500)
        .send(`Error permanently deleting note: ${error.message}`);
    }
  }
);
