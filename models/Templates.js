const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, index: true },
        // The full HTML email body, with [[field]] tokens left in place.
        html: { type: String, required: true },
        // Distinct [[field]] tokens found in the html, in first-seen order.
        fields: { type: [String], default: [] },
        // Original uploaded filename, for reference.
        source_name: { type: String, trim: true },

        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Template', templateSchema);
