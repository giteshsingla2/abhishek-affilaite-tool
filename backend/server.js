const dotenv = require('dotenv');
dotenv.config();

const express = require('express');

const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const campaignUploadRoutes = require('./routes/campaignUploadRoutes');




const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173' // Allow requests from your frontend
}));
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(express.json());

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

// Workers
require('./workers/deployWorker');
require('./workers/csvProcessorWorker');

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

