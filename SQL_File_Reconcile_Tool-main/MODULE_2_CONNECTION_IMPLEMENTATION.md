# Module 2 Server Connection Implementation

## Summary of Changes

Module 2 now has full server connection support matching Module 1's architecture. Users can connect to SQL Server with Windows Authentication or SQL Server credentials before executing queries.

---

## Backend Changes

### 1. **module_2/routes.py** - Added Connection Endpoints

**New Features:**

- `POST /api/m2/connect` - Authenticate and connect to SQL Server
  - Validates credentials against db_config.json
  - Supports Windows Auth and SQL Server Auth
  - Tracks connection state per session
  - Returns connection info to frontend

- `POST /api/m2/disconnect` - Close Module 2 session
  - Clears all connection state
  - Called on disconnect button or browser close

**Connection State Tracking:**

- Separate `_m2_session_state` dictionary for Module 2
- Idle timeout checking (background daemon thread)
- Heartbeat polling support for frontend timeout detection
- Session activity tracking

**Updated Endpoints:**

- `/api/m2/status` - Now reports connection status
- All endpoints use `_touch_m2_activity()` to refresh idle timer

**Technical Details:**

```python
_m2_session_state = {
    'source_connected': False,
    'target_connected': False,
    'source_server': None,
    'source_port': None,
    'source_username': None,
    'target_server': None,
    'target_database': None,
    'target_port': None,
    'target_username': None,
    'last_activity': time.time(),
    'timed_out': False,
}
```

---

## Frontend Changes

### 2. **common_Resources/M2ConnectionBar.jsx** - New Connection UI Component

**Purpose:** Provides UI for connecting to SQL Server in Module 2 (equivalent to ConnectionBar.jsx for Module 1)

**Features:**

- Environment selector (dropdown)
- Server selector (dropdown, populated based on environment)
- Username/Password fields (shown based on auth type)
- Connect/Disconnect buttons
- Auth type badge (Windows Auth vs SQL Auth)
- Connection status indicator (green dot when connected)
- Idle timeout detection (30-second heartbeat polling)
- Safe disconnect on browser close (sendBeacon)

**Props:**

- `m2Connection` - Current connection state object (null if not connected)
- `onConnected` - Callback when connection successful
- `onDisconnected` - Callback when disconnected

**Connection Object Structure:**

```javascript
{
    server: "localhost\\SQLEXPRESS",
    env: "QA_Release_1",
    port: 1433,
    serverLabel: "QA1_Payments_Server"
}
```

### 3. **App.jsx** - Integrated M2ConnectionBar

**Changes:**

- Imported M2ConnectionBar component
- Added `m2Connection` state of type useState(null)
- Added `handleM2Connected()` callback
- Added `handleM2Disconnected()` callback
- Updated `tabEnabled()` logic:
  - SQL Query tab: requires m2Connection
  - Keys Mapping tab: requires m2Connection + executed queries
  - Run Comparison tab: fully configured + connection
- Updated `handleModuleChange()` to reset m2Connection on module switch
- Renders M2ConnectionBar when activeModule === "sql-to-sql"
- Updated Environment tab display to show connection status
- Passes m2Connection to SqlQueryTabM2 and RunComparisonTabM2

**Tab Access Flow:**

```
Environment (always enabled) → shows M2ConnectionBar
    ↓ (after connect)
SQL Query (requires m2Connection) → plan and execute queries
    ↓ (after both queries executed)
Keys Mapping (requires queries executed) → map source/target keys
    ↓ (after keys mapped)
Run Comparison (fully configured) → execute reconciliation
```

---

## Authentication Support

### Windows Authentication

- No credentials required
- Uses current Windows user
- Connection string: `Trusted_Connection=yes`
- Auth type determined by: db_config.json `auth_type: "windows"`

### SQL Server Authentication

- Username and password required
- Credentials validated against db_config.json
- Connection string includes UID and PWD
- Auth type determined by:
  1. Instance-level override (if username/password exists in db_config)
  2. Global auth_type setting (if not overridden)

### Credential Validation

- Server-side gatekeeper in `/api/m2/connect`
- Validates UI-entered credentials against stored credentials
- Rejects mismatches with 401 Unauthorized
- Supports per-instance credential overrides

---

