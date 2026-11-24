const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
  next();
});

// ---------- In-memory data ----------
let students = [
  { id: 201, rollNumber: 'CSE2401', name: 'Aarav Sharma', branch: 'CSE', semester: 3, email: 'aarav@example.com' },
  { id: 202, rollNumber: 'ECE2402', name: 'Diya Verma',   branch: 'ECE', semester: 3, email: 'diya@example.com' },
  { id: 203, rollNumber: 'CSE2403', name: 'Kabir Singh',  branch: 'CSE', semester: 3, email: 'kabir@example.com' },
];
let nextId = Math.max(...students.map((s) => s.id)) + 1;

// ---------- Helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// Returns { errors: [...], data: {...clean record without id} }
function validateStudent(body) {
  const errors = [];

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object'], data: null };
  }

  const { rollNumber, name, branch, semester, email } = body;

  if (!isNonEmptyString(rollNumber)) errors.push('rollNumber is required and must be a non-empty string');
  if (!isNonEmptyString(name)) errors.push('name is required and must be a non-empty string');
  if (!isNonEmptyString(branch)) errors.push('branch is required and must be a non-empty string');
  if (typeof semester !== 'number' || !Number.isInteger(semester) || semester < 1 || semester > 8) {
    errors.push('semester is required and must be an integer between 1 and 8');
  }
  if (!isNonEmptyString(email) || !EMAIL_RE.test(email.trim())) {
    errors.push('email is required and must be a valid email address');
  }

  if (errors.length) return { errors, data: null };

  return {
    errors,
    data: {
      rollNumber: rollNumber.trim(),
      name: name.trim(),
      branch: branch.trim(),
      semester,
      email: email.trim(),
    },
  };
}

const findIndexById = (idParam) => {
  const id = Number(idParam);
  if (!Number.isInteger(id)) return -1;
  return students.findIndex((s) => s.id === id);
};

const rollExists = (rollNumber, ignoreId = null) =>
  students.some(
    (s) => s.rollNumber.toLowerCase() === rollNumber.toLowerCase() && s.id !== ignoreId
  );

// ---------- Routes ----------

// 1. GET all students
app.get('/api/students', (req, res) => {
  res.status(200).json(students);
});

// 6. Filter by branch (case-insensitive)
// NOTE: must be declared BEFORE /api/students/:id
app.get('/api/students/filter', (req, res) => {
  const { branch } = req.query;
  if (!isNonEmptyString(branch)) {
    return res.status(400).json({ error: 'branch query parameter is required, e.g. /api/students/filter?branch=CSE' });
  }
  const result = students.filter((s) => s.branch.toLowerCase() === branch.trim().toLowerCase());
  res.status(200).json(result); // empty array with 200 if nothing matches
});

// 3. GET student by id
app.get('/api/students/:id', (req, res) => {
  const index = findIndexById(req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: `Student with id ${req.params.id} not found` });
  }
  res.status(200).json(students[index]);
});

// 2. POST a new student
app.post('/api/students', (req, res) => {
  const { errors, data } = validateStudent(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  if (rollExists(data.rollNumber)) {
    return res.status(409).json({ error: `rollNumber ${data.rollNumber} already exists` });
  }

  const student = { id: nextId++, ...data };
  students.push(student);
  res.status(201).json(student);
});

// 4. PUT (update) a student
app.put('/api/students/:id', (req, res) => {
  const index = findIndexById(req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: `Student with id ${req.params.id} not found` });
  }

  const { errors, data } = validateStudent(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  if (rollExists(data.rollNumber, students[index].id)) {
    return res.status(409).json({ error: `rollNumber ${data.rollNumber} already exists` });
  }

  students[index] = { id: students[index].id, ...data };
  res.status(200).json(students[index]);
});

// 5. DELETE a student
app.delete('/api/students/:id', (req, res) => {
  const index = findIndexById(req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: `Student with id ${req.params.id} not found` });
  }
  const [removed] = students.splice(index, 1);
  res.status(200).json({ message: `Student ${removed.name} (id ${removed.id}) deleted successfully` });
});

// ---------- Error handling ----------

// Unknown route
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Malformed JSON and other errors
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Student Management API running on http://localhost:${PORT}`);
});
