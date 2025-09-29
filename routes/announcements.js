const express = require('express');
const { body, validationResult } = require('express-validator');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { auth, principalOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// @route   GET /api/announcements
// @desc    Get all announcements
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/announcements
// @desc    Create announcement (Principal only)
// @access  Private (Principal)
router.post('/', [auth, principalOnly], upload.single('attachment'), [
  body('title', 'Title is required').not().isEmpty(),
  body('description', 'Description is required').not().isEmpty()
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

    const { title, description } = req.body;
    let attachment = null;

    if (req.file) {
      attachment = {
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      };
    }

    const announcement = new Announcement({
      title,
      description,
      attachment,
      createdBy: req.user.id
    });

    await announcement.save();
    await announcement.populate('createdBy', 'name role');

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/announcements/:id
// @desc    Update announcement (Principal only)
// @access  Private (Principal)
router.put('/:id', [auth, principalOnly], upload.single('attachment'), [
  body('title', 'Title is required').not().isEmpty(),
  body('description', 'Description is required').not().isEmpty()
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

    const { title, description } = req.body;
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Update fields
    announcement.title = title;
    announcement.description = description;

    // Handle new attachment
    if (req.file) {
      // Delete old attachment if exists
      if (announcement.attachment && announcement.attachment.filePath) {
        if (fs.existsSync(announcement.attachment.filePath)) {
          fs.unlinkSync(announcement.attachment.filePath);
        }
      }

      announcement.attachment = {
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      };
    }

    await announcement.save();
    await announcement.populate('createdBy', 'name role');

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/announcements/:id
// @desc    Delete announcement (Principal only)
// @access  Private (Principal)
router.delete('/:id', [auth, principalOnly], async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Soft delete
    announcement.isActive = false;
    await announcement.save();

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/announcements/:id/download
// @desc    Download announcement attachment
// @access  Private
router.get('/:id/download', auth, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement || !announcement.attachment || !announcement.attachment.filePath) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const filePath = announcement.attachment.filePath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    res.download(filePath, announcement.attachment.fileName || 'download');
  } catch (error) {
    console.error('Download announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;