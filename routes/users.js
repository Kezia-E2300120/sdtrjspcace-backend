const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, principalOnly } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
  body('name', 'Name is required').not().isEmpty(),
  body('email', 'Please include a valid email').isEmail(),
  body('nip', 'NIP is required').not().isEmpty()
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

    const { name, email, nip } = req.body;

    // Check if email or NIP is already taken by another user
    const existingUser = await User.findOne({
      $or: [{ email }, { nip }],
      _id: { $ne: req.user.id }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email or NIP is already taken'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, nip },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', auth, [
  body('currentPassword', 'Current password is required').exists(),
  body('newPassword', 'New password must be 6 or more characters').isLength({ min: 6 }),
  body('confirmPassword', 'Confirm password is required').exists()
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

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    const user = await User.findById(req.user.id);

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/teachers
// @desc    Get all teachers (Principal only)
// @access  Private (Principal)
router.get('/teachers', [auth, principalOnly], async (req, res) => {
  try {
    const teachers = await User.find({ 
      role: 'teacher', 
      isActive: true 
    }).select('-password').sort({ name: 1 });

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

// @route   GET /api/users/teachers/:id
// @desc    Get teacher details (Principal only)
// @access  Private (Principal)
router.get('/teachers/:id', [auth, principalOnly], async (req, res) => {
  try {
    const teacher = await User.findOne({ 
      _id: req.params.id,
      role: 'teacher',
      isActive: true 
    }).select('-password');

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    res.json({
      success: true,
      data: teacher
    });
  } catch (error) {
    console.error('Get teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;