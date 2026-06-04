const mongoose = require('mongoose');

const sendJobSchema = new mongoose.Schema(
    {
        template_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
        template_name: String,
        subject: String,

        // How recipients were chosen, so the background worker can resolve them.
        mode: { type: String, enum: ['selected', 'all'], default: 'selected' },
        contact_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
        filters: { type: mongoose.Schema.Types.Mixed },
        search: String,

        status: {
            type: String,
            enum: ['queued', 'running', 'completed', 'partial', 'failed', 'canceled'],
            default: 'queued',
            index: true,
        },
        total: { type: Number, default: 0 },
        sent: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        error: String,

        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        started_at: Date,
        completed_at: Date,
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('SendJob', sendJobSchema);
