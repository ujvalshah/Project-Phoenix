import mongoose, { Schema } from 'mongoose';
const DisclaimerConfigSchema = new Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        default: 'default'
    },
    defaultText: {
        type: String,
        required: true,
        maxlength: 500
    },
    enableByDefault: {
        type: Boolean,
        required: true,
        default: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false,
    collection: 'disclaimerconfigs'
});
export const DisclaimerConfig = mongoose.model('DisclaimerConfig', DisclaimerConfigSchema);
//# sourceMappingURL=DisclaimerConfig.js.map