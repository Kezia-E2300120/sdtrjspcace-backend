const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User'); // sesuaikan path modelmu

dotenv.config();

// koneksi MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected for seeding...'))
.catch(err => console.error(err));

const hashedPassword = await bcrypt.hash('principal123', 10);

const seedUsers = [
  {
    name: 'Principal',
    email: 'principal@example.com',
    password: hashedPassword,
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
