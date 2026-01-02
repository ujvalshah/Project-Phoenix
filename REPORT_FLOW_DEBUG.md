# Report Flow Debug Analysis

## Flow Trace

### 1. User Submits Report ✅
- **UI**: `NewsCard.tsx` → `ReportModal` → `adminModerationService.submitReport()`
- **API**: POST `/moderation/reports`
- **Payload**: `{ targetId, targetType: 'nugget', reason, description, reporter, respondent }`
- **Controller**: `createReport()` sets `status: 'open'` (line 100)
- **Model**: `Report.create()` with `status: 'open'` (default also 'open')

### 2. Admin Fetches Reports ✅
- **UI**: `AdminModerationPage` → `adminModerationService.listReports('open')`
- **API**: GET `/moderation/reports?status=open`
- **Controller**: `getReports()` filters by `query.status = status` (line 39-41)
- **Query**: `Report.find({ status: 'open' })`

## Potential Issues

1. **Authentication**: Route requires `authenticateToken` middleware
2. **Query Parameter**: Status filter should work correctly
3. **Response Format**: Backend returns `{ data: [...], total, page, limit }`
4. **Frontend Parsing**: `adminModerationService.listReports()` handles both array and object formats

## Next Steps
- Verify authentication is working
- Check if reports are actually being created in DB
- Verify query is matching correctly












