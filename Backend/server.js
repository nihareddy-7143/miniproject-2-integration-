// File: server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);



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
const Chat = require('./models/Chat');
const Message = require('./models/Message');

// Get all chats
app.get('/api/chats', async (req, res) => {
  try {
    const chats = await Chat.find().sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Create a new chat
app.post('/api/chats', async (req, res) => {
  try {
    const newChat = new Chat({ title: req.body.title || 'New Chat' });
    await newChat.save();
    res.json(newChat);
  } catch (err) {
    res.status(500).json({ error: 'Chat creation failed' });
  }
});

// Delete a chat
app.delete('/api/chats/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Message.deleteMany({ chatId: id });
    await Chat.findByIdAndDelete(id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Get messages of a chat
app.get('/api/chats/:id/messages', async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.id }).sort('timestamp');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message to a chat


const FormData = require('form-data');


app.post('/api/chats/:id/messages', async (req, res) => {
  try {
    const chatId = req.params.id;
    const { message, filePaths = [] } = req.body; // filePaths are server-side file paths (after upload)

    // Save user message
    const userMessage = new Message({
      chatId,
      role: 'user',
      content: message,
      timestamp: new Date()
    });
    await userMessage.save();

    // Build form-data
    const form = new FormData();
    form.append('text', message);

    for (const filePath of filePaths) {
      const absolutePath = path.resolve('uploads', filePath);
      form.append('files', fs.createReadStream(absolutePath));
    }

    // Call FastAPI
    const geminiResponse = await axios.post('http://localhost:8000/feedback/', form, {
      headers: form.getHeaders()
    });

    const aiText = geminiResponse.data.response;

    const aiMessage = new Message({
      chatId,
      role: 'assistant',
      content: aiText,
      timestamp: new Date()
    });
    await aiMessage.save();

    res.json(aiMessage);

  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: 'AI response failed' });
  }
});



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
