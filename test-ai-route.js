// Test script để kiểm tra route generate-ai-exam
const express = require('express');
const testExamRoutes = require('./backend/src/routes/testExamRoutes');

const app = express();
app.use(express.json());
app.use('/api/test-exams', testExamRoutes);

// List all routes
console.log('📋 All registered routes:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    // Single route
    console.log(`  ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    // Router middleware
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
        const path = middleware.regexp.source.replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/').replace('^', '');
        console.log(`  ${methods} ${path}${handler.route.path}`);
      }
    });
  }
});

console.log('\n✅ Checking for /generate-ai-exam route...');
const hasAIRoute = app._router.stack.some((middleware) => {
  if (middleware.name === 'router') {
    return middleware.handle.stack.some((handler) => {
      return handler.route && handler.route.path === '/generate-ai-exam';
    });
  }
  return false;
});

if (hasAIRoute) {
  console.log('✅ Route /api/test-exams/generate-ai-exam EXISTS');
} else {
  console.log('❌ Route /api/test-exams/generate-ai-exam NOT FOUND');
}
