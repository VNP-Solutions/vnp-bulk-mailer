const mongoose = require('mongoose');

const sendJobSchema = new mongoose.Schema(
    {
        template_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
        template_name: String,
        subject: String,
        // Addresses CC'd on every email in this job.
        cc: [{ type: String }],

        // How recipients were chosen (kept for reference).
        mode: { type: String, enum: ['selected', 'all'], default: 'selected' },
        contact_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
        filters: { type: mongoose.Schema.Types.Mixed },
        search: String,

        // Frozen recipient list resolved at creation time, so the job is
        // deterministic and resumable across cooldowns / restarts.
        recipient_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
        // Index of the next recipient to send (everything before is done).
        cursor: { type: Number, default: 0 },

        status: {
            type: String,
            enum: ['queued', 'running', 'cooldown', 'completed', 'partial', 'failed', 'canceled'],
            default: 'queued',
            index: true,
        },
        // When a cooldown job should be picked up again (rate-limit window frees).
        resume_at: { type: Date, index: true },

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
