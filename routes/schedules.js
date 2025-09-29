const express = require('express');
const { body, validationResult } = require('express-validator');
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const { auth, principalOnly } = require('../middleware/auth');

const router = express.Router();
const { Parser } = require('json2csv');

// Time periods configuration
const TIME_PERIODS = {
  period1: '07:55 - 08:30',
  period2: '08:30 - 09:05',
  period3: '09:05 - 09:40',
  recess1: '09:40 - 10:10',
  period4: '10:10 - 10:45',
  period5: '10:45 - 11:20',
  period6: '11:20 - 11:55',
  recess2: '11:55 - 12:25',
  period7: '12:25 - 13:00',
  period8: '13:00 - 13:35',
  period9: '13:35 - 14:10'
};

// @route   GET /api/schedules
// @desc    Get schedules (filtered by teacher for teachers, all for principal)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let query = { isPublished: true };
    
    // Teachers can only see their own schedules
    if (req.user.role === 'teacher') {
      query.teacherId = req.user.id;
    }

    // Filter by teacherId if provided (for principal)
    if (req.query.teacherId && req.user.role === 'principal') {
      query.teacherId = req.query.teacherId;
    }

    const schedules = await Schedule.find(query)
      .populate('teacherId', 'name nip')
      .sort({ day: 1, period: 1 });

    // Group schedules by day for better frontend consumption
    const groupedSchedules = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: []
    };

    schedules.forEach(schedule => {
      groupedSchedules[schedule.day].push({
        ...schedule.toObject(),
        timeSlot: TIME_PERIODS[schedule.period]
      });
    });

    res.json({
      success: true,
      data: {
        schedules: groupedSchedules,
        timePeriods: TIME_PERIODS
      }
    });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/schedules/teachers
// @desc    Get all teachers for schedule management (Principal only)
// @access  Private (Principal)
router.get('/teachers', [auth, principalOnly], async (req, res) => {
  try {
    const teachers = await User.find({ 
      role: 'teacher', 
      isActive: true 
    }).select('name nip email').sort({ name: 1 });

    res.json({
      success: true,
      data: teachers
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/schedules
// @desc    Add schedule (Principal only)
// @access  Private (Principal)
router.post('/', [auth, principalOnly], [
  body('teacherId', 'Teacher ID is required').not().isEmpty(),
  body('day', 'Day is required').isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
  body('period', 'Period is required').isIn(['period1', 'period2', 'period3', 'period4', 'period5', 'period6', 'period7', 'period8', 'period9']),
  body('subject', 'Subject is required').not().isEmpty(),
  body('class', 'Class is required').not().isEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { teacherId, day, period, subject, class: className } = req.body;

    // Check if teacher exists
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Check for existing schedule conflict
    const existingSchedule = await Schedule.findOne({ teacherId, day, period });
    if (existingSchedule) {
      return res.status(400).json({
        success: false,
        message: 'Schedule conflict: Teacher already has a class at this time'
      });
    }

    const schedule = new Schedule({
      teacherId,
      teacherName: teacher.name,
      day,
      period,
      time: TIME_PERIODS[period],
      subject,
      class: className,
      isPublished: false, // Will be published when principal uploads
      createdBy: req.user.id
    });

    await schedule.save();
    await schedule.populate('teacherId', 'name nip');

    res.status(201).json({
      success: true,
      message: 'Schedule added successfully',
      data: schedule
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/schedules/:id
// @desc    Update schedule (Principal only)
// @access  Private (Principal)
router.put('/:id', [auth, principalOnly], [
  body('day', 'Day is required').isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
  body('period', 'Period is required').isIn(['period1', 'period2', 'period3', 'period4', 'period5', 'period6', 'period7', 'period8', 'period9']),
  body('subject', 'Subject is required').not().isEmpty(),
  body('class', 'Class is required').not().isEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { day, period, subject, class: className } = req.body;
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check for conflicts (excluding current schedule)
    const existingSchedule = await Schedule.findOne({ 
      teacherId: schedule.teacherId, 
      day, 
      period,
      _id: { $ne: req.params.id }
    });

    if (existingSchedule) {
      return res.status(400).json({
        success: false,
        message: 'Schedule conflict: Teacher already has a class at this time'
      });
    }

    schedule.day = day;
    schedule.period = period;
    schedule.time = TIME_PERIODS[period];
    schedule.subject = subject;
    schedule.class = className;

    await schedule.save();
    await schedule.populate('teacherId', 'name nip');

    res.json({
      success: true,
      message: 'Schedule updated successfully',
      data: schedule
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/schedules/:id
// @desc    Delete schedule (Principal only)
// @access  Private (Principal)
router.delete('/:id', [auth, principalOnly], async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/schedules/publish
// @desc    Publish all unpublished schedules (Principal only)
// @access  Private (Principal)
router.post('/publish', [auth, principalOnly], async (req, res) => {
  try {
    const result = await Schedule.updateMany(
      { isPublished: false },
      { isPublished: true }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} schedules published successfully`
    });
  } catch (error) {
    console.error('Publish schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/schedules/download
// @desc    Download schedule as JSON (can be enhanced for Excel/PDF)
// @access  Private
router.get('/download', auth, async (req, res) => {
  try {
    let query = { isPublished: true };
    if (req.user.role === 'teacher') query.teacherId = req.user.id;
    if (req.query.teacherId && req.user.role === 'principal') {
      query.teacherId = req.query.teacherId;
    }

    const schedules = await Schedule.find(query)
      .populate('teacherId', 'name nip')
      .sort({ day: 1, period: 1 });

    const rows = [];

    for (const [periodKey, timeRange] of Object.entries(TIME_PERIODS)) {
      if (periodKey.startsWith('period')) {
        const row = {
          Period: periodKey.replace('period', ''), // ex: "period1" → "1"
          Time: timeRange,
          Monday: '',
          Tuesday: '',
          Wednesday: '',
          Thursday: '',
          Friday: ''
        };

        schedules
          .filter(s => s.period === periodKey)
          .forEach(s => {
            const day = s.day.charAt(0).toUpperCase() + s.day.slice(1);
            row[day] = `${s.subject} (${s.class})`;
          });

        rows.push(row);
      } else {
        // Recess rows
        rows.push({
          Period: '',
          Time: timeRange,
          Monday: periodKey === 'recess1' ? 'Recess I' : 'Recess II',
          Tuesday: '',
          Wednesday: '',
          Thursday: '',
          Friday: ''
        });
      }
    }

    const json2csvParser = new Parser({
      fields: ['Period', 'Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    });
    const csv = json2csvParser.parse(rows);

    res.setHeader('Content-Disposition', 'attachment; filename=schedules.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.status(200).end(csv);
  } catch (err) {
    console.error('Download schedules error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


module.exports = router;