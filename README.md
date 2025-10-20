# Simple Email Service

A simple Express.js service that acts as an email tool for your MCP server. This service allows you to send emails with custom subject and body content, automatically signed off as "Shreyas".

## Features

- Send emails via SMTP
- Automatic signature from "Shreyas"
- HTML and plain text email support
- Input validation
- Health check endpoint
- CORS enabled for cross-origin requests
- Read emails from Gmail via filters (sender, subject, free-text, date range)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure your SMTP settings:

```bash
cp env.example .env
```

Edit the `.env` file with your SMTP configuration:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Server Configuration
PORT=3000

# Google OAuth2 for Gmail (reading)
# Recommended: use a refresh token acquired via OAuth consent
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2/callback
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

### 3. Gmail Setup (if using Gmail)

If you're using Gmail for sending, you'll need to:

1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password in your `SMTP_PASS` environment variable

For reading Gmail via API:

1. Create a Google Cloud project and enable the Gmail API
2. Create OAuth 2.0 Client (type: Web or Desktop)
3. Obtain `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
4. Get a `GOOGLE_REFRESH_TOKEN` (via an OAuth consent flow) and set it in `.env`

#### OAuth Flow (to mint a refresh token)
1. Start the server, then open:
   - `GET http://localhost:3000/oauth2/init` → copy the `url`
2. Visit the URL, consent with the Gmail account you want to read
3. You’ll be redirected to `GOOGLE_REDIRECT_URI` with `?code=...`
4. Call `GET http://localhost:3000/oauth2/callback?code=...`
5. Response includes tokens (access redacted) and writes `token.json` locally for dev. Copy `refresh_token` into `.env` as `GOOGLE_REFRESH_TOKEN`.

### 4. Start the Service

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The service will start on `http://localhost:3000` (or the port specified in your `.env` file).

## API Endpoints

### Health Check
```
GET /health
```

Returns the service status.

### Send Email
```
POST /send-email
```

**Request Body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Your email subject",
  "body": "Your email body content"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "message-id-from-smtp"
}
```

### Read Emails (Gmail)
```
POST /read-email
```

Searches your Gmail mailbox using simple filters and returns recent matching emails.

**Request Body (filters):**
```json
{
  "fromEmail": "sender@example.com",
  "fromName": "Shubha SV",
  "subjectContains": "MCP server",
  "threadContains": "MCP server",
  "after": "2025-10-01",
  "before": "2025-10-20",
  "maxResults": 5,
  "includeBody": true
}
```
- `fromEmail`: exact email address filter
- `fromName`: free-text term (helps match sender display name)
- `subjectContains`: matches subject terms
- `threadContains`: free-text search across conversation
- `after`/`before`: ISO date or `YYYY/MM/DD`
- `maxResults`: capped at 25
- `includeBody`: if true, tries to extract text body (slower)

**Response:**
```json
{
  "success": true,
  "query": "in:anywhere from:\"sender@example.com\" subject:\"MCP server\" MCP server after:2025/10/01 before:2025/10/20",
  "total": 2,
  "emails": [
    {
      "id": "185c...",
      "threadId": "185c...",
      "snippet": "...",
      "from": "Shubha SV <shubha@example.com>",
      "to": "you@example.com",
      "subject": "Re: MCP server thread",
      "date": "Mon, 20 Oct 2025 10:12:00 +0000",
      "body": "Full text if includeBody=true"
    }
  ]
}
```

## Integration with MCP Server

This service is designed to be used as tools in your MCP server. Besides sending, you can call `/read-email` to fetch messages for contextual actions (e.g., read "email from Shubha about MCP server").

## Error Handling

The service includes comprehensive error handling:

- Input validation for required fields
- Email format validation
- SMTP connection verification
- Detailed error messages

## Security Notes

- Never commit your `.env` file to version control
- Use app-specific passwords for Gmail
- Use least-privileged OAuth scopes; this uses `gmail.readonly`
- `.gitignore` includes token artifacts (`token.json`, `tokens/`)
- The service includes CORS for cross-origin requests

## Troubleshooting

### Common Issues

1. **OAuth missing/invalid**
   - Ensure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` are set
   - Refresh tokens can be revoked; re-consent if needed

2. **No results**
   - Loosen filters or omit `before/after`
   - Try without `fromName` and rely on `fromEmail`

3. **Body missing**
   - Some emails only have HTML; set `includeBody=true` to attempt extraction

## License

MIT
