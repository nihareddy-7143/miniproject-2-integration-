// File: server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/culturefund', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'));

// Schema
const campaignSchema = new mongoose.Schema({
  name: String,
  artform: String,
  place: String,
  amount: Number,
  amountRaised: { type: Number, default: 0 },
  donors: { type: Number, default: 0 },
  duration: Number,
  about: String,
  overview: String,
  video: String,
  qrCode: String,
  photo:String,
  email: String,
  phone: String
}, { timestamps: true });

const Campaign = mongoose.model('Campaign', campaignSchema);

// File Upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Routes
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

app.get('/api/campaigns/stats', async (req, res) => {
  try {
    const totalCampaigns = await Campaign.countDocuments();
    const all = await Campaign.find();
    const totalRaised = all.reduce((sum, c) => sum + c.amountRaised, 0);
    const totalDonors = all.reduce((sum, c) => sum + c.donors, 0);
    const successful = all.filter(c => c.amountRaised >= c.amount).length;
    const successRate = totalCampaigns ? Math.floor((successful / totalCampaigns) * 100) : 0;
    res.json({ totalCampaigns, totalRaised, totalDonors, successRate });
  } catch (err) {
    res.status(500).json({ error: 'Stats fetch failed' });
  }
});

app.post('/api/campaigns/register', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'qrCode', maxCount: 1 },
   { name: 'photo', maxCount: 1 } 
]), async (req, res) => {
  try {
    const files = req.files;
    const video = files.video ? files.video[0].filename : '';
    const qrCode = files.qrCode ? files.qrCode[0].filename : '';
    const photo = files.photo ? files.photo[0].filename : '';
    const data = req.body;
    const newCampaign = new Campaign({
      ...data,
      amount: parseInt(data.amount),
      duration: parseInt(data.duration),
      video,
      qrCode,
      photo 
    });
    await newCampaign.save();
    res.json({ success: true, campaign: newCampaign });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/campaigns/donate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    campaign.amountRaised += parseInt(amount);
    campaign.donors += 1;
    await campaign.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Donation failed' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
