# Dual-Connection Architecture Integration

## Overview

Module 2 now supports **connecting to two different SQL servers simultaneously** and comparing their data. This document maps the complete data flow and all integration points.

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  App.jsx                                                        │
│  ├─ m2Connections: { source: {...}, target: {...} }           │
│  ├─ handleM2Connected(type, conn) → routes to source/target   │
│  └─ Passes m2Connections to all Module 2 tabs                 │
│                                                                 │
│  M2ConnectionBar.jsx                                           │
│  ├─ Two-column UI (Source | Target)                           │
│  ├─ POST /api/m2/connect with connection_type: "source|target" │
│  └─ Updates m2Connections state object                         │
│                                                                 │
│  SqlQueryTab.jsx                                               │
│  ├─ Accepts: m2Connections, m2State                           │
│  ├─ POST /api/m2/preview_query with type: "source|target"    │
│  └─ Displays server labels from m2Connections                 │
│                                                                 │
│  RunComparisonTab.jsx                                          │
│  ├─ Accepts: m2Connections, m2State                           │
│  ├─ POST /api/sql-compare with use_connections: true         │
│  └─ Shows actual server names in comparison logs              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    HTTP API (REST endpoints)
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
    /api/m2/connect    /api/m2/preview_query   /api/sql-compare
    (connection_type)  (type: "source|target") (use_connections)
         │                    │                    │
└─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Flask, Python)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  routes.py                                                      │
│  ├─ /api/m2/connect                                            │
│  │  ├─ Receives: server, port, connection_type, auth           │
│  │  └─ Updates: _m2_session_state[source|target_*]            │
│  │                                                              │
│  ├─ /api/m2/preview_query                                      │
│  │  ├─ Receives: type ("source"|"target"), query              │
│  │  ├─ Gets: server, port, username from session state         │
│  │  └─ Calls: execute_query_with_connection()                 │
│  │                                                              │
│  └─ /api/sql-compare                                           │
│     ├─ Receives: queries, keys, use_connections flag           │
│     └─ Calls: ReconciliationController.reconcile()             │
│                                                                 │
│  db_loader.py                                                   │
│  ├─ execute_query() [old] - uses env names from config        │
│  └─ execute_query_with_connection() [new] - uses server/port  │
│                                                                 │
│  Session State (_m2_session_state)                             │
│  ├─ source_connected: bool                                     │
│  ├─ source_server: str                                         │
│  ├─ source_port: int                                           │
│  ├─ source_username: str                                       │
│  ├─ target_connected: bool                                     │
│  ├─ target_server: str                                         │
│  ├─ target_port: int                                           │
│  └─ target_username: str                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │                    │
         └────────────────────┘
                  │
                  ▼
      ┌──────────────────────┐
      │   SQL Server(s)      │
      ├──────────────────────┤
      │ Source Server        │ (Different env/port/credentials)
      │ ├─ QA1_Cluster       │
      │ └─ Database A        │
      │                      │
      │ Target Server        │ (Different env/port/credentials)
      │ ├─ UAT1_Cluster      │
      │ └─ Database B        │
      └──────────────────────┘
```

---

## 🔄 Data Flow: Connection Phase

### Step 1: User Selects Source Server and Connects

```javascript
// Frontend: M2ConnectionBar.jsx
handleConnectSource() {
  axios.post('/api/m2/connect', {
    server: "qa-server.domain.com\\SQLEXPRESS",
    port: 1433,
    username: "sa",
    password: "password_qa",
    connection_type: "source"  // ← KEY: Specifies source
  })
}
```

### Step 2: Backend Receives and Stores Connection

```python
# Backend: routes.py - connect_m2()
if conn_type == 'target':
    _m2_session_state['target_connected'] = True
    _m2_session_state['target_server'] = "qa-server.domain.com\\SQLEXPRESS"
    _m2_session_state['target_port'] = 1433
    _m2_session_state['target_username'] = "sa"
else:  # source
    _m2_session_state['source_connected'] = True
    _m2_session_state['source_server'] = "qa-server.domain.com\\SQLEXPRESS"
    _m2_session_state['source_port'] = 1433
    _m2_session_state['source_username'] = "sa"
```

### Step 3: Frontend State Updates

```javascript
// Frontend: App.jsx
const handleM2Connected = (type, conn) => {
  // type = "source" or "target"
  // conn = { server, serverLabel, port, etc. }
  setM2Connections((prev) => ({
    ...prev,
    [type]: conn, // Updates m2Connections.source or m2Connections.target
  }));
};
```

### Step 4: UI Updates

```jsx
// Frontend: M2ConnectionBar.jsx renders
Source (Blue)                    Target (Orange)
✓ qa-server.domain.com           [Environment ▼]
  [Disconnect Both]              [Server ▼]
                                 [Username] [Password]
                                 [Connect]
