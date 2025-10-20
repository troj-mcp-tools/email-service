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
- Create Google Calendar events with Google Meet links

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

# Google OAuth2 for Gmail & Calendar
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2/callback
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

### 3. Gmail/Calendar Setup

- Enable APIs in your Google Cloud project: Gmail API and Google Calendar API
- Create an OAuth 2.0 Client and configure the authorized redirect URI
- Use the OAuth Flow below to mint a refresh token

#### OAuth Flow (to mint a refresh token)
1. Start the server, then open:
   - `GET http://localhost:3000/oauth2/init?scope=both` (default includes Gmail + Calendar)
2. Visit the URL, consent with the account
3. You’ll be redirected to `GOOGLE_REDIRECT_URI` with `?code=...`
4. Call `GET http://localhost:3000/oauth2/callback?code=...`
5. Copy `refresh_token` into `.env` as `GOOGLE_REFRESH_TOKEN`, restart

### 4. Start the Service

```bash
npm run dev   # development
npm start     # production
```

## API Endpoints

### Health Check
```
GET /health
```

### Send Email
```
POST /send-email
```

### Read Emails (Gmail)
```
POST /read-email
```

### Schedule Google Meet (Calendar)
```
POST /schedule-meet
```
Create a calendar event on the primary calendar with a Meet link.

Request body:
```json
{
  "title": "Design sync",
  "description": "Review MCP server changes",
  "start": "2025-10-21T10:00:00Z",
  "end": "2025-10-21T10:30:00Z",
  "timeZone": "UTC",
  "attendees": ["alice@example.com", "bob@example.com"],
  "sendUpdates": "all",
  "reminders": { "useDefault": true }
}
```

Response (example):
```json
{
  "success": true,
  "id": "eventId",
  "htmlLink": "https://www.google.com/calendar/event?eid=...",
  "status": "confirmed",
  "meetLink": "https://meet.google.com/abc-defg-hij",
  "start": { "dateTime": "2025-10-21T10:00:00Z", "timeZone": "UTC" },
  "end": { "dateTime": "2025-10-21T10:30:00Z", "timeZone": "UTC" },
  "attendees": [ { "email": "alice@example.com" }, { "email": "bob@example.com" } ]
}
```

### List Calendar Events
```
POST /list-events
```
View calendar events with attendees, times, and details.

Request body (filters):
```json
{
  "timeMin": "2025-10-20T00:00:00Z",
  "timeMax": "2025-10-27T23:59:59Z",
  "maxResults": 10,
  "q": "meeting",
  "calendarId": "primary"
}
```

Response (example):
```json
{
  "success": true,
  "total": 2,
  "timeZone": "America/New_York",
  "events": [
    {
      "id": "eventId1",
      "summary": "Design sync",
      "description": "Review MCP server changes",
      "start": { "dateTime": "2025-10-21T10:00:00Z", "timeZone": "UTC" },
      "end": { "dateTime": "2025-10-21T10:30:00Z", "timeZone": "UTC" },
      "location": "",
      "attendees": [
        { "email": "alice@example.com", "displayName": "Alice", "responseStatus": "accepted" },
        { "email": "bob@example.com", "displayName": "Bob", "responseStatus": "needsAction" }
      ],
      "organizer": { "email": "you@example.com", "displayName": "You" },
      "status": "confirmed",
      "htmlLink": "https://www.google.com/calendar/event?eid=...",
      "meetLink": "https://meet.google.com/abc-defg-hij",
      "created": "2025-10-20T15:30:00.000Z",
      "updated": "2025-10-20T15:30:00.000Z"
    }
  ]
}
```

Notes:
- Requires Calendar scope `https://www.googleapis.com/auth/calendar.events` (included by default in `/oauth2/init?scope=both`).
- Meet link is provided via `conferenceData.createRequest`.
- `timeMin`/`timeMax`: ISO date strings for filtering events by time range.
- `q`: free-text search query.
- `maxResults`: capped at 250.

## Security & Troubleshooting
- Keep `.env` out of version control
- If you get 403 accessNotConfigured, enable the API in Google Cloud console
- Ensure the OAuth client and the enabled APIs belong to the same project
