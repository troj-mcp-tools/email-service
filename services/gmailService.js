const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Scopes
const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const CAL_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  if (refreshToken) {
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    return oAuth2Client;
  }

  // Fallback to token.json if present (local dev)
  const tokenPath = path.join(process.cwd(), 'token.json');
  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  throw new Error('No Google OAuth credentials found. Set GOOGLE_REFRESH_TOKEN or provide token.json.');
}

function getAuthUrl(scopes) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const scopeList = Array.isArray(scopes) && scopes.length > 0 ? scopes : [...GMAIL_SCOPES, ...CAL_SCOPES];
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopeList
  });
}

async function exchangeCodeForTokens(code) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oAuth2Client.getToken(code);

  // Persist locally for dev convenience if no env refresh token is configured
  const tokenPath = path.join(process.cwd(), 'token.json');
  try {
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), { encoding: 'utf8' });
  } catch {}

  return tokens; // includes refresh_token on first consent with prompt=consent
}

function buildGmailQuery(filters) {
  const terms = [];
  // Search across all mail, not just inbox
  terms.push('in:anywhere');

  if (filters.fromEmail) {
    terms.push(`from:${JSON.stringify(filters.fromEmail)}`);
  }
  if (filters.fromName) {
    // Name is not reliable in headers; include as free text
    terms.push(`${JSON.stringify(filters.fromName)}`);
  }
  if (filters.subjectContains) {
    terms.push(`subject:${JSON.stringify(filters.subjectContains)}`);
  }
  if (filters.threadContains) {
    // Free text that may match the conversation
    terms.push(`${JSON.stringify(filters.threadContains)}`);
  }
  if (filters.query) {
    terms.push(`${filters.query}`);
  }
  if (filters.after) {
    // Accept ISO date or YYYY/MM/DD; Gmail understands YYYY/MM/DD
    const date = normalizeToGmailDate(filters.after);
    if (date) terms.push(`after:${date}`);
  }
  if (filters.before) {
    const date = normalizeToGmailDate(filters.before);
    if (date) terms.push(`before:${date}`);
  }

  return terms.join(' ');
}

function normalizeToGmailDate(input) {
  try {
    if (/^\d{4}\/(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])$/.test(input)) {
      return input; // already YYYY/MM/DD
    }
    const d = new Date(input);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}/${m}/${day}`;
    }
  } catch {}
  return null;
}

function decodeBase64UrlSafe(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function extractBodyFromMessage(payload) {
  // Prefer plain text; fallback to HTML stripped
  const parts = [];

  function walk(node) {
    if (!node) return;
    if (node.body && node.body.data && node.mimeType && node.mimeType.startsWith('text/')) {
      parts.push({ mimeType: node.mimeType, data: decodeBase64UrlSafe(node.body.data) });
    }
    if (Array.isArray(node.parts)) {
      node.parts.forEach(walk);
    }
  }

  walk(payload);

  const textPart = parts.find(p => p.mimeType === 'text/plain');
  if (textPart) return textPart.data;

  const htmlPart = parts.find(p => p.mimeType === 'text/html');
  if (htmlPart) {
    // Basic HTML to text fallback
    return htmlPart.data.replace(/<br\s*\/?>(\n)?/gi, '\n').replace(/<[^>]+>/g, '').trim();
  }

  return '';
}

async function searchEmails(filters = {}, requestId = 'unknown') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${requestId}] GmailService: Building query from filters`);
  const oAuth2Client = createOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  const q = buildGmailQuery(filters);
  const maxResults = Math.min(Number(filters.maxResults) || 5, 25);

  console.log(`[${timestamp}] [${requestId}] GmailService: Query => ${q}`);

  const listResp = await gmail.users.messages.list({
    userId: 'me',
    q,
    maxResults
  });

  const messages = listResp.data.messages || [];
  if (messages.length === 0) {
    return { query: q, total: 0, emails: [] };
  }

  const detailed = await Promise.all(
    messages.map(async (m) => {
      const full = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' });
      const payload = full.data.payload || {};
      const headers = payload.headers || [];

      const header = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const bodyText = filters.includeBody ? extractBodyFromMessage(payload) : undefined;

      return {
        id: full.data.id,
        threadId: full.data.threadId,
        snippet: full.data.snippet || '',
        from: header('From'),
        to: header('To'),
        subject: header('Subject'),
        date: header('Date'),
        body: bodyText
      };
    })
  );

  return { query: q, total: detailed.length, emails: detailed };
}

module.exports = {
  searchEmails,
  getAuthUrl,
  exchangeCodeForTokens,
  GMAIL_SCOPES,
  CAL_SCOPES
};
