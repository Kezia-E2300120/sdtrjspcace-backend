const express = require('express');
const AcademicCalendar = require('../models/AcademicCalendar');
const { auth, principalOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Serve static files
// Pastikan di app.js / server.js sudah ada:
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// @route   GET /api/academic-calendar
// @desc    Get academic calendar image
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const calendar = await AcademicCalendar.findOne({ isActive: true })
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 });

    if (!calendar || !calendar.image || !calendar.image.fileName) {
      return res.json({
        success: true,
        data: null,
        message: 'No academic calendar found'
      });
    }

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${calendar.image.fileName}`;

    res.json({
      success: true,
      data: {
        ...calendar.toObject(),
        imageUrl
      }
    });
  } catch (error) {
    console.error('Get academic calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});


// @route   POST /api/academic-calendar/upload
// @desc    Upload academic calendar image (Principal only)
// @access  Private (Principal)
router.post('/upload', [auth, principalOnly], upload.single('calendar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }

    // Check if file is an image
    if (!req.file.mimetype.startsWith('image/')) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path); // hapus kalau bukan image
      }
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed'
      });
    }

    // Deactivate previous calendar
    await AcademicCalendar.updateMany({ isActive: true }, { isActive: false });

    // Delete old calendar images (biar storage gak numpuk)
    const oldCalendars = await AcademicCalendar.find({ isActive: false });
    oldCalendars.forEach(calendar => {
      if (calendar.image?.filePath && fs.existsSync(calendar.image.filePath)) {
        fs.unlinkSync(calendar.image.filePath);
      }
    });

    // Create new calendar
    const calendar = new AcademicCalendar({
      image: {
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      },
      uploadedBy: req.user.id,
      isActive: true
    });

    await calendar.save();
    await calendar.populate('uploadedBy', 'name role');

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${calendar.image.fileName}`;

    res.status(201).json({
      success: true,
      message: 'Academic calendar uploaded successfully',
      data: {
        ...calendar.toObject(),
        imageUrl
      }
    });
  } catch (error) {
    console.error('Upload academic calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
