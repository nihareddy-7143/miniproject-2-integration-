const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  title: { type: String, default: 'New Chat' }
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
