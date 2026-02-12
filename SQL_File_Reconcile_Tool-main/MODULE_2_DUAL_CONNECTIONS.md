# Module 2: Multi-Server Reconciliation - Dual Connection Feature

## ✨ What's New?

Module 2 now supports **comparing data from DIFFERENT environments, databases, and even different servers**!

Instead of a single server connection, you can now:

- Connect to a **Source Server** (e.g., QA environment)
- Connect to a **Target Server** (e.g., UAT environment)
- **Compare their data** to find differences

---

## 🎯 Key Features

### 1. **Separate Source and Target Selection**

- Left column: Select Source Environment → Server → Auth
- Right column: Select Target Environment → Server → Auth
- Copy button to quickly mirror source settings to target

### 2. **Different Servers Support**

```
Example 1: Same server, different databases
  Source: QA_Server\PayDB
  Target: QA_Server\UserDB

Example 2: Different QA and UAT servers
  Source: QA_Cluster\PayDB
  Target: UAT_Cluster\PayDB

Example 3: Different SQL credentials
  Source: PROD (Windows Auth)
  Target: DR_SITE (SQL Auth with sa user)
```

### 3. **Independent Authentication**

Each server can have:

- Its own authentication type (Windows or SQL)
- Its own username/password credentials
- No need to match - they're completely separate

### 4. **Visual Status Indicators**

- **Source** column shows in blue
- **Target** column shows in orange
- Green status dots when connected
- Alert messages guide you

---

## 💡 Usage Example

### Scenario: Compare QA vs UAT Data

**Step 1: Select Source (QA)**

- Environment: `QA_Release_1`
- Server: `QA1_Payments_Server`
- Auth: Windows (no credentials needed)
- Click **Connect** (blue button)

**Step 2: Select Target (UAT)**

- Environment: `UAT_Phase_2`
- Server: `UAT1_Payments_Server`
- Auth: SQL Server (shows username/password fields)
- Enter credentials
- Click **Connect** (orange button)

**Step 3: Proceed to SQL Query Tab**

- Both connections active ✅
- Write source query: `SELECT * FROM table1`
- Write target query: `SELECT * FROM table2`
- Execute both and compare results

---

## 🔌 Connection Bar Layout

### Disconnected (Side-by-side)

```
┌─ SOURCE (Blue) ──────────────┬─ TARGET (Orange) ─────────────┐
│ [Environment ▼]              │ [Environment ▼]               │
│ [Server ▼]                   │ [Server ▼]                    │
│ [Username] [Password]        │ [Username] [Password]         │
│ [Connect] [Copy→]            │ [Connect]                     │
└──────────────────────────────┴───────────────────────────────┘
```

### Connected (Compact)

```
Source: QA1_Payments_Server       Target: UAT1_Payments_Server
[Disconnect Both]
```

---

## 📋 What Happens Behind the Scenes

### Before (Single Connection)

1. M2ConnectionBar connects to ONE server
2. All queries run against that ONE server
3. No real comparison possible

### After (Dual Connection)

1. **Source Connection**: POST `/api/m2/connect` with `connection_type: "source"`
   - Stored as `_m2_session_state['source_connected']`
   - Validates source credentials

2. **Target Connection**: POST `/api/m2/connect` with `connection_type: "target"`
   - Stored as `_m2_session_state['target_connected']`
   - Validates target credentials

3. **Queries Execute**:
   - Source query runs on source connection
   - Target query runs on target connection
   - Results compared locally

4. **Disconnect**: POST `/api/m2/disconnect`
   - Clears both connections
   - Resets UI state

---

## 🔐 Security Considerations

✓ **Separate Credentials**: Source and target can use different auth methods  
✓ **Validation**: Each connection validated independently  
✓ **Session Management**: Both connections tracked separately  
✓ **Timeout**: If either connection times out, both disconnect  
✓ **Secure**: Credentials never logged or exposed

---

## 🚀 SQL Query Tab Changes

SqlQueryTabM2 now receives `m2Connections` (not `m2Connection`):

```jsx
// Before:
m2Connection = {
  server: "localhost\\SQLEXPRESS",
};
// Single server only

// After:
m2Connections = {
  source: { server: "source.example.com", serverLabel: "Source_QA" },
  target: { server: "target.example.com", serverLabel: "Target_UAT" },
};
// Both servers available
```

