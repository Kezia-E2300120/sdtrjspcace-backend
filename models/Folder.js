const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
}, { timestamps: true });

const folderSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teacherName: String,
  folderType: {
    type: String,
    enum: ['material', 'administration', 'event', 'other'],
    required: true
  },
  files: [fileSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Folder', folderSchema);