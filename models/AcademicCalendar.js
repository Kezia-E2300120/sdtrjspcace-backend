const mongoose = require('mongoose');

const academicCalendarSchema = new mongoose.Schema({
  image: {
    fileName: String,
    filePath: String,
    fileSize: Number,
    mimeType: String
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AcademicCalendar', academicCalendarSchema);