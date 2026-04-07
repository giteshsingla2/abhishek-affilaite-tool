const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../config/db');
const User = require('../models/User');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const seedAdmin = async () => {
  await connectDB();

  try {
    const adminEmail = 'Singitesh1@gmail.com';
    const adminPassword = 'Giteshsingla123!@#';

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('Super Admin user already exists.');
      if (existingAdmin.role !== 'superadmin') {
        existingAdmin.role = 'superadmin';
        await existingAdmin.save();
        console.log(`User ${adminEmail} has been promoted to superadmin.`);
      } else {
        console.log(`User ${adminEmail} is already a superadmin.`);
      }
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const adminUser = new User({
      email: adminEmail,
      password: hashedPassword,
      role: 'superadmin',
    });

    await adminUser.save();
    console.log('Super Admin user created successfully!');

  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedAdmin();
