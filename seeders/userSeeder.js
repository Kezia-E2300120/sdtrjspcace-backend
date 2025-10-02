const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User'); // sesuaikan path modelmu

dotenv.config();

// Koneksi MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/school_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB connection error:', err));

const seedDB = async () => {
  try {
    // Hash password di dalam async function
    const hashedPassword = await bcrypt.hash('principal123', 10);

    const seedUsers = [
      {
        name: 'Principal',
        email: 'principal@example.com',
        password: hashedPassword,
        role: 'principal'
      }
    ];

    // Optional: hapus dulu semua user
    await User.deleteMany();
    await User.insertMany(seedUsers);

    console.log('Seeder finished!');
  } catch (err) {
    console.error('Seeder error:', err);
  } finally {
    mongoose.connection.close();
  }
};

// Jalankan seeder
seedDB();
