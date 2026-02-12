# Dual-Connection Quick Reference

## 🚀 Quick Start for Developers

### What Changed?

Module 2 can now connect to TWO different SQL servers simultaneously instead of just ONE.

### Key Files Modified

1. `frontend/src/module_2/SqlQueryTab.jsx` - Query execution screen
2. `frontend/src/module_2/RunComparisonTab.jsx` - Comparison results screen
3. `backend/module_2/routes.py` - API endpoints
4. `backend/module_2/db_loader.py` - Database execution

### What Was Added?

New function in `db_loader.py`:

```python
execute_query_with_connection(server, port, username, database, query, timeout=30)
```

---

## 🔑 Key Concepts

### Frontend State

```javascript
// OLD (single connection)
m2Connection = { server, port, username };

// NEW (dual connections)
m2Connections = {
  source: { server, port, username },
  target: { server, port, username },
};
```

### Backend Session State

```python
# Tracks two separate connections
_m2_session_state = {
    'source_server': "...",
    'source_port': ...,
    'source_username': "...",
    'source_connected': True/False,

    'target_server': "...",
    'target_port': ...,
    'target_username': "...",
    'target_connected': True/False,
}
```

### API Changes

#### Preview Query Endpoint

**OLD:**

```
POST /api/m2/preview_query
Body: { "env": "QA", "database": "PayDB", "query": "SELECT ..." }
```

**NEW:**

```
POST /api/m2/preview_query
Body: { "type": "source", "query": "SELECT ..." }
```

---

## 🔄 Data Flow Diagram

```
Frontend                Backend              Database
───────                 ───────              ────────

SqlQueryTab
  ├─ m2Connections.source ──┐
  │                         │
  └─ POST /api/m2/preview_query ────→ routes.py
                               │
                               ├─ Get source_server from session
                               │
                               └──→ db_loader.execute_query_with_connection()
                                         │
                                         └──→ pyodbc.connect(source_server)
                                                 │
                                                 └──→┌─────────────────────┐
                                                     │ Source SQL Server   │
                                                     │ (qa-server, port...) │
                                                     └─────────────────────┘
                                         ←─ DataFrame with results
                                   ←─ JSON response
                              ← Display results
```

---

## 💻 Code Snippets

### Connecting (Frontend)

```javascript
// M2ConnectionBar.jsx
axios.post("/api/m2/connect", {
  server: "qa-server.domain.com\\SQLEXPRESS",
  port: 1433,
  username: "sa",
  password: "password",
  connection_type: "source", // or "target"
});
```

### Executing Query (Frontend)

```javascript
// SqlQueryTab.jsx
axios.post("/api/m2/preview_query", {
  type: "source", // or "target"
  query: "SELECT * FROM Orders",
});
```

### Getting Connection Info (Backend)

```python
# routes.py - inside /api/m2/preview_query
with _m2_state_lock:
    server = _m2_session_state.get(f'{query_type}_server')
    port = _m2_session_state.get(f'{query_type}_port')
    username = _m2_session_state.get(f'{query_type}_username')
```

### Executing with Connection (Backend)

```python
# db_loader.py
df = execute_query_with_connection(
    server="qa-server.domain.com\\SQLEXPRESS",
    port=1433,
    username="sa",
    database="master",
    query="SELECT * FROM Orders",
    timeout=30
)
```

---

## 🧪 Testing Scenarios

### Test 1: Different Servers

```
1. Connect Source: "server-a.com\SQLEXPRESS" (QA)
2. Connect Target: "server-b.com\SQLEXPRESS" (UAT)
3. Write query: SELECT @@SERVERNAME
4. Execute both
5. Verify different server names in results
```

### Test 2: Different Databases

```
1. Connect Source: "server.com\INSTANCE" → Database A
2. Connect Target: "server.com\INSTANCE" → Database B
3. Write same query
4. Execute both
5. Verify different results (different databases)
```

### Test 3: Different Auth

```
1. Connect Source: Windows Auth (sa)
2. Connect Target: SQL Auth (uat_user)
3. Both should work independently
```

---

## 🐛 Debugging Tips

### Issue: "No active source connection"

**Solution:** Check that `_m2_session_state['source_connected'] = True`

### Issue: Query runs on wrong server

**Solution:** Verify `type` parameter in request is "source" or "target"

### Issue: Old env/db errors appearing

**Solution:** Hard refresh browser, clear cache to get new frontend code

### Issue: `execute_query_with_connection` not found

**Solution:** Restart backend server after updating db_loader.py

---

## 📋 Checklist for Modifications

When adding features using dual connections:

- [ ] Accept `m2Connections` prop (if UI component)
- [ ] Use `m2Connections.source` for source data
- [ ] Use `m2Connections.target` for target data
- [ ] Send `type: "source"|"target"` to backend
- [ ] In backend, read from `_m2_session_state[f'{type}_...']`
- [ ] Call `execute_query_with_connection()` not `execute_query()`
- [ ] Handle case where connection is not active
- [ ] Test with different servers

---

## 🔗 Related Files

