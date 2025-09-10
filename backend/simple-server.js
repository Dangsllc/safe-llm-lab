// Simple Express server for Safe LLM Lab backend
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Safe LLM Lab Backend is running' });
});

// Auth routes (placeholder)
app.post('/api/auth/login', (req, res) => {
  res.json({ success: true, message: 'Login endpoint (placeholder)' });
});

app.post('/api/auth/register', (req, res) => {
  res.json({ success: true, message: 'Register endpoint (placeholder)' });
});

// Studies routes (placeholder)
app.get('/api/studies', (req, res) => {
  res.json({ success: true, data: [] });
});

app.post('/api/studies', (req, res) => {
  res.json({ success: true, data: { id: 'temp-study-id' } });
});

// Sessions routes (placeholder)
app.get('/api/sessions', (req, res) => {
  res.json({ success: true, data: [] });
});

// Templates routes (placeholder)
app.get('/api/templates', (req, res) => {
  res.json({ success: true, data: [] });
});

// Users routes (placeholder)
app.get('/api/users/profile', (req, res) => {
  res.json({ success: true, data: { id: 'temp-user-id' } });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Safe LLM Lab Backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
