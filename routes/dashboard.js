const express = require('express');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Schedule = require('../models/Schedule');
const Folder = require('../models/Folder');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/dashboard
// @desc    Get dashboard data based on user role
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let dashboardData = {};

    if (req.user.role === 'teacher') {
      // ===== Teacher Dashboard Data =====
      const announcements = await Announcement.find({ isActive: true })
        .populate('createdBy', 'name role')
        .sort({ createdAt: -1 })
        .limit(5);

      // Ambil recent files dari folder milik teacher
      const recentFiles = await Folder.find({ teacherId: req.user.id })
        .populate('files') // kalau schema Folder ada array of File refs
        .sort({ updatedAt: -1 })
        .limit(5)
        .then(folders => {
          // Flatten biar jadi list file per folder
          return folders.flatMap(f => f.files || []);
        });

      // Get today's schedule
      const today = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todaySchedule = await Schedule.find({
        teacherId: req.user.id,
        day: dayNames[today.getDay()],
        isPublished: true
      }).sort({ period: 1 });

      // Get upcoming schedules (next 3 days misalnya ambil limit 10)
      const upcomingSchedules = await Schedule.find({
        teacherId: req.user.id,
        isPublished: true
      }).sort({ day: 1, period: 1 }).limit(10);

      dashboardData = {
        role: 'teacher',
        announcements,
        recentFiles: recentFiles.slice(0, 5),
        todaySchedule,
        upcomingSchedules,
        stats: {
          totalAnnouncements: announcements.length,
          recentFilesCount: recentFiles.length,
          todayClassesCount: todaySchedule.length
        }
      };

    } else if (req.user.role === 'principal') {
      // ===== Principal Dashboard Data =====
      const announcements = await Announcement.find({ isActive: true })
        .populate('createdBy', 'name role')
        .sort({ createdAt: -1 })
        .limit(5);

      // Ambil recent folders dari guru (bukan per file)
      const recentTeacherFolders = await Folder.aggregate([
        { $sort: { updatedAt: -1 } }, // urutkan folder terbaru dulu
        {
          $group: {
            _id: "$teacherId",       // group by teacher
            latestFolder: { $first: "$$ROOT" } // ambil folder terbaru per teacher
          }
        },
        { $limit: 5 }
      ]);

      await User.populate(recentTeacherFolders, {
        path: "latestFolder.teacherId",
        select: "name nip"
      });

      // Get teacher statistics
      const totalTeachers = await User.countDocuments({ role: 'teacher', isActive: true });
      const totalSchedules = await Schedule.countDocuments({ isPublished: true });
      const totalFolders = await Folder.countDocuments();

      // Get recent activities (guru yang update folder terbaru)
      const recentActivities = await Folder.find({})
        .populate('teacherId', 'name nip')
        .sort({ updatedAt: -1 })
        .limit(10);

      dashboardData = {
        role: 'principal',
        announcements,
        recentTeacherFolders,
        recentActivities,
        stats: {
          totalTeachers,
          totalSchedules,
          totalFolders,
          totalAnnouncements: await Announcement.countDocuments({ isActive: true })
        }
      };
    }

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/dashboard/stats
// @desc    Get detailed statistics (Principal only)
// @access  Private (Principal)
router.get('/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'principal') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get comprehensive statistics
    const stats = await Promise.all([
      User.countDocuments({ role: 'teacher', isActive: true }),
      User.countDocuments({ role: 'principal', isActive: true }),
      Announcement.countDocuments({ isActive: true }),
      Schedule.countDocuments({ isPublished: true }),
      Folder.countDocuments(),
      Schedule.aggregate([
        { $match: { isPublished: true } },
        { $group: { _id: '$teacherId', count: { $sum: 1 } } }
      ])
    ]);

    const [
      totalTeachers,
      totalPrincipals,
      totalAnnouncements,
      totalSchedules,
      totalFolders,
      schedulesByTeacher
    ] = stats;

    // Calculate average schedules per teacher
    const avgSchedulesPerTeacher = schedulesByTeacher.length > 0 
      ? (totalSchedules / schedulesByTeacher.length).toFixed(1)
      : 0;

    // Get folder statistics by type
    const folderStats = await Folder.aggregate([
      { $group: { _id: '$folderType', count: { $sum: 1 } } }
    ]);

    const folderStatsByType = {
      material: 0,
      administration: 0,
      event: 0,
      other: 0
    };

    folderStats.forEach(stat => {
      folderStatsByType[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        users: {
          totalTeachers,
          totalPrincipals,
          total: totalTeachers + totalPrincipals
        },
        content: {
          totalAnnouncements,
          totalSchedules,
          totalFolders,
          avgSchedulesPerTeacher
        },
        foldersByType: folderStatsByType,
        teachersWithSchedules: schedulesByTeacher.length
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;