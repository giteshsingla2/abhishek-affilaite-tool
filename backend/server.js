const dotenv = require('dotenv');
dotenv.config();

const express = require('express');

const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const campaignUploadRoutes = require('./routes/campaignUploadRoutes');




const app = express();
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

// Connect to database
connectDB();

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(cookieParser());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(express.json());

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many attempts, please try again later.' }
});

const campaignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Campaign creation rate limit reached. Please wait before starting more campaigns.' }
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many requests, please slow down.' }
});

// Apply Rate Limiters
app.use('/api/auth', authLimiter);
app.use('/api/campaign-upload/start', campaignLimiter);
app.use('/api/campaigns/start', campaignLimiter);
app.use('/api/campaigns/start-static', campaignLimiter);
app.use('/api', generalLimiter);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/credentials', require('./routes/credentialRoutes'));
app.use('/api/test-upload', require('./routes/testUploadRoutes'));
app.use('/api/templates', require('./routes/templateRoutes'));
app.use('/api/campaigns', require('./routes/campaignsRoutes'));
app.use('/api/websites', require('./routes/websiteRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/domains', require('./routes/domainRoutes'));
app.use('/api/static-templates', require('./routes/staticTemplateRoutes'));
app.use('/api/static-websites', require('./routes/staticWebsiteRoutes'));
app.use('/api/campaign-upload', campaignUploadRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err.stack);
  res.status(err.status || 500).json({
    msg: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Workers
require('./workers/deployWorker');
require('./workers/csvProcessorWorker');

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