---

## 📊 Use Cases Enabled

### 1. **Environment Reconciliation**

Compare same data across environments to check for consistency

### 2. **Database Migration Validation**

Compare old database with migrated database to verify completeness

### 3. **Replication Lag Detection**

Compare primary and replica to measure sync lag

### 4. **Product Comparison**

Compare different product versions' data structure

### 5. **Data Quality Audit**

Compare master data against transactional systems

---

## ⚙️ Configuration Integration

From `db_config.json`, you can set up multiple environments:

```json
{
  "environments": [
    {
      "env_name": "QA_Release_1",
      "instances": [
        {
          "server_label": "QA1_Payments",
          "host": "qa-server-1.domain.com",
          "databases": ["PayDB"]
        },
        {
          "server_label": "QA2_Backup",
          "host": "qa-server-2.domain.com",
          "databases": ["PayDB"]
        }
      ]
    },
    {
      "env_name": "UAT_Phase_2",
      "instances": [
        {
          "server_label": "UAT1_Payments",
          "host": "uat-server.domain.com",
          "databases": ["PayDB"],
          "username": "uat_user",
          "password": "uat_password"
        }
      ]
    }
  ]
}
```

Now you can compare any environment's server with any other!

---

## 🎛️ Comparison Scenarios

The new dual-connection support enables:

| Scenario           | Source       | Target       | Benefit                  |
| ------------------ | ------------ | ------------ | ------------------------ |
| QA vs UAT          | QA_Release_1 | UAT_Phase_2  | Test across environments |
| Primary vs Replica | PROD_Primary | PROD_Replica | Check data consistency   |
| Old vs New         | Legacy_DB    | Migration_DB | Validate migrations      |
| Test vs Prod       | TEST_Pool    | PROD_Cluster | Verify test data         |
| Cross-Region       | APAC_Server  | EMEA_Server  | Compare regional copies  |

---

## 🔄 Backward Compatibility

The update is fully backward compatible:

- Module 1 (SQL-to-File) unchanged
- Module 2 structure improved but flows the same
- Front-end UI adapted, not replaced
- All existing configurations work as-is

---

## 📝 Frontend Changes

### M2ConnectionBar.jsx

- Props changed from `m2Connection` → `m2Connections`
- Callback changed from `onConnected(conn)` → `onConnected("source|target", conn)`
- Layout changed from single row to two columns
- Added "Copy Source to Target" button for convenience

### App.jsx

- State changed from `m2Connection = null` → `m2Connections = { source, target }`
- Handlers updated to handle dual connections
- Tab enabling logic requires BOTH connections active

### Module 2 Tabs

- SqlQueryTabM2, RunComparisonTabM2 receive `m2Connections` object
- Can now access `.source` and `.target` servers separately

---

## 📊 Examples

### Example 1: Same Server, Different Databases

```
Source: QA1_Payments → Database: PayDB
Target: QA1_Payments → Database: UserDB

Use: Compare table_x in PayDB vs UserDB
Problem: Find structural differences
```

### Example 2: Different Servers

```
Source: QA-PROD → Database: MasterDB
Target: QA-DR → Database: MasterDB

Use: Verify disaster recovery copy
Problem: Check if DR is in sync
```

### Example 3: Cross-Environment Validation

```
Source: UAT_Server → Database: TestDB
Target: PROD_Server → Database: ProdDB

Use: Run same queries in both
Problem: Validate production data before deploy
```

---

## ✅ Tab Unlock Sequence

```
Environment (always enabled)
    ↓ (after both connections)
SQL Query (requires source + target)
    ↓ (after both queries executed)
Keys Mapping (requires both results)
    ↓ (after key mapping complete)
Run Comparison (fully configured)
    ↓ Execute reconciliation and view results
```

---

## 🎉 Summary

**What You Can Now Do:**

✅ Connect to different environments simultaneously  
✅ Query source and target independently  
✅ Compare results across servers  
✅ Use different authentication for each  
✅ Run environment-to-environment reconciliations

**Ready to use!** No additional setup needed beyond your existing `db_config.json`.
