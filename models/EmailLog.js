const mongoose = require('mongoose');

// One row per email attempt — powers the sending history view.
const emailLogSchema = new mongoose.Schema(
    {
        job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SendJob', index: true },
        template_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', index: true },
        template_name: { type: String, index: true },

        contact_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
        email: { type: String, index: true },
        contact_name: String,
        hotel_name: String,
        portfolio: String,

        subject: String,
        status: { type: String, enum: ['sent', 'failed'], index: true },
        error: String,

        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        sent_at: { type: Date, index: true },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('EmailLog', emailLogSchema);
