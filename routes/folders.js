const express = require('express');
const { body, validationResult } = require('express-validator');
const Folder = require('../models/Folder');
const User = require('../models/User');
const { auth, principalOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// @route   GET /api/folders
// @desc    Get user's folders (teacher) or all folders (principal)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'teacher') {
      query.teacherId = req.user.id;
    }

    // Filter by teacherId if provided (for principal viewing teacher folders)
    if (req.query.teacherId && req.user.role === 'principal') {
      query.teacherId = req.query.teacherId;
      
      // Track recent access for principal
      const teacher = await User.findById(req.query.teacherId);
      if (teacher) {
        await User.findByIdAndUpdate(req.user.id, {
          $push: {
            recentFolders: {
              $each: [{
                teacherId: req.query.teacherId,
                teacherName: teacher.name,
                accessedAt: new Date()
              }],
              $position: 0,
              $slice: 10 // Keep only last 10 recent folders
            }
          }
        });
      }
    }

    const folders = await Folder.find(query)
      .populate('teacherId', 'name nip')
      .sort({ folderType: 1, createdAt: -1 });

    // Group by folder type
    const groupedFolders = {
      material: null,
      administration: null,
      event: null,
      other: null
    };

    folders.forEach(folder => {
      groupedFolders[folder.folderType] = folder;
    });

    res.json({
      success: true,
      data: groupedFolders
    });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/folders/:folderType
// @desc    Get folder by type (material, administration, event, other)
// @access  Private
router.get('/:folderType', auth, async (req, res) => {
  try {
    const { folderType } = req.params;
    const validFolderTypes = ['material', 'administration', 'event', 'other'];

    if (!validFolderTypes.includes(folderType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid folder type'
      });
    }

    let query = { folderType };

    // Jika teacher → hanya ambil folder miliknya
    if (req.user.role === 'teacher') {
      query.teacherId = req.user.id;
    }

    // Jika principal → bisa filter pakai ?teacherId
    if (req.user.role === 'principal' && req.query.teacherId) {
      query.teacherId = req.query.teacherId;
    }

    // Cari folder
    const folder = await Folder.findOne(query)
      .populate('teacherId', 'name nip')
      .sort({ updatedAt: -1 });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Format response biar jelas
    res.json({
      success: true,
      folderType,
      files: folder.files.map(f => ({
        _id: f._id,
        fileName: f.fileName,
        originalName: f.originalName,
        filePath: f.filePath,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt || f.createdAt
      }))
    });

  } catch (error) {
    console.error('Get folder by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/folders/:folderType/upload
// @desc    Upload file to specific folder
// @access  Private (Teacher owns folder or Principal)
router.post('/:folderType/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { folderType } = req.params;
    const validFolderTypes = ['material', 'administration', 'event', 'other'];
    
    if (!validFolderTypes.includes(folderType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid folder type'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    let teacherId = req.user.id;
    let teacherName = req.user.name;

    // Jika principal upload ke folder guru tertentu
    if (req.user.role === 'principal' && req.body.teacherId) {
      const teacher = await User.findById(req.body.teacherId);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: 'Teacher not found'
        });
      }
      teacherId = teacher.id;
      teacherName = teacher.name;
    }

    // Cari folder berdasarkan guru + type
    let folder = await Folder.findOne({ teacherId, folderType });
    
    if (!folder) {
      folder = new Folder({
        teacherId,
        teacherName,
        folderType,
        files: []
      });
    }

    // Data file yang akan disimpan
    const fileData = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
      // uploadedAt, createdAt, updatedAt otomatis dari schema
    };

    folder.files.push(fileData);
    await folder.save();

    // Ambil file terbaru (last element)
    const newFile = folder.files[folder.files.length - 1];

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        folder: folder.folderType,
        file: newFile
      }
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});


// @route   DELETE /api/folders/:folderType/files/:fileId
// @desc    Delete file from folder
// @access  Private (Teacher owns folder or Principal)
router.delete('/:folderType/files/:fileId', auth, async (req, res) => {
  try {
    const { folderType, fileId } = req.params;
    let teacherId = req.user.id;

    // If principal deleting from teacher's folder
    if (req.user.role === 'principal' && req.query.teacherId) {
      teacherId = req.query.teacherId;
    }

    const folder = await Folder.findOne({ teacherId, folderType });
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    const fileIndex = folder.files.findIndex(
      (file) => file._id.toString() === fileId
    );
    if (fileIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = folder.files[fileIndex];

    // Hapus fisik file kalau masih ada
    try {
      if (file.filePath && fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }
    } catch (err) {
      console.warn('Warning: gagal hapus file fisik:', err.message);
    }

    // Hapus dari database
    folder.files.splice(fileIndex, 1);
    await folder.save();

    res.json({
      success: true,
      message: 'File deleted successfully',
      data: { fileId, fileName: file.originalName }
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/folders/:folderType/files/:fileId/download
// @desc    Download file from folder
// @access  Private
router.get('/:folderType/files/:fileId/download', auth, async (req, res) => {
  try {
    const { folderType, fileId } = req.params;
    let teacherId = req.user.id;

    // If principal downloading from teacher's folder
    if (req.user.role === 'principal' && req.query.teacherId) {
      teacherId = req.query.teacherId;
    }

    const folder = await Folder.findOne({ teacherId, folderType });
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    const file = folder.files.find((f) => f._id.toString() === fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (!file.filePath || !fs.existsSync(file.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Track recent file access
    try {
      await User.findByIdAndUpdate(req.user.id, {
        $push: {
          recentFiles: {
            $each: [
              {
                fileId: file._id,
                fileName: file.originalName,
                filePath: file.filePath,
                accessedAt: new Date()
              }
            ],
            $position: 0,
            $slice: 10 // keep last 10
          }
        }
      });
    } catch (err) {
      console.warn('Warning: gagal simpan recentFiles:', err.message);
    }

    return res.download(file.filePath, file.originalName);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;