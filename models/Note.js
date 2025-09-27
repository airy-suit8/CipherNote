const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  content: { type: String, trim: true },
  tags: [{ type: String, trim: true }],
  pinned: { type: Boolean, default: false },
}, { timestamps: true });

// text index for search (title & content)
noteSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Note', noteSchema);