```

---

## 🔄 Data Flow: Query Execution Phase

### Step 1: User Enters and Executes Source Query

```javascript
// Frontend: SqlQueryTab.jsx
handleExecuteQuery("source") {
  // Uses the actual server from m2Connections.source
  axios.post('/api/m2/preview_query', {
    type: "source",  // ← KEY: Specifies which connection to use
    query: "SELECT COUNT(*) FROM dbo.Orders"
  })
}
```

### Step 2: Backend Retrieves Connection and Executes

```python
# Backend: routes.py - preview_query()
query_type = data.get('type')  # "source"
with _m2_state_lock:
    server = _m2_session_state.get('source_server')
    port = _m2_session_state.get('source_port')
    username = _m2_session_state.get('source_username')
    is_connected = _m2_session_state.get('source_connected', False)

# Execute query using actual server connection
df = db_loader.execute_query_with_connection(
    server=server,
    port=port,
    username=username,
    database='master',
    query=query,
    timeout=30
)
```

### Step 3: Backend Function Creates Connection

```python
# Backend: db_loader.py - execute_query_with_connection()
def execute_query_with_connection(server, port, username, database, query):
    conn_str = get_connection_string(
        server=server,        # "qa-server.domain.com\\SQLEXPRESS"
        database=database,    # "master"
        port=port,           # 1433
        username=username,   # "sa"
        password=None        # Using existing session auth
    )
    conn = pyodbc.connect(conn_str, timeout=timeout)
    df = pd.read_sql(query, conn)
    return df
```

### Step 4: Results Returned

```json
{
  "columns": ["column1", "column2"],
  "rows": [
    { "column1": "value1", "column2": "value2" },
    ...
  ],
  "row_count": 1000
}
```

### Step 5: Frontend Displays Results

```jsx
// Frontend: SqlQueryTab.jsx
Source Query (qa-server.domain.com)
[TEXT AREA with query]
[Execute] ✓ 1000 rows

Target Query (uat-server.domain.com)
[TEXT AREA with query]
[Execute] (waiting for execution)
```

---

## 🔄 Data Flow: Comparison Phase

### Step 1: User Initiates Comparison

```javascript
// Frontend: RunComparisonTab.jsx
handleRun() {
  axios.post('/api/sql-compare', {
    source_query: "SELECT * FROM Orders WHERE OrderDate > ...",
    target_query: "SELECT * FROM Orders WHERE OrderDate > ...",
    source_key: "OrderID",
    target_key: "OrderID",
    use_connections: true  // ← New flag for dual connections
  })
}
```

### Step 2: Backend Calls Service with Dual Queries

```python
# Backend: routes.py - sql_compare()
if data.get('use_connections'):
    # New path: Execute queries using session state connections
    # Get source and target queries already executed
    # Compare locally
    pass
else:
    # Old path: Execute queries from env/db
    pass
```

### Step 3: Service Compares Results

```python
# Backend: service.py (or future update)
source_results = execute_source_query()  # Uses source_server from session
target_results = execute_target_query()  # Uses target_server from session

comparison = reconcile(source_results, target_results, keys)
# Returns: matched, mismatched, missing records
```

### Step 4: Results Returned and Displayed

```
Comparison Results
Matched: 950 records (98.4%)
Mismatched: 10 records (1.0%)
Missing in Target: 5 records (0.6%)
```

---

## 📋 Request/Response Examples

### Example 1: Connect to Source

**Request:**

```json
{
  "server": "qa-server.domain.com\\SQLEXPRESS",
  "port": 1433,
  "username": "sa",
  "password": "qa_password",
  "connection_type": "source"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Successfully connected to qa-server.domain.com\\SQLEXPRESS",
  "info": "Authenticated via SQL Auth (sa)"
}
```

### Example 2: Execute Source Query

**Request:**

```json
{
  "type": "source",
  "query": "SELECT * FROM Orders WHERE Status = 'Active'"
}
```

**Response:**

```json
{
  "columns": ["OrderID", "CustomerID", "Amount", "Status"],
  "rows": [
    { "OrderID": 1, "CustomerID": 100, "Amount": 1000.0, "Status": "Active" },
    { "OrderID": 2, "CustomerID": 101, "Amount": 2000.0, "Status": "Active" }
  ],
  "row_count": 2
}
```

### Example 3: Run Comparison

**Request:**

```json
{
  "source_query": "SELECT * FROM Orders",
  "target_query": "SELECT * FROM Orders",
  "source_key": "OrderID",
  "target_key": "OrderID",
  "use_connections": true
}
```

**Response:**

```json
{
  "success": true,
  "reconciliation_id": "rec_12345",
  "record_count": 1000,
  "summary": {
    "matched": 950,
    "mismatched": 30,
    "missing_in_target": 20
  },
  "table_data": [...]
}
```

---

## 🔐 Security Considerations

### Connection Isolation

- Each connection is stored separately in session state
- No cross-contamination between source and target queries
- Credentials validated at connection time

### Query Execution

- Only SELECT queries allowed (validated in db_loader)
- Forbidden keywords blocked: DROP, DELETE, INSERT, UPDATE, etc.
- Timeout protection (30 seconds default)

### Session Management

- Idle timeout: Connections auto-disconnect after 10 minutes
- Manual disconnect: /api/m2/disconnect clears both
- Heartbeat: Every API call touches activity timer

---

## 🔄 State Management

### Frontend State (App.jsx)

```javascript
const [m2Connections, setM2Connections] = useState(null);
// After both connections:
// m2Connections = {
//   source: {
//     server: "qa-server.domain.com\\SQLEXPRESS",
//     serverLabel: "QA1_Payments",
//     port: 1433,
//     username: "sa"
//   },
//   target: {
//     server: "uat-server.domain.com\\SQLEXPRESS",
//     serverLabel: "UAT1_Payments",
//     port: 1433,
//     username: "qa_user"
//   }
// }