| File                 | Purpose         | Key Changes                       |
| -------------------- | --------------- | --------------------------------- |
| App.jsx              | State + Routing | m2Connections object              |
| SqlQueryTab.jsx      | Query UI        | Uses type param                   |
| RunComparisonTab.jsx | Comparison UI   | Uses connection names             |
| routes.py            | API             | preview_query accepts type        |
| db_loader.py         | Execution       | New execute_query_with_connection |
| EnvironmentTab.jsx   | Connections UI  | M2ConnectionBar component         |

---

## 🎨 UI Changes

### Connection Bar

**Before (Single):**

```
[Environment ▼] [Server ▼] [Username] [Password] [Connect]
```

**After (Dual):**

```
SOURCE (Blue)                  TARGET (Orange)
[Env ▼] [Server ▼]            [Env ▼] [Server ▼]
[User] [Pass] [Connect]       [User] [Pass] [Connect]
[Copy Source to Target]
```

---

## 🚦 Status Indicators

### Session State Tracking

```python
_m2_session_state = {
    'source_connected': False,      # → Shows blue dot
    'target_connected': False,      # → Shows orange dot
    'source_server': None,          # → Displayed in UI
    'target_server': None,          # → Displayed in UI
    'last_activity': timestamp,     # → Resets on each API call
    'timed_out': False,            # → Auto-clears after 10 min idle
}
```

---

## 🔐 Security

### Validation (Both Approaches)

- ✅ SELECT-only queries (forbidden keywords blocked)
- ✅ 30-second execution timeout
- ✅ Credential validation at connection time
- ✅ 10-minute idle timeout
- ✅ Thread-safe session state (lock used)

### Credential Storage

- ⚠️ Credentials in session state (memory)
- ⚠️ NOT persisted to disk
- ⚠️ Cleared on disconnect or timeout
- ✅ HTTPS recommended in production

---

## 📊 Performance Considerations

| Operation     | Time      | Notes                       |
| ------------- | --------- | --------------------------- |
| Connect       | ~2-5s     | Validates connection        |
| Execute Query | ~5-30s    | Depends on query complexity |
| Compare       | ~2-10s    | Local comparison, no DB     |
| Timeout       | 30s query | 10min idle session          |

---

## 🎯 Common Tasks

### Adding a new dual-connection feature

1. **Frontend Component:**

   ```jsx
   const MyComponent = ({ m2Connections, m2State }) => {
     // Use m2Connections.source and m2Connections.target
   };
   ```

2. **API Endpoint:**

   ```python
   @m2_bp.route('/api/my-feature', methods=['POST'])
   def my_feature():
       query_type = request.json.get('type')  # "source" or "target"
       with _m2_state_lock:
           server = _m2_session_state.get(f'{query_type}_server')
       # Use server for execution
   ```

3. **Database Call:**
   ```python
   df = execute_query_with_connection(
       server=server,
       port=_m2_session_state.get(f'{query_type}_port'),
       username=_m2_session_state.get(f'{query_type}_username'),
       database='master',
       query=query
   )
   ```

---

## 🧩 Integration Points

### Props Passed Through Components

```
App.jsx (holder)
  ├─ M2ConnectionBar (setter) → onConnected(type, conn)
  ├─ SqlQueryTab (user) → m2Connections
  ├─ KeysMappingTab (user) → m2Connections
  └─ RunComparisonTab (user) → m2Connections
```

### State Updates

```javascript
// Handler in App.jsx
const handleM2Connected = (type, conn) => {
  setM2Connections((prev) => ({
    ...prev,
    [type]: conn,
  }));
};
```

---

## 📚 Documentation Links

- Feature Guide: [MODULE_2_DUAL_CONNECTIONS.md](MODULE_2_DUAL_CONNECTIONS.md)
- Testing Guide: [DUAL_CONNECTION_TESTING.md](DUAL_CONNECTION_TESTING.md)
- Architecture: [DUAL_CONNECTION_ARCHITECTURE.md](DUAL_CONNECTION_ARCHITECTURE.md)
- Implementation: [DUAL_CONNECTION_IMPLEMENTATION.md](DUAL_CONNECTION_IMPLEMENTATION.md)

---

## ✅ Verification Checklist

### Before Pushing Code

- [ ] No syntax errors (npm run build)
- [ ] No python syntax errors (python -m py_compile)
- [ ] Test connection flow works
- [ ] Test query execution on both servers
- [ ] Test comparison works
- [ ] Test disconnect clears both
- [ ] No console errors
- [ ] No 500 errors in backend logs

### Before Deploying

- [ ] All files updated
- [ ] Dependencies installed
- [ ] Backend restarted
- [ ] Frontend rebuilt
- [ ] Test in staging
- [ ] Check logs for errors
- [ ] Monitor first few connections

---

## 🎓 Quick Examples

### Get Server Name from Connection

```javascript
const serverName =
  m2Connections?.source?.serverLabel ||
  m2Connections?.source?.server ||
  "Unknown";
```

### Check Both Connected

```javascript
const bothConnected = m2Connections?.source && m2Connections?.target;
```

### Send Type and Query

```javascript
axios.post("/api/m2/preview_query", {
  type: sourceOrTarget, // "source" or "target"
  query: sqlQuery,
});
```

---

**For detailed info, see the full documentation files!**
