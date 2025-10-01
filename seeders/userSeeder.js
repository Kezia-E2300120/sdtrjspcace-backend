const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User'); // sesuaikan path modelmu

dotenv.config();

// koneksi MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/school_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB connection error:', err));

const seedUsers = [
  {
    name: 'Principal',
    email: 'principal@example.com',
    password: 'principal123',
    nip: '123456789',
    role: 'principal'
  }
];

const seedDB = async () => {
  try {
    await User.deleteMany(); // optional: bersihkan dulu
    await User.insertMany(seedUsers);
    console.log('Seeder finished!');
    mongoose.connection.close();
  } catch (err) {
    console.error(err);
    mongoose.connection.close();
  }
};

seedDB();
