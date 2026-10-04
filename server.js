const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const seed = require("./seed");

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data", "db.json");
const PAGE_SIZE = 10;

/* ---------- storage: one JSON file, loaded at start, saved on every change ---------- */

function loadDb() {
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const secrets = seed();
  return { users: [], apiKeys: [], secrets, nextId: secrets.length + 1 };
}

function saveDb() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const db = loadDb();

/* ---------- helpers ---------- */

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function checkPassword(user, password) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"));
}

function findUser(username, password) {
  if (typeof username !== "string" || typeof password !== "string") return null;
  const user = db.users.find((u) => u.username === username);
  return user && checkPassword(user, password) ? user : null;
}

function parseScore(value) {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
}

/* ---------- auth middleware ---------- */

function basicAuth(req, res, next) {
  const [scheme, encoded] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.set("WWW-Authenticate", 'Basic realm="Secrets API"');
    return res.status(401).json({ error: "Basic authentication is required." });
  }
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const i = decoded.indexOf(":");
  const user = findUser(decoded.slice(0, i), decoded.slice(i + 1));
  if (i < 0 || !user) return res.status(401).json({ error: "Invalid username or password." });
  req.user = user;
  next();
}

function apiKeyAuth(req, res, next) {
  const { apiKey } = req.query;
  if (!apiKey) return res.status(401).json({ error: "API key is required. Pass it as ?apiKey=..." });
  if (!db.apiKeys.includes(apiKey)) return res.status(401).json({ error: "Invalid API key." });
  next();
}

function bearerAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Bearer token authentication is required." });
  }
  const user = db.users.find((u) => u.token === token);
  if (!user) return res.status(401).json({ error: "Invalid token." });
  req.user = user;
  next();
}

// Loads the secret named in the URL; with ownerOnly, only its author may continue.
function loadSecret(ownerOnly) {
  return (req, res, next) => {
    const secret = db.secrets.find((s) => s.id === req.params.id);
    if (!secret) return res.status(404).json({ error: `Secret with ID ${req.params.id} not found.` });
    if (ownerOnly && secret.username !== req.user.username) {
      return res.status(403).json({ error: "You can only change your own secrets." });
    }
    req.secret = secret;
    next();
  };
}

/* ---------- app ---------- */

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "docs.html")));

/* --- accounts and credentials --- */

app.post("/register", (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    return res.status(400).json({ error: "username and password are required." });
  }
  if (db.users.some((u) => u.username === username)) {
    return res.status(409).json({ error: "Username is already taken." });
  }
  db.users.push({ username, ...hashPassword(password), token: null });
  saveDb();
  res.status(201).json({ success: "Successfully registered." });
});

app.get("/generate-api-key", (req, res) => {
  const apiKey = crypto.randomUUID();
  db.apiKeys.push(apiKey);
  saveDb();
  res.json({ apiKey });
});

app.post("/get-auth-token", (req, res) => {
  const { username, password } = req.body || {};
  const user = findUser(username, password);
  if (!user) return res.status(401).json({ error: "Invalid username or password." });
  if (!user.token) {
    user.token = crypto.randomUUID();
    saveDb();
  }
  res.json({ token: user.token });
});

/* --- level 0: no authentication --- */

app.get("/random", (req, res) => {
  if (!db.secrets.length) return res.status(404).json({ error: "No secrets yet." });
  res.json(db.secrets[Math.floor(Math.random() * db.secrets.length)]);
});

/* --- level 1: basic authentication --- */

app.get("/all", basicAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  res.json(db.secrets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
});

/* --- level 2: API key --- */

app.get("/filter", apiKeyAuth, (req, res) => {
  const score = parseScore(req.query.score);
  if (score === null) return res.status(400).json({ error: "score must be a whole number from 0 to 10." });
  res.json(db.secrets.filter((s) => s.emScore >= score));
});

/* --- level 3: bearer token --- */

app.get("/user-secrets", bearerAuth, (req, res) => {
  res.json(db.secrets.filter((s) => s.username === req.user.username));
});

app.get("/secrets/:id", bearerAuth, loadSecret(false), (req, res) => res.json(req.secret));

app.post("/secrets", bearerAuth, (req, res) => {
  const { secret, score } = req.body || {};
  const emScore = parseScore(score);
  if (typeof secret !== "string" || !secret.trim() || emScore === null) {
    return res.status(400).json({ error: "secret (text) and score (0 to 10) are required." });
  }
  const created = {
    id: String(db.nextId++),
    secret,
    emScore,
    username: req.user.username,
    timestamp: new Date().toISOString()
  };
  db.secrets.push(created);
  saveDb();
  res.status(201).json(created);
});

app.put("/secrets/:id", bearerAuth, loadSecret(true), (req, res) => {
  const { secret, score } = req.body || {};
  const emScore = parseScore(score);
  if (typeof secret !== "string" || !secret.trim() || emScore === null) {
    return res.status(400).json({ error: "PUT needs both secret (text) and score (0 to 10)." });
  }
  Object.assign(req.secret, { secret, emScore });
  saveDb();
  res.json(req.secret);
});

app.patch("/secrets/:id", bearerAuth, loadSecret(true), (req, res) => {
  const { secret, score } = req.body || {};
  if (secret === undefined && score === undefined) {
    return res.status(400).json({ error: "Send secret, score, or both." });
  }
  if (secret !== undefined) {
    if (typeof secret !== "string" || !secret.trim()) {
      return res.status(400).json({ error: "secret must be non-empty text." });
    }
    req.secret.secret = secret;
  }
  if (score !== undefined) {
    const emScore = parseScore(score);
    if (emScore === null) return res.status(400).json({ error: "score must be a whole number from 0 to 10." });
    req.secret.emScore = emScore;
  }
  saveDb();
  res.json(req.secret);
});

app.delete("/secrets/:id", bearerAuth, loadSecret(true), (req, res) => {
  db.secrets.splice(db.secrets.indexOf(req.secret), 1);
  saveDb();
  res.json({ message: `Secret with ID ${req.params.id} has been deleted successfully.` });
});

/* --- fallbacks --- */

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Request body is not valid JSON." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => console.log(`Secrets API running at http://localhost:${PORT}`));
