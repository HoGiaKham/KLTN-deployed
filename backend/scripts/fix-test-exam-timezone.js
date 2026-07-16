#!/usr/bin/env node

/**
 * Script to fix test exam timezone offset in database
 *
 * Problem: When test exams were created before the timezone fix,
 * they were stored with incorrectly interpreted times.
 *
 * This script adjusts openTime and closeTime by subtracting 7 hours
 * to correct the offset.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Exam = require('../src/models/Exam');

const MONGODB_URI = process.env.MONGO_URI;

async function fixTimezoneOffset() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all test exams with openTime
    const exams = await Exam.find({ openTime: { $exists: true, $ne: null } });
    console.log(`📋 Found ${exams.length} test exams with openTime`);

    let fixedCount = 0;

    for (const exam of exams) {
      const originalOpenTime = exam.openTime;
      const originalCloseTime = exam.closeTime;

      // Subtract 7 hours from openTime if it exists
      if (exam.openTime) {
        const openDate = new Date(exam.openTime);
        openDate.setHours(openDate.getHours() - 7);
        exam.openTime = openDate;
      }

      // Subtract 7 hours from closeTime if it exists
      if (exam.closeTime) {
        const closeDate = new Date(exam.closeTime);
        closeDate.setHours(closeDate.getHours() - 7);
        exam.closeTime = closeDate;
      }

      await exam.save();
      fixedCount++;

      console.log(`✅ Fixed: ${exam.title}`);
      console.log(`   Old openTime: ${originalOpenTime}`);
      console.log(`   New openTime: ${exam.openTime.toISOString()}`);
    }

    console.log(`\n🎉 Fixed ${fixedCount} test exams`);
    console.log('✅ Timezone offset correction completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixTimezoneOffset();