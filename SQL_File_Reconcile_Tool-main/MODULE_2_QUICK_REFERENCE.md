# Module 2 Connection - Quick Reference

## Component Usage

### M2ConnectionBar (Frontend)

```jsx
import M2ConnectionBar from "./common_Resources/M2ConnectionBar";

<M2ConnectionBar
  m2Connection={m2Connection}
  onConnected={handleM2Connected}
  onDisconnected={handleM2Disconnected}
/>;
```

### Receiving m2Connection in Tabs

```jsx
const SqlQueryTabM2 = ({ m2State, setM2State, m2Connection, onNext }) => {
  // m2Connection = { server, env, port, serverLabel }
  // Use it to identify which server is connected
  console.log(`Using server: ${m2Connection.server}`);
};
```

---

## Backend API Endpoints

### POST /api/m2/connect

**Purpose**: Authenticate and start Module 2 session

**Request**:

```json
{
  "server": "localhost\\SQLEXPRESS",
  "port": 1433,
  "username": "sa", // Optional for Windows Auth
  "password": "secret123" // Optional for Windows Auth
}
```

**Response (200)**:

```json
{
  "status": "success",
  "message": "Successfully connected to localhost\\SQLEXPRESS",
  "info": "Authenticated via Windows Auth"
}
```

**Response (401)**:

```json
{
  "status": "error",
  "message": "Validation Failed: credentials do not match"
}
```

---

### POST /api/m2/disconnect

**Purpose**: Close Module 2 session

**Request**: `{}`  
**Response (200)**: `{"status": "disconnected"}`

---

### GET /api/heartbeat

**Purpose**: Detect session timeout (shared with Module 1)

**Request**: None  
**Response**:

```json
{
  "connected": true,
  "timed_out": false
}
```

---

## State Management

### m2Connection (Frontend)

```javascript
// Initial
m2Connection = null;

// After connect
m2Connection = {
  server: "localhost\\SQLEXPRESS",
  env: "QA_Release_1",
  port: 1433,
  serverLabel: "QA1_Payments",
};

// After disconnect
m2Connection = null;
```

### \_m2_session_state (Backend)

```python
{
  'source_connected': bool,
  'target_connected': bool,
  'source_server': str,
  'source_port': int,
  'source_username': str,
  'target_server': str,
  'target_port': int,
  'target_username': str,
  'last_activity': float,  # timestamp
  'timed_out': bool
}
```

---

## Tab Locking

```javascript
const tabEnabled = (tabId) => {
  if (activeModule === "sql-to-sql") {
    if (tabId === "environment") return true; // Always
    if (tabId === "sql-query") return !!m2Connection;
    if (tabId === "keys-mapping")
      return m2Connection && m2State.source_executed && m2State.target_executed;
    if (tabId === "run-comparison")
      return (
        m2Connection &&
        m2State.keys_mapped &&
        m2State.source_key &&
        m2State.target_key
      );
  }
};
```

---

## Connection Lifecycle

```
1. M2ConnectionBar renders
2. User selects Environment → Server
3. User clicks Connect
4. Frontend: POST /api/m2/connect
5. Backend: validate_credentials()
6. Backend: pyodbc.connect() test
7. Backend: Update _m2_session_state
8. Frontend: setM2Connection(conn)
9. Tabs unlock
10. Heartbeat polling starts (every 30s)
11. User works on queries
12. Each API call: _touch_m2_activity()
13. 10 minutes idle: daemon sets timed_out=True
14. Next heartbeat: Frontend sees timed_out=True
15. Frontend: calls handleM2Disconnected()
16. OR: User clicks Disconnect
17. Frontend: POST /api/m2/disconnect
18. Backend: Clear _m2_session_state
19. Frontend: setM2Connection(null)
```

---

## Authentication Modes

### Windows Auth (Default)

```python
# Backend detects: instanceHasCreds = False AND auth_type = 'windows'
# Builds: "Trusted_Connection=yes"
# UI shows: No credential fields
# Fields locked: Username, Password hidden
```

### SQL Auth

```python
# Backend detects: instanceHasCreds = True OR auth_type = 'sql'
# Builds: "UID=sa;PWD=password"
# UI shows: Username, Password fields visible
# Validation: validate_credentials(server, username, password)
```

---

## Error Codes

| SQLSTATE | Meaning           | Solution                            |
| -------- | ----------------- | ----------------------------------- |
| 08001    | Connection failed | Check server, network, firewall     |
| 28000    | Auth failed       | Check credentials, user permissions |
| HYT00    | Timeout           | Server slow or network latency      |

---

## Configuration (db_config.json)

```json
{
  "auth_type": "windows",
  "idle_timeout_minutes": 10,
  "environments": [
    {
      "env_name": "QA_Release_1",
      "instances": [
        {
          "server_label": "QA1_Payments",
          "host": "localhost\\SQLEXPRESS",
          "port": 1433,
          "databases": ["PayDB"]
        }
      ]
    }
  ]
}
```

**Override per-instance auth**:

```json
{
  "server_label": "PROD_Primary",
  "host": "prod.domain.com",
  "username": "sa",
  "password": "secret123"
}
```

---

## Common Tasks

### Check if Connected

```jsx
if (m2Connection) {
  // User is authenticated
}
```

### Get Current Server

```jsx
const server = m2Connection.server;
const env = m2Connection.env;
const label = m2Connection.serverLabel;
```

### Force Disconnect

```jsx
handleM2Disconnected();
```

### Reset on Module Switch

```jsx
const handleModuleChange = (moduleId) => {
  setM2Connection(null); // Always reset
  // ... rest of logic
};
```

### Call API (requires connection)

```jsx
if (!m2Connection) {
  log("Please connect first", "error");
  return;
}

const res = await axios.post("/api/m2/preview_query", {
  // Your request
});
```

---

## Troubleshooting

| Issue             | Cause                 | Fix                                    |
| ----------------- | --------------------- | -------------------------------------- |
| Dropdowns empty   | No config             | Check db_config.json                   |
| No Password field | Windows Auth detected | Use Windows Auth OR override in config |
| Connection failed | Bad credentials       | Check against db_config.json           |
| Timeout warning   | Idle 10+ mins         | Click Reconnect                        |
| SQL tabs locked   | Not connected         | Use Connection Bar first               |

---

## Files to Know

| File                  | Purpose                            |
| --------------------- | ---------------------------------- |
| `App.jsx`             | Main connection state and handlers |
| `M2ConnectionBar.jsx` | Connection UI component            |
| `module_2/routes.py`  | Backend endpoints for Module 2     |
| `common/db_utils.py`  | Credential validation              |
| `db_config.json`      | Environment/server config          |

---

## Key Functions

### Frontend

```javascript
handleM2Connected(conn); // Called on successful connect
handleM2Disconnected(); // Called on disconnect
tabEnabled(tabId); // Checks if tab should be locked
```

### Backend

```python
@m2_bp.route('/api/m2/connect')      # POST endpoint
@m2_bp.route('/api/m2/disconnect')   # POST endpoint
validate_credentials()                 # Gatekeeper
_touch_m2_activity()                  # Reset idle timer
_m2_idle_checker()                    # Background timeout daemon
```

---

## Performance

- **Connection establishment**: < 5 seconds (timeout)
- **Heartbeat overhead**: Minimal (GET request, 30sec interval)
- **Session memory**: ~500 bytes per connected user
- **Timeout check**: Every 30 seconds (background)

---

📖 **For more details, see**: MODULE_2_ARCHITECTURE.md
