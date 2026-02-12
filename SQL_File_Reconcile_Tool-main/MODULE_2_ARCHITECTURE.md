# Module 2 Connection Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  M2ConnectionBar Component                               │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  [Environment ▼] [Server ▼] [Username] [Password]       │  │
│  │  [Connect Button] or [Disconnect Button]                 │  │
│  │  Status: ● Connected / ● Disconnected                    │  │
│  │  Heartbeat: Every 30s                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ (on Connect)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  App.jsx State Management                                │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  m2Connection = {                                        │  │
│  │    server: "localhost\\SQLEXPRESS",                      │  │
│  │    env: "QA_Release_1",                                  │  │
│  │    port: 1433,                                           │  │
│  │    serverLabel: "QA1_Payments"                           │  │
│  │  }                                                        │  │
│  │                                                            │  │
│  │  Unlocks Tabs: [SQL Query] [Keys Mapping] [Run Compare]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ (pass to tabs)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SqlQueryTabM2, RunComparisonTabM2 (receive m2Connection)│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                     POST /api/m2/connect
                        (payload with
                      server, port, username,
                        password)
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Flask/Python)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  POST /api/m2/connect (module_2/routes.py)              │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  1. Extract: server, port, username, password           │  │
│  │  2. Credential Validation (gatekeeper)                  │  │
│  │     ├→ Check against db_config.json                     │  │
│  │     ├→ Return 401 if validation fails                   │  │
│  │  3. Build Connection String                             │  │
│  │     ├→ Windows Auth: Trusted_Connection=yes             │  │
│  │     ├→ SQL Auth: UID and PWD                            │  │
│  │  4. Test Connection with pyodbc                         │  │
│  │     ├→ Connect to 'master' database                     │  │
│  │     ├→ Close connection (just testing)                  │  │
│  │  5. Update _m2_session_state                            │  │
│  │     ├→ source_connected = True                          │  │
│  │     ├→ source_server = server host                      │  │
│  │     ├→ last_activity = time.time()                      │  │
│  │  6. Return 200 {success, message, info}                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Background Daemon: _m2_idle_checker()                  │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Every 30 seconds:                                       │  │
│  │    IF connected AND (now - last_activity) > timeout:   │  │
│  │      _m2_session_state['timed_out'] = True             │  │
│  │      _m2_session_state['source_connected'] = False     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Other Endpoints (require session)                      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  POST /api/m2/preview_query                             │  │
│  │    ├→ Execute query with connected server               │  │
│  │    ├→ Return rows/columns/count                         │  │
│  │  POST /api/sql-compare                                  │  │
│  │    ├→ Run full reconciliation                           │  │
│  │    ├→ Return comparison results                         │  │
│  │  GET /api/m2/export/<id>/<type>                         │  │
│  │    ├→ Download CSV/Excel export                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Database Layer (common/db_utils.py)                   │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  validate_credentials(server, username, password)      │  │
│  │    ├→ Lookup in db_config.json                          │  │
│  │    ├→ Compare with provided credentials                 │  │
│  │    ├→ Return True/False                                  │  │
│  │                                                            │  │
│  │  get_connection_string(server, db, port, ...)          │  │
│  │    ├→ Build ODBC connection string                      │  │
│  │    ├→ Windows Auth OR SQL Auth                          │  │
│  │    ├→ Return full connection string                     │  │
│  │                                                            │  │
│  │  pyodbc.connect(conn_str, timeout=5)                    │  │
│  │    ├→ Attempt actual database connection                │  │
│  │    ├→ Catch pyodbc.Error with SQLSTATE codes           │  │
│  │    ├→ Return connection object                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│           ↓                                      ↓               │
│     SQL Server (Windows/SQL Auth)      db_config.json        │  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

### Windows Authentication Path

```
User clicks "Connect"
    ↓
M2ConnectionBar extracts: {server, port}
(no username/password in payload)
    ↓
POST /api/m2/connect
    ↓
Backend builds connection string:
  "DRIVER={ODBC Driver 17 for SQL Server};
   SERVER=localhost\\SQLEXPRESS;
   Trusted_Connection=yes"
    ↓
pyodbc.connect() attempts connection
    ↓
SQL Server validates: Current Windows User
    ↓
✓ Connection Success OR ✗ Authentication Denied
```

### SQL Server Authentication Path

```
User clicks "Connect"
    ↓
M2ConnectionBar extracts: {server, port, username, password}
    ↓
POST /api/m2/connect
    ↓
Backend calls validate_credentials(server, username, password)
    ├→ Lookup in db_config.json
    ├→ REJECT with 401 if not found or mismatched
    ↓
IF credentials matched: continue
    ↓
Backend builds connection string:
  "DRIVER={ODBC Driver 17 for SQL Server};
   SERVER=localhost\\SQLEXPRESS;
   UID=sa;
   PWD=secret123"
    ↓
pyodbc.connect() attempts connection
    ↓
SQL Server validates: sa/secret123 against instance
    ↓
✓ Connection Success OR ✗ Authentication Denied
```