## Database Connection Flow

### Before (Old Module 2):

```
User → Select Environment/Database (crude) → SQL Query Tab
```

### After (New Module 2):

```
User → M2ConnectionBar (Environment → Server → Auth)
    → Connect (validates credentials)
    → SQL Query Tab (uses m2Connection)
    → Execute queries with proper authentication
```

---

## Configuration File Integration

The system reads from `db_config.json`:

```json
{
  "auth_type": "windows" or "sql",
  "idle_timeout_minutes": 10,
  "environments": [
    {
      "env_name": "QA_Release_1",
      "instances": [
        {
          "server_label": "QA1_Payments",
          "host": "localhost\\SQLEXPRESS",
          "port": 1433,
          "databases": ["PayDB", "UserDB"],
          "username": "optional_sa_user",
          "password": "optional_password"
        }
      ]
    }
  ]
}
```

Per-instance credentials override the global auth_type.

---

## Session Management

### Idle Timeout Behavior

- Default timeout: 10 minutes (configurable in db_config.json)
- Background daemon checks every 30 seconds
- Frontend heartbeat polling every 30 seconds
- On timeout:
  - Session marked as `timed_out`
  - Frontend notified on next heartbeat
  - User must reconnect

### Activity Touch

- Every API call updates `last_activity` timestamp
- Idle timer resets on activity
- Frontend heartbeat call also resets timer (if not timed out)

### Safe Disconnect

- On browser close: `navigator.sendBeacon()` sends disconnect
- On manual disconnect: User clicks Disconnect button
- Clears session state and resets UI

---

## API Endpoints Summary

| Endpoint                     | Method | Purpose                 | Requires Auth       |
| ---------------------------- | ------ | ----------------------- | ------------------- |
| `/api/m2/connect`            | POST   | Create Module 2 session | Yes (gatekeeper)    |
| `/api/m2/disconnect`         | POST   | End Module 2 session    | No                  |
| `/api/m2/status`             | GET    | Check Module 2 health   | No                  |
| `/api/m2/preview_query`      | POST   | Preview SQL results     | Connection required |
| `/api/sql-compare`           | POST   | Execute reconciliation  | Connection required |
| `/api/m2/export/<id>/<type>` | GET    | Download results        | Connection required |
| `/api/heartbeat`             | GET    | Check session timeout   | No                  |
| `/api/activity`              | POST   | Refresh activity timer  | No                  |

---

## Breaking Changes

### Frontend

- EnvironmentTab component is now cosmetic (shows connection status)
- SqlQueryTabM2, RunComparisonTabM2 now require m2Connection prop
- Tabs are locked until m2Connection established

### Backend

- `/api/m2/preview_query` expected to receive `env` and `database` parameters
  - These may need to be updated if moving to m2Connection-based approach
  - Currently still expects legacy params (will be refactored later)

---

## Testing Checklist

- [ ] Start Module 2
- [ ] M2ConnectionBar renders correctly
- [ ] Dropdown population works (Environment → Server chain)
- [ ] Auth type detection works (Windows vs SQL)
- [ ] Connection attempt validates credentials
- [ ] Successful connection unlocks SQL Query tab
- [ ] Idle timeout after 10 minutes triggers disconnect warning
- [ ] Browser close gracefully disconnects
- [ ] Manual disconnect resets state
- [ ] Module switch disconnects previous module's connection

---

## Next Steps (Future Enhancements)

1. **Dual Server Support**: Modify M2ConnectionBar to support source/target server selection
2. **Database Selection**: Add database picker to SqlQueryTab after server connection
3. **Credential Caching**: Optional credential caching for repeated connections
4. **Connection Pool**: Reuse connections across multiple query executions
5. **Error Recovery**: Automatic reconnection on temporary network loss

---

## Files Modified/Created

### Created:

- `frontend/src/common_Resources/M2ConnectionBar.jsx` (130 lines)

### Modified:

- `backend/module_2/routes.py` (+95 lines, new endpoints + state management)
- `frontend/src/App.jsx` (connection handlers, M2 state, tab logic updates)

### Unchanged:

- `db_config.json` (format remains compatible)
- `common/routes.py` (Module 1 endpoints unchanged)
- `common/db_utils.py` (validation functions reused)
