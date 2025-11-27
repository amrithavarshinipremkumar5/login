const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: 'smtp.mailersend.net',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: 'MS_RqAaC8@test-p7kx4xwo7v8g9yjr.mlsender.net',
    pass: 'PASTE_LATEST_PASSWORD_HERE'
  }
});
t.verify().then(()=>console.log('OK')).catch(e=>console.error('FAIL', e.message));
