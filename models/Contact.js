const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
    {
        first_name: { type: String, trim: true, index: true },
        last_name: { type: String, trim: true, index: true },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            index: true,
        },
        hotel_name: { type: String, trim: true, index: true },
        portfolio: { type: String, trim: true, index: true },

        // Attribution — who added this contact.
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Contact', contactSchema);
