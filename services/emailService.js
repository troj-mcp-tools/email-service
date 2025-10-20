const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Check if environment variables are set
      console.log('SMTP Configuration:');
      console.log('Host:', process.env.SMTP_HOST || 'NOT SET');
      console.log('Port:', process.env.SMTP_PORT || 'NOT SET');
      console.log('User:', process.env.SMTP_USER || 'NOT SET');
      console.log('Pass:', process.env.SMTP_PASS ? '***SET***' : 'NOT SET');

      this.transporter = nodemailer.createTransport({
        service: 'gmail', // Use Gmail service instead of manual config
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 15000,   // 15 seconds
        socketTimeout: 30000      // 30 seconds
      });

      console.log('Email transporter initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
      throw error;
    }
  }

  async sendEmail(to, subject, body, requestId = 'unknown') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${requestId}] EmailService: Starting email send process`);
    console.log(`[${timestamp}] [${requestId}] EmailService: To: ${to}, Subject: ${subject}`);
    
    if (!this.transporter) {
      console.error(`[${timestamp}] [${requestId}] EmailService: Transporter not initialized`);
      throw new Error('Email transporter not initialized');
    }

    // Validate SMTP configuration
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error(`[${timestamp}] [${requestId}] EmailService: SMTP configuration incomplete`);
      throw new Error('SMTP configuration is incomplete. Please check your environment variables.');
    }

    const mailOptions = {
      from: {
        name: 'Shreyas',
        address: process.env.SMTP_USER
      },
      to: to,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            ${body.replace(/\n/g, '<br>')}
          </div>
          <div style="margin-top: 20px; padding: 15px; border-top: 1px solid #dee2e6;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
              Best regards,<br>
              <strong>Shreyas</strong>
            </p>
          </div>
        </div>
      `,
      text: `${body}\n\nBest regards,\nShreyas`
    };

    try {
      console.log(`[${timestamp}] [${requestId}] EmailService: Verifying SMTP connection...`);
      // Verify connection configuration
      await this.transporter.verify();
      console.log(`[${timestamp}] [${requestId}] EmailService: SMTP connection verified successfully`);
      
      console.log(`[${timestamp}] [${requestId}] EmailService: Sending email...`);
      // Send email
      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`[${timestamp}] [${requestId}] EmailService: Email sent successfully - MessageID: ${result.messageId}`);
      console.log(`[${timestamp}] [${requestId}] EmailService: Response:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error(`[${timestamp}] [${requestId}] EmailService: Error sending email:`, error.message);
      console.error(`[${timestamp}] [${requestId}] EmailService: Full error:`, error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async testConnection(requestId = 'unknown') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${requestId}] EmailService: Testing SMTP connection...`);
    
    if (!this.transporter) {
      console.error(`[${timestamp}] [${requestId}] EmailService: Transporter not initialized`);
      throw new Error('Email transporter not initialized');
    }

    try {
      await this.transporter.verify();
      console.log(`[${timestamp}] [${requestId}] EmailService: SMTP connection verified successfully`);
      return true;
    } catch (error) {
      console.error(`[${timestamp}] [${requestId}] EmailService: SMTP connection failed:`, error.message);
      console.error(`[${timestamp}] [${requestId}] EmailService: Full error:`, error);
      throw error;
    }
  }
}

module.exports = new EmailService();