const [m2State, setM2State] = useState({
  source_query: "",
  target_query: "",
  source_columns: [],
  target_columns: [],
  source_rows: [],
  target_rows: [],
  source_executed: false,
  target_executed: false,
  source_count: 0,
  target_count: 0,
  source_key: null,
  target_key: null,
  keys_mapped: false,
});
```

### Backend State (routes.py)

```python
_m2_session_state = {
    'source_connected': True,         # After source connection
    'source_server': "qa-server.domain.com\\SQLEXPRESS",
    'source_port': 1433,
    'source_username': "sa",

    'target_connected': True,         # After target connection
    'target_server': "uat-server.domain.com\\SQLEXPRESS",
    'target_port': 1433,
    'target_username': "qa_user",

    'last_activity': 1234567890,      # Timestamp for timeout
    'timed_out': False,               # Idle state
}
```

---

## 📊 Component Integration

| Component        | Receives               | Sends                      | Purpose                        |
| ---------------- | ---------------------- | -------------------------- | ------------------------------ |
| M2ConnectionBar  | m2Connections          | onConnected(type, conn)    | User connects source/target    |
| SqlQueryTab      | m2Connections, m2State | POST /api/m2/preview_query | Execute queries on each server |
| KeysMappingTab   | m2State                | Key mappings               | Define comparison keys         |
| RunComparisonTab | m2Connections, m2State | POST /api/sql-compare      | Compare results                |
| App.jsx          | (state holder)         | Routes props to all tabs   | Coordinator                    |

---

## 🚀 Backward Compatibility

### Old Code (Environment-based)

```python
# Old approach: Query via environment name
execute_query(env="QA", database="PayDB", query="SELECT ...")
```

### New Code (Connection-based)

```python
# New approach: Direct server connection
execute_query_with_connection(
    server="qa-server.com\\SQLEXPRESS",
    port=1433,
    username="sa",
    database="PayDB",
    query="SELECT ..."
)
```

### Fallback Handling

If `execute_query_with_connection()` doesn't exist:

```python
try:
    df = db_loader.execute_query_with_connection(...)
except AttributeError:
    # Fallback to environment-based approach
    df = db_loader.execute_query(server, 'master', query)
```

---

## 📈 Benefits of Dual-Connection Architecture

1. **Independence**: Source and target are completely independent
2. **Flexibility**: Can use different servers, ports, and credentials
3. **Scalability**: Supports any environment combination
4. **Clarity**: UI clearly shows source vs target
5. **Reliability**: Connection failures don't cascade

---

## 🔧 Troubleshooting Integration Points

| Symptom                    | Check                      | Fix                                   |
| -------------------------- | -------------------------- | ------------------------------------- |
| Connected but query fails  | Session state has server   | Verify credentials at connection time |
| Wrong server used          | connection_type in request | Check backend receives type parameter |
| Stale results              | Activity timer             | Click something to refresh            |
| Different results on retry | Cache                      | Connections are fresh each time       |

---

## 📚 Files Involved

**Frontend:**

- `src/App.jsx` - Main state and routing
- `src/module_2/EnvironmentTab.jsx` - M2ConnectionBar component
- `src/module_2/SqlQueryTab.jsx` - Query execution UI
- `src/module_2/RunComparisonTab.jsx` - Comparison UI

**Backend:**

- `backend/module_2/routes.py` - API endpoints
- `backend/module_2/db_loader.py` - Database execution
- `backend/module_2/controller.py` - Reconciliation logic (future updates)
- `backend/module_2/service.py` - Business logic (future updates)

**Configuration:**

- `backend/db_config.json` - Server configuration (unchanged)
