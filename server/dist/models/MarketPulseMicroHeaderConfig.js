import mongoose, { Schema } from 'mongoose';
const MarketPulseMicroHeaderConfigSchema = new Schema({
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
    collection: 'marketpulsemicroheaderconfigs'
});
export const MarketPulseMicroHeaderConfig = mongoose.model('MarketPulseMicroHeaderConfig', MarketPulseMicroHeaderConfigSchema);
//# sourceMappingURL=MarketPulseMicroHeaderConfig.js.map