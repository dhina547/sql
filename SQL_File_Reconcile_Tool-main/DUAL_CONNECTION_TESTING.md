# Dual-Connection Implementation - Test & Deployment

## 🎯 What was implemented

**Frontend Changes:**

- ✅ Updated `SqlQueryTab.jsx` to accept `m2Connections` prop
- ✅ Updated query execution to send `type: "source"|"target"` to backend
- ✅ Updated server labels to use actual connection names
- ✅ Updated `RunComparisonTab.jsx` to accept `m2Connections` prop
- ✅ Updated comparison payload to use connection-based approach

**Backend Changes:**

- ✅ Updated `/api/m2/preview_query` endpoint to use `type` parameter instead of `env/database`
- ✅ Added `execute_query_with_connection()` function in db_loader.py
- ✅ Backend now reads connection info from session state instead of config

**Architecture:**

- Frontend: `m2Connections = { source: {...}, target: {...} }`
- Backend Session: Tracks `source_server`, `target_server`, and their ports/usernames
- Data Flow: UI → API (type: "source"|"target") → Routes → DB Loader

---

## 🧪 Testing the Dual-Connection Feature

### Prerequisites

1. You have Module 2 Server Connection feature deployed
2. You have `db_config.json` configured with at least 2 different environments
3. Backend is running
4. Frontend is running

### Test Scenario 1: QA vs UAT Comparison

**Step 1: Connect Source (QA)**

1. Go to Module 2 → Environment tab
2. You should see dual connection UI (Source left/blue, Target right/orange)
3. Source section:
   - Select Environment: Choose any QA environment
   - Select Server: Choose any server from that environment
   - Auth: Fill in credentials if required
   - Click "Connect" (blue button)
4. Verify status: Source should show "✓ Connected"

**Step 2: Connect Target (UAT)**

1. Target section (right column):
   - Select Environment: Choose any UAT environment
   - Select Server: Choose any server from that environment
   - Auth: Fill in different credentials if required (can be different!)
   - Click "Connect" (orange button)
2. Verify status: Target should show "✓ Connected"
3. Verify UI shows "Disconnect Both" button when both connected

**Step 3: Copy Source to Target (Optional)**

1. Click "Copy Source Settings" button
2. Verify Target section is auto-populated with Source values
3. Modify if needed (port, credentials, etc.)

**Step 4: SQL Query Execution**

1. Go to SQL Query tab
2. Source Query section should show: "Source Query (QA1_Server)" (or your server label)
3. Target Query section should show: "Target Query (UAT1_Server)" (or your server label)
4. Enter a test query in Source: `SELECT COUNT(*) as row_count FROM dbo.YourTable`
5. Click "Execute" (blue button)
6. Verify console logs show query executed on correct source
7. Enter same query in Target and click "Execute" (orange button)
8. Verify console logs show query executed on correct target
9. Both should show row counts, confirming they're hitting different servers

**Step 5: Keys Mapping**

1. Go to Keys Mapping tab
2. Select source key column
3. Select target key column
4. Proceed to next tab

**Step 6: Run Comparison**

1. Go to Run Comparison tab
2. Click "Run Comparison"
3. Verify console logs show:
   - "Comparing: QA1_Server ↔ UAT1_Server" (actual server names)
   - Matched, mismatched, and missing record counts
   - Comparison result tables

---

## 🔍 Verification Checklist

### Frontend

- [ ] M2ConnectionBar shows two-column layout
- [ ] Source column is blue, Target column is orange
- [ ] Environment dropdowns populate correctly for each
- [ ] Server dropdowns show correct servers per environment
- [ ] Copy button copies source settings to target
- [ ] "Connect" buttons work independently
- [ ] "Disconnect Both" button appears when fully connected
- [ ] SqlQueryTab labels show actual server names (not env/db)
- [ ] Query execution shows different server names for source vs target

### Backend

- [ ] `/api/m2/connect` accepts `connection_type` parameter
- [ ] Session state tracks both `source_connected` and `target_connected`
- [ ] `/api/m2/preview_query` accepts `type` parameter (not env/database)
- [ ] `/api/m2/disconnect` clears both connections
- [ ] `execute_query_with_connection()` function exists in db_loader.py

### Database

- [ ] Source query runs on source connection (test with `SELECT @@SERVERNAME`)
- [ ] Target query runs on target connection (test with `SELECT @@SERVERNAME`)
- [ ] Different results if servers are actually different
- [ ] Comparison executes on both and finds differences

---

## 🐛 Common Issues & Troubleshooting

### Issue: "No active source connection" error

**Cause:** Source connection button clicked but not fully connected
**Fix:**

1. Check connection status indicator in UI
2. Verify credentials are correct
3. Check server is accessible
4. Look at console for specific error message

### Issue: Both queries run on same server

**Cause:** Session state not properly updated after connection
**Fix:**

1. Clear all connections: Click "Disconnect Both"
2. Reconnect both cleanly: Source first, then Target
3. Verify console shows connection_type in request

### Issue: Old env/database errors still appearing

**Cause:** Frontend caching old request format
**Fix:**

1. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
2. Clear browser cache
3. Restart development server

### Issue: `execute_query_with_connection` not found

**Cause:** db_loader.py wasn't updated
**Fix:**

1. Verify db_loader.py has the new function at the end
2. Restart backend server
3. Check files were saved properly

---

## 📊 Test Data Suggestions

If you want to test with actual different results:

```sql
-- Run on Source Server
SELECT TOP 10 column1, column2, COUNT(*) as record_count
FROM dbo.YourTable
GROUP BY column1, column2

-- Run on Target Server (UAT usually has different data)
SELECT TOP 10 column1, column2, COUNT(*) as record_count
FROM dbo.YourTable
GROUP BY column1, column2
```

Compare the outputs manually to verify the tool finds the correct differences.

---

## 🚀 Deployment Checklist

Before going to production:

- [ ] All files updated (listed below)
- [ ] No syntax errors in modified files
- [ ] Backend tests pass
- [ ] Frontend builds without errors
- [ ] Manual testing completed (all scenarios above)
- [ ] Cross-browser testing (Chrome, Edge, Firefox)
- [ ] Performance: Can handle large result sets
- [ ] Error handling: Graceful failures if connection drops

### Files Modified:

1. `frontend/src/module_2/SqlQueryTab.jsx`
2. `frontend/src/module_2/RunComparisonTab.jsx`
3. `backend/module_2/routes.py`
4. `backend/module_2/db_loader.py`
5. `frontend/src/App.jsx` (from previous commit)
6. `frontend/src/module_2/EnvironmentTab.jsx` (from previous commit)

---

## 📝 Rollback Instructions

If issues occur:

1. **Git Rollback** (if not yet pushed):

   ```bash
   git checkout HEAD -- frontend/src/module_2/SqlQueryTab.jsx
   git checkout HEAD -- frontend/src/module_2/RunComparisonTab.jsx
   git checkout HEAD -- backend/module_2/routes.py
   git checkout HEAD -- backend/module_2/db_loader.py
   ```

2. **Manual Revert**:
   - Restore files from backup before timestamp [CURRENT_TIME]
   - Restart backend and frontend services

---

## ✅ Success Indicators

The dual-connection feature is working correctly when:

1. ✅ You can connect to two completely different servers
2. ✅ Queries execute on their respective servers (verify with `@@SERVERNAME`)
3. ✅ Comparison results show accurate matches/mismatches between the two sources
4. ✅ Connection labels show actual server names (not environment names)
5. ✅ Console logs show distinct "type: source" vs "type: target" in requests
6. ✅ No errors about missing environments or databases

---

## 📞 Support

If testing reveals issues:

1. Check console logs (F12 → Console tab)
2. Check backend logs (terminal where backend is running)
3. Verify db_config.json is correctly formatted
4. Ensure no typos in server names/credentials
5. Test with simpler queries first (e.g., `SELECT 1`)
