const TIME_PERIODS = {
    period1: { start: '07:55', end: '08:30', display: '07:55 - 08:30' },
    period2: { start: '08:30', end: '09:05', display: '08:30 - 09:05' },
    period3: { start: '09:05', end: '09:40', display: '09:05 - 09:40' },
    recess1: { start: '09:40', end: '10:10', display: '09:40 - 10:10', isRecess: true },
    period4: { start: '10:10', end: '10:45', display: '10:10 - 10:45' },
    period5: { start: '10:45', end: '11:20', display: '10:45 - 11:20' },
    period6: { start: '11:20', end: '11:55', display: '11:20 - 11:55' },
    recess2: { start: '11:55', end: '12:25', display: '11:55 - 12:25', isRecess: true },
    period7: { start: '12:25', end: '13:00', display: '12:25 - 13:00' },
    period8: { start: '13:00', end: '13:35', display: '13:00 - 13:35' },
    period9: { start: '13:35', end: '14:10', display: '13:35 - 14:10' }
  };
  
  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  
  const generateScheduleTable = (schedules) => {
    const table = {
      periods: Object.keys(TIME_PERIODS),
      days: DAYS,
      data: {}
    };
  
    // Initialize table structure
    Object.keys(TIME_PERIODS).forEach(period => {
      table.data[period] = {};
      DAYS.forEach(day => {
        table.data[period][day] = null;
      });
    });
  
    // Fill in the schedules
    schedules.forEach(schedule => {
      if (table.data[schedule.period]) {
        table.data[schedule.period][schedule.day] = schedule;
      }
    });
  
    return table;
  };
  
  const getTimeSlotInfo = (period) => {
    return TIME_PERIODS[period] || null;
  };
  
  const getCurrentPeriod = () => {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    for (const [period, time] of Object.entries(TIME_PERIODS)) {
      if (currentTime >= time.start && currentTime <= time.end) {
        return { period, ...time };
      }
    }
    
    return null;
  };
  
  const getNextPeriod = () => {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    for (const [period, time] of Object.entries(TIME_PERIODS)) {
      if (currentTime < time.start) {
        return { period, ...time };
      }
    }
    
    return null;
  };
  
  module.exports = {
    TIME_PERIODS,
    DAYS,
    generateScheduleTable,
    getTimeSlotInfo,
    getCurrentPeriod,
    getNextPeriod
  };
  
  // Create upload directories script (setup.js)
  const fs = require('fs');
  const path = require('path');
  
  const uploadDirs = [
    'uploads',
    'uploads/announcements',
    'uploads/folders',
    'uploads/academic-calendar'
  ];
  
  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
  
  console.log('Upload directories setup complete!');