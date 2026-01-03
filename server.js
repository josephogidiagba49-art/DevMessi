const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({limit: '10mb'}));
app.use(express.static('public'));

let state = {
  step: 1, emails: [], smtpPool: [], stats: { obliterated: 0, total: 0, bounced: 0 },
  providersActive: 5, leadsParsed: 0, campaigns: 0, currentTemplate: '',
  emailsRemaining: 0, isRunning: false, phishingLink: '', customHtml: ''
};

try { state = JSON.parse(fs.readFileSync('state.json')); } catch(e) {}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.get('/api/stats', (req, res) => res.json(state));

app.post('/api/stop', (req, res) => {
  state.isRunning = false;
  saveState();
  res.json({success: true, message: '🚨 CAMPAIGN STOPPED'});
});

app.post('/api/step1', (req, res) => {
  state.emails = req.body.emails.split('\n').map(e=>e.trim()).filter(Boolean);
  state.leadsParsed = state.emails.length;
  state.step = 2;
  saveState();
  res.json({success: true});
});

app.post('/api/step2', (req, res) => {
  state.step = 3;
  state.stats.total = state.emails.length;
  state.emailsRemaining = state.emails.length;
  saveState();
  res.json({success: true});
});

app.post('/api/blast', async (req, res) => {
  if (state.isRunning) return res.json({error: 'Already running!'});
  
  const { template, customHtml, phishingLink } = req.body;
  state.currentTemplate = template;
  state.customHtml = customHtml || '';
  state.phishingLink = phishingLink || '';
  state.isRunning = true;
  state.campaigns++;
  saveState();
  
  // BLAST LOOP
  for(let i = 0; i < state.emails.length && state.isRunning; i++) {
    const email = state.emails[i];
    await new Promise(r => setTimeout(r, 800)); // 0.8s per email
    
    state.stats.obliterated++;
    state.emailsRemaining--;
    saveState();
    
    if (Math.random() < 0.07) state.stats.bounced++;
  }
  
  state.isRunning = false;
  saveState();
  res.json({success: true});
});

app.get('/api/templates/:name', (req, res) => {
  const templates = {
    'bank-alert': '<h1>🚨 BANK ALERT - ACTION REQUIRED</h1><p>Unusual activity detected</p><a href="{{PHISHING_LINK}}" style="background:red;color:white;padding:15px;text-decoration:none;">SECURE YOUR ACCOUNT →</a>',
    'verification': '<h1>✅ ACCOUNT VERIFICATION</h1><p>Verify email within 2 hours:</p><a href="{{PHISHING_LINK}}" style="background:#007bff;color:white;padding:15px;">VERIFY NOW</a>',
    'password-reset': '<h1>🔑 PASSWORD RESET REQUESTED</h1><p>Click to reset password:</p><a href="{{PHISHING_LINK}}" style="background:#28a745;color:white;padding:15px;">RESET PASSWORD</a>',
    'invoice': '<h1>💰 INVOICE #8921 - URGENT</h1><p>Payment due immediately:</p><a href="{{PHISHING_LINK}}" style="background:#ffc107;color:black;padding:15px;font-weight:bold;">PAY $2,847 →</a>'
  };
  
  let html = templates[req.params.name] || '<h1>YOUR CUSTOM TEMPLATE</h1>';
  if (state.phishingLink) html = html.replace('{{PHISHING_LINK}}', state.phishingLink);
  
  res.json({html});
});

function saveState() {
  fs.writeFileSync('state.json', JSON.stringify(state, null, 2));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎯 MagicSender v5.3 + STOP + LINKS LIVE on ${PORT}`));
