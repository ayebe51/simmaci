import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configure Gmail SMTP
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // e.g., your-email@gmail.com
        pass: process.env.EMAIL_PASSWORD, // App password from Google
      },
    });
  }

  /**
   * Send email notification
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: `"SIM Maarif NU Cilacap" <${process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      console.log('Email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send SK approval notification to approver
   */
  async sendSKApprovalNotification(
    approverEmail: string,
    approverName: string,
    skData: {
      number: string;
      type: string;
      teacherName: string;
      submittedBy: string;
    },
  ): Promise<boolean> {
    const subject = `Persetujuan SK ${skData.type} - ${skData.number}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
          }
          .header {
            background-color: #22c55e;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            padding: 20px;
            background-color: #f9f9f9;
          }
          .detail-row {
            margin: 10px 0;
            padding: 10px;
            background-color: white;
            border-left: 3px solid #22c55e;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            margin: 20px 0;
            background-color: #22c55e;
            color: white;
            text-decoration: none;
            border-radius: 4px;
          }
          .footer {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🔔 Persetujuan SK Diperlukan</h2>
          </div>
          <div class="content">
            <p>Yth. <strong>${approverName}</strong>,</p>
            <p>Terdapat Surat Keputusan yang memerlukan persetujuan Anda:</p>
            
            <div class="detail-row">
              <strong>Nomor SK:</strong> ${skData.number}
            </div>
            <div class="detail-row">
              <strong>Jenis SK:</strong> ${skData.type}
            </div>
            <div class="detail-row">
              <strong>Nama Guru:</strong> ${skData.teacherName}
            </div>
            <div class="detail-row">
              <strong>Diajukan oleh:</strong> ${skData.submittedBy}
            </div>
            
            <p>Silakan login ke sistem untuk meninjau dan menyetujui SK ini:</p>
            
            <center>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/sk" class="button">
                Buka Sistem
              </a>
            </center>
            
            <p style="margin-top: 20px; color: #666;">
              <em>Email ini dikirim otomatis oleh sistem. Mohon tidak membalas email ini.</em>
            </p>
          </div>
          <div class="footer">
            <p>SIM Maarif NU Cilacap</p>
            <p>PC Lembaga Pendidikan Ma'arif NU Kabupaten Cilacap</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: approverEmail,
      subject,
      html,
    });
  }

  /**
   * Send SK approval/rejection confirmation to submitter
   */
  async sendSKStatusNotification(
    submitterEmail: string,
    submitterName: string,
    skData: {
      number: string;
      type: string;
      status: 'approved' | 'rejected';
      approverName: string;
      notes?: string;
    },
  ): Promise<boolean> {
    const isApproved = skData.status === 'approved';
    const subject = `SK ${skData.number} ${isApproved ? 'Disetujui' : 'Ditolak'}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
          }
          .header {
            background-color: ${isApproved ? '#22c55e' : '#ef4444'};
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            padding: 20px;
            background-color: #f9f9f9;
          }
          .detail-row {
            margin: 10px 0;
            padding: 10px;
            background-color: white;
            border-left: 3px solid ${isApproved ? '#22c55e' : '#ef4444'};
          }
          .notes-box {
            background-color: #fff3cd;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            margin: 20px 0;
            background-color: ${isApproved ? '#22c55e' : '#ef4444'};
            color: white;
            text-decoration: none;
            border-radius: 4px;
          }
          .footer {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${isApproved ? '✅ SK Disetujui' : '❌ SK Ditolak'}</h2>
          </div>
          <div class="content">
            <p>Yth. <strong>${submitterName}</strong>,</p>
            <p>
              Surat Keputusan yang Anda ajukan telah 
              <strong>${isApproved ? 'disetujui' : 'ditolak'}</strong>:
            </p>
            
            <div class="detail-row">
              <strong>Nomor SK:</strong> ${skData.number}
            </div>
            <div class="detail-row">
              <strong>Jenis SK:</strong> ${skData.type}
            </div>
            <div class="detail-row">
              <strong>Disetujui/Ditolak oleh:</strong> ${skData.approverName}
            </div>
            
            ${
              skData.notes
                ? `
            <div class="notes-box">
              <strong>Catatan:</strong><br/>
              ${skData.notes}
            </div>
            `
                : ''
            }
            
            <center>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/sk" class="button">
                Lihat Detail SK
              </a>
            </center>
            
            <p style="margin-top: 20px; color: #666;">
              <em>Email ini dikirim otomatis oleh sistem. Mohon tidak membalas email ini.</em>
            </p>
          </div>
          <div class="footer">
            <p>SIM Maarif NU Cilacap</p>
            <p>PC Lembaga Pendidikan Ma'arif NU Kabupaten Cilacap</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: submitterEmail,
      subject,
      html,
    });
  }
}
