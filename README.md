# Simple Email Service

A simple Express.js service that acts as an email tool for your MCP server. This service allows you to send emails with custom subject and body content, automatically signed off as "Shreyas".

## Features

- Send emails via SMTP
- Automatic signature from "Shreyas"
- HTML and plain text email support
- Input validation
- Health check endpoint
- CORS enabled for cross-origin requests

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
```

### 3. Gmail Setup (if using Gmail)

If you're using Gmail, you'll need to:

1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password in your `SMTP_PASS` environment variable

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

## Usage Examples

### Using curl
```bash
curl -X POST http://localhost:3000/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email",
    "body": "This is a test email from the simple email service."
  }'
```

### Using JavaScript (fetch)
```javascript
const response = await fetch('http://localhost:3000/send-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: 'recipient@example.com',
    subject: 'Test Email',
    body: 'This is a test email from the simple email service.'
  })
});

const result = await response.json();
console.log(result);
```

## Integration with MCP Server

This service is designed to be used as a tool in your MCP server. You can make HTTP requests to the `/send-email` endpoint from your MCP server to send emails.

## Error Handling

The service includes comprehensive error handling:

- Input validation for required fields
- Email format validation
- SMTP connection verification
- Detailed error messages

## Security Notes

- Never commit your `.env` file to version control
- Use app-specific passwords for Gmail
- Consider using environment-specific SMTP configurations
- The service includes CORS for cross-origin requests

## Troubleshooting

### Common Issues

1. **SMTP Authentication Failed**
   - Verify your email and password
   - For Gmail, ensure you're using an App Password, not your regular password
   - Check if 2-factor authentication is enabled

2. **Connection Timeout**
   - Verify your SMTP host and port
   - Check your firewall settings
   - Ensure the SMTP server is accessible

3. **Email Not Delivered**
   - Check spam/junk folders
   - Verify the recipient email address
   - Check SMTP server logs if available

## License

MIT
