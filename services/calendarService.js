const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

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

  const tokenPath = path.join(process.cwd(), 'token.json');
  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  throw new Error('No Google OAuth credentials found. Set GOOGLE_REFRESH_TOKEN or provide token.json.');
}

function toRfc3339(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return d.toISOString();
}

async function listEvents(params = {}, requestId = 'unknown') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${requestId}] CalendarService: Listing events`);

  const {
    timeMin, // ISO string or Date
    timeMax, // ISO string or Date
    maxResults = 10,
    singleEvents = true,
    orderBy = 'startTime',
    q, // search query
    calendarId = 'primary'
  } = params;

  const auth = createOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const listParams = {
    calendarId,
    maxResults: Math.min(maxResults, 250),
    singleEvents,
    orderBy
  };

  if (timeMin) {
    listParams.timeMin = toRfc3339(timeMin);
  }
  if (timeMax) {
    listParams.timeMax = toRfc3339(timeMax);
  }
  if (q) {
    listParams.q = q;
  }

  const response = await calendar.events.list(listParams);
  const events = response.data.items || [];

  const formattedEvents = events.map(event => ({
    id: event.id,
    summary: event.summary || 'No title',
    description: event.description || '',
    start: event.start,
    end: event.end,
    location: event.location || '',
    attendees: (event.attendees || []).map(att => ({
      email: att.email,
      displayName: att.displayName || '',
      responseStatus: att.responseStatus || 'needsAction'
    })),
    organizer: event.organizer ? {
      email: event.organizer.email,
      displayName: event.organizer.displayName || ''
    } : null,
    status: event.status,
    htmlLink: event.htmlLink,
    meetLink: event.hangoutLink || (event.conferenceData && event.conferenceData.entryPoints && 
      event.conferenceData.entryPoints.find(e => e.entryPointType === 'video')?.uri) || null,
    created: event.created,
    updated: event.updated
  }));

  return {
    total: formattedEvents.length,
    events: formattedEvents,
    timeZone: response.data.timeZone
  };
}

async function createMeetEvent(params = {}, requestId = 'unknown') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${requestId}] CalendarService: Creating event`);

  const {
    title,
    description,
    start,
    end,
    timeZone = 'UTC',
    attendees = [], // array of emails
    sendUpdates = 'all', // none | externalOnly | all
    reminders // optional { useDefault: boolean, overrides: [{ method, minutes }] }
  } = params;

  if (!title || !start || !end) {
    throw new Error('Missing required fields: title, start, end');
  }

  const auth = createOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: title,
    description: description || '',
    start: { dateTime: toRfc3339(start), timeZone },
    end: { dateTime: toRfc3339(end), timeZone },
    attendees: attendees.filter(Boolean).map(email => ({ email })),
    reminders: reminders || { useDefault: true },
    conferenceData: {
      createRequest: {
        requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  };

  const created = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: 1,
    sendUpdates
  });

  const data = created.data || {};
  const meetLink = data.hangoutLink || (data.conferenceData && data.conferenceData.entryPoints && data.conferenceData.entryPoints.find(e => e.entryPointType === 'video')?.uri) || null;

  return {
    id: data.id,
    htmlLink: data.htmlLink,
    status: data.status,
    meetLink,
    start: data.start,
    end: data.end,
    attendees: data.attendees || []
  };
}

module.exports = {
  listEvents,
  createMeetEvent,
  CALENDAR_SCOPES
};
