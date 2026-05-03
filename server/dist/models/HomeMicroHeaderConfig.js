import mongoose, { Schema } from 'mongoose';
const HomeMicroHeaderConfigSchema = new Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        default: 'default'
    },
    title: {
        type: String,
        required: true,
        maxlength: 120
    },
    body: {
        type: String,
        required: true,
        maxlength: 500
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false,
    collection: 'homemicroheaderconfigs'
});
export const HomeMicroHeaderConfig = mongoose.model('HomeMicroHeaderConfig', HomeMicroHeaderConfigSchema);
//# sourceMappingURL=HomeMicroHeaderConfig.js.map