require('dotenv').config();

const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const { connectDatabase } = require('./services/database');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const contactRoutes = require('./routes/contactRoutes');
const templateRoutes = require('./routes/templateRoutes');
const sendRoutes = require('./routes/sendRoutes');
const openapiSpec = require('./docs/openapi');

const app = express();
const PORT = process.env.PORT || 3000;

// Raised from the 100kb default: contact export-by-ids and large multi-select
// filter arrays can produce sizeable JSON bodies.
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Documentation
app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, {
        customSiteTitle: 'VNP Email Utility API Docs',
    })
);
app.get('/api/docs.json', (req, res) => res.json(openapiSpec));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/send', sendRoutes);

app.use((err, req, res, next) => {
    console.error(err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
});

async function start() {
    try {
        await connectDatabase();
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();