// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const emailService = require('./services/emailService');
const gmailService = require('./services/gmailService');
const calendarService = require('./services/calendarService');

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substr(2, 9);
  req.requestId = requestId;
  
  console.log(`[${timestamp}] [${requestId}] ${req.method} ${req.path}`);
  console.log(`[${timestamp}] [${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
  
  if (req.body && Object.keys(req.body).length > 0) {
    // Mask sensitive data in logs
    const logBody = { ...req.body };
    if (logBody.to) {
      // Keep email for debugging but could mask if needed
      console.log(`[${timestamp}] [${requestId}] Body:`, JSON.stringify(logBody, null, 2));
    }
  }
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - req.startTime;
    console.log(`[${new Date().toISOString()}] [${requestId}] Response: ${res.statusCode} (${responseTime}ms)`);
    if (data) {
      try {
        const responseData = JSON.parse(data);
        console.log(`[${new Date().toISOString()}] [${requestId}] Response Body:`, JSON.stringify(responseData, null, 2));
      } catch (e) {
        console.log(`[${new Date().toISOString()}] [${requestId}] Response Body:`, data);
      }
    }
    originalSend.call(this, data);
  };
  
  req.startTime = Date.now();
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Email service is running' });
});

// OAuth initiation (get consent URL)
app.get('/oauth2/init', (req, res) => {
  try {
    // Optional: ?scope=gmail|calendar|both
    const scopeParam = (req.query.scope || 'both').toString();
    let scopes;
    if (scopeParam === 'gmail') scopes = gmailService.GMAIL_SCOPES;
    else if (scopeParam === 'calendar') scopes = gmailService.CAL_SCOPES;
    const url = gmailService.getAuthUrl(scopes);
    res.json({ success: true, url });
  } catch (error) {
    res.status(400).json({ error: 'OAuth init failed', message: error.message });
  }
});

// OAuth callback: exchange ?code= for tokens
app.get('/oauth2/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ error: 'Missing code parameter' });
    }
    const tokens = await gmailService.exchangeCodeForTokens(code);
    // Show a safe message; tokens are also written to token.json for local dev
    res.json({ success: true, tokens: { ...tokens, access_token: 'redacted', id_token: 'redacted' } });
  } catch (error) {
    res.status(500).json({ error: 'OAuth exchange failed', message: error.message });
  }
});

// Test SMTP connection endpoint
app.get('/test-smtp', async (req, res) => {
  try {
    await emailService.testConnection(req.requestId);
    res.json({ 
      success: true, 
      message: 'SMTP connection test successful' 
    });
  } catch (error) {
    console.error(`[${req.requestId}] SMTP test failed:`, error);
    res.status(500).json({
      error: 'SMTP connection test failed',
      message: error.message
    });
  }
});

// Email endpoint
app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    // Validate required fields
    if (!to || !subject || !body) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'subject', 'body']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        error: 'Invalid email address format'
      });
    }

    // Send email
    const result = await emailService.sendEmail(to, subject, body, req.requestId);
    
    res.json({
      success: true,
      message: 'Email sent successfully',
      messageId: result.messageId
    });

  } catch (error) {
    console.error(`[${req.requestId}] Error sending email:`, error);
    res.status(500).json({
      error: 'Failed to send email',
      message: error.message
    });
  }
});

// Read email endpoint
app.post('/read-email', async (req, res) => {
  try {
    const filters = req.body || {};

    const result = await gmailService.searchEmails(filters, req.requestId);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error(`[${req.requestId}] Error reading emails:`, error);
    res.status(500).json({
      error: 'Failed to read emails',
      message: error.message
    });
  }
});

// Schedule Google Meet (Calendar event)
app.post('/schedule-meet', async (req, res) => {
  try {
    const params = req.body || {};
    const result = await calendarService.createMeetEvent(params, req.requestId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(`[${req.requestId}] Error scheduling meet:`, error);
    res.status(500).json({
      error: 'Failed to schedule meet',
      message: error.message
    });
  }
});

// List Calendar events
app.post('/list-events', async (req, res) => {
  try {
    const params = req.body || {};
    const result = await calendarService.listEvents(params, req.requestId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(`[${req.requestId}] Error listing events:`, error);
    res.status(500).json({
      error: 'Failed to list events',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /oauth2/init',
      'GET /oauth2/callback?code=...',
      'POST /send-email',
      'POST /read-email',
      'POST /schedule-meet',
      'POST /list-events'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Email service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`OAuth init:  GET http://localhost:${PORT}/oauth2/init`);
  console.log(`OAuth cb:    GET http://localhost:${PORT}/oauth2/callback?code=...`);
  console.log(`Send email:  POST http://localhost:${PORT}/send-email`);
  console.log(`Read email:  POST http://localhost:${PORT}/read-email`);
  console.log(`Schedule meet: POST http://localhost:${PORT}/schedule-meet`);
  console.log(`List events: POST http://localhost:${PORT}/list-events`);
});