---

## Session State Management

### State Storage

```
Backend Memory (_m2_session_state)
{
  'source_connected': boolean,
  'target_connected': boolean,
  'source_server': "host\\instance",
  'source_database': "DatabaseName",
  'source_port': 1433,
  'source_username': "sa",
  'target_server': "host\\instance",
  'target_database': "DatabaseName",
  'target_port': 1433,
  'target_username': "sa",
  'last_activity': float (timestamp),
  'timed_out': boolean
}
```

### Timeout Mechanism

```
Background Thread (_m2_idle_checker)
├─ Runs every 30 seconds
├─ IF: connected AND (now - last_activity) > idle_timeout_minutes
│   └─ Set: timed_out = True, connected = False
└─ ENDIF

Activity Touch (_touch_m2_activity)
├─ Called on every API request
├─ Updates: last_activity = time.time()
└─ Clears: timed_out = False

Frontend Heartbeat
├─ GET /api/heartbeat every 30 seconds
├─ Receives: {connected, timed_out}
├─ IF timed_out: show warning and disconnect
├─ Triggers: _touch_m2_activity() to refresh timer
└─ Prevents timeout during active use
```

---

## Error Codes & Responses

### Success (200)

```json
{
  "status": "success",
  "message": "Successfully connected to localhost\\SQLEXPRESS",
  "info": "Authenticated via Windows Auth"
}
```

### Unauthorized (401)

```json
{
  "status": "error",
  "message": "Validation Failed: The entered credentials do not match..."
}
```

### Server Error (500)

```json
{
  "status": "error",
  "message": "Named Pipes Provider, error: 40 - Could not open connection..."
}
```

### Common SQLSTATE Errors

| Code  | Meaning           | Cause                                                 |
| ----- | ----------------- | ----------------------------------------------------- |
| 08001 | Connection Failed | Server unreachable, firewall, SQL Browser down        |
| 28000 | Auth Failed       | Invalid credentials or Windows user lacks permissions |
| HYT00 | Timeout           | Server exists but slow or network latency             |
| S0001 | Invalid DB        | Database doesn't exist on server                      |

---

## Configuration File Integration

When M2ConnectionBar loads:

```javascript
1. Component mounts
2. useEffect calls axios.get('/api/config')
3. Backend returns:
   {
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
     ],
     "auth_type": "windows",
     "idle_timeout_minutes": 10
   }
4. Component populates Environment dropdown
5. User selects Environment
6. Component populates Server dropdown from instances
7. Component detects auth type:
   - IF instance has username/password: sql_auth = true
   - ELSE: sql_auth = (global auth_type === 'sql')
8. Component shows/hides Username/Password fields accordingly
```

---

## Lifecycle Summary

```
App.jsx starts
│
├─ M2ConnectionBar renders
│  ├─ useEffect: load config
│  ├─ useEffect: start heartbeat (if connected)
│  └─ useEffect: register beforeunload listener
│
├─ User switches to Module 2
│  └─ m2Connection = null
│
├─ User enters: Environment → Server → Credentials
│  └─ handleConnect() calls POST /api/m2/connect
│
├─ Backend validates & connects
│  └─ Returns success with connection info
│
├─ Frontend calls handleM2Connected()
│  ├─ setM2Connection(conn)
│  ├─ Tabs unlock
│  └─ Heartbeat polling starts (every 30s)
│
├─ User works on queries in SQL Query tab
│  └─ Each API call triggers _touch_m2_activity()
│
├─ Idle timeout occurs (10 minutes)
│  └─ Background daemon sets timed_out = True
│
├─ Next heartbeat polls GET /api/heartbeat
│  └─ Receives {timed_out: true}
│     └─ Shows warning and calls handleM2Disconnected()
│        └─ setM2Connection(null)
│           └─ Tabs lock
│              └─ User must reconnect
│
└─ User closes browser or clicks Disconnect
   └─ navigator.sendBeacon() OR POST /api/m2/disconnect
      └─ Backend clears _m2_session_state
      └─ Frontend resets m2Connection = null
```

---

## Files Involved

### Frontend

- `App.jsx` - Main app state and handlers
- `common_Resources/M2ConnectionBar.jsx` - Connection UI
- `module_2/SqlQueryTab.jsx` - Receives m2Connection prop
- `module_2/KeysMappingTab.jsx` - Receives m2Connection prop
- `module_2/RunComparisonTab.jsx` - Receives m2Connection prop

### Backend

- `common/routes.py` - Shared endpoints (/api/config, /api/heartbeat, etc)
- `module_2/routes.py` - M2-specific endpoints (/api/m2/connect, /api/m2/disconnect, etc)
- `common/db_utils.py` - Credential validation, connection string building
- `common/storage_manager.py` - File management for exports

### Configuration

- `db_config.json` - Environment, server, and credential definitions
