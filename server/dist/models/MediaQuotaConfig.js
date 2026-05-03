import mongoose, { Schema } from 'mongoose';
const MediaQuotaConfigSchema = new Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        default: 'default'
    },
    maxFilesPerUser: {
        type: Number,
        required: true,
        min: 1,
        max: 100000
    },
    maxStorageBytes: {
        type: Number,
        required: true,
        min: 10 * 1024 * 1024, // 10 MB
        max: 5000 * 1024 * 1024 // 5000 MB
    },
    maxDailyUploads: {
        type: Number,
        required: true,
        min: 1,
        max: 1000
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false,
    collection: 'mediaquotaconfigs'
});
export const MediaQuotaConfig = mongoose.model('MediaQuotaConfig', MediaQuotaConfigSchema);
//# sourceMappingURL=MediaQuotaConfig.js.map