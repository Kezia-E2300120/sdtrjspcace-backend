const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teacherName: String,
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    required: true
  },
  period: {
    type: String,
    enum: ['period1', 'period2', 'period3', 'period4', 'period5', 'period6', 'period7', 'period8', 'period9'],
    required: true
  },
  time: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  class: {
    type: String,
    required: true,
    trim: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate schedules
scheduleSchema.index({ teacherId: 1, day: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Schedule', scheduleSchema);