# Module 2: Quick Reference Guide

## 🚀 Quick Start (5 minutes)

### 1. Start Backend

```bash
cd backend
python app.py
# Server runs on http://localhost:5000
```

### 2. Start Frontend

```bash
cd frontend
npm start
# App opens on http://localhost:3000
```

### 3. Navigate to Module 2

- Click "SQL to SQL" in sidebar
- Follow 4-tab workflow

---

## 📋 File Structure Quick Ref

### Backend (backend/module_2/)

| File           | Purpose         | Key Function                                        |
| -------------- | --------------- | --------------------------------------------------- |
| db_loader.py   | DB queries      | `execute_query(env, db, query)`                     |
| key_mapper.py  | Key mapping     | `map_keys(src_df, tgt_df, src_key, tgt_key)`        |
| comparator.py  | Row comparison  | `compare_dataframes(src, tgt)`                      |
| summary.py     | Metrics         | `generate_summary(results, src_df, tgt_df)`         |
| highlighter.py | Colors          | `apply_cell_highlighting(table)`                    |
| exporter.py    | CSV export      | `export_full_reconciliation(...)`                   |
| service.py     | Orchestration   | `ReconciliationService.execute()`                   |
| controller.py  | API logic       | `ReconciliationController.process_reconciliation()` |
| routes.py      | Flask endpoints | 4 endpoints                                         |

### Frontend (frontend/src/module_2/)

| File                 | Purpose       | Props                       |
| -------------------- | ------------- | --------------------------- |
| EnvironmentTab.jsx   | Select env/db | m2State, setM2State, onNext |
| SqlQueryTab.jsx      | Enter queries | m2State, setM2State, onNext |
| KeysMappingTab.jsx   | Map keys      | m2State, setM2State, onNext |
| RunComparisonTab.jsx | Show results  | m2State, onReset            |

---

## 🔌 API Endpoints

```
GET  /api/m2/status
POST /api/m2/preview_query
POST /api/sql-compare
GET  /api/m2/export/{id}/{type}
```

---

## 📊 State Object (m2State)

```javascript
{
  // Environment
  source_env: "DEV",
  target_env: "QA",
  source_db: "PayDB",
  target_db: "PayDB",

  // Queries
  source_query: "SELECT * FROM emp",
  target_query: "SELECT * FROM employee",

  // Results
  source_columns: ["id", "name"],
  target_columns: ["emp_id", "name"],
  source_rows: [...],
  target_rows: [...],
  source_count: 1000,
  target_count: 950,

  // Status
  source_executed: true,
  target_executed: true,

  // Keys
  source_key: "id",
  target_key: "emp_id",
  keys_mapped: true
}
```

---

## 🎯 Tab Navigation Logic

```
Tab 1: environment   [ALWAYS ENABLED]
         ↓
Tab 2: sql-query     [ENABLED after env/db selection]
         ↓
Tab 3: keys-mapping  [ENABLED after both queries execute]
         ↓
Tab 4: run-comp      [ENABLED after key selection]
```

---

## 🔍 Comparison Result Structure

```javascript
{
  summary: {
    total_source: 1000,
    total_target: 950,
    matched: 920,
    missing_in_source: 30,
    missing_in_target: 0,
    column_mismatches: 15,
    reconciliation_rate: 92.0,
    discrepancy_rate: 8.0,
    status: "WARNINGS"
  },
  table_data: [
    { __COMMON_KEY__: "123", __STATUS__: "Matched", col1: "val1", ... },
    { __COMMON_KEY__: "456", __STATUS__: "Mismatched", col1: "val1", ... },
  ],
  styling: {
    row_styles: { "123": { bg_color: "#d4edda" }, ... },
    cell_styles: { ... },
    summary_colors: { matched: "#d4edda", mismatched: "#f8d7da", missing: "#fff3cd" }
  },
  record_count: 995,
  download_links: {
    full_csv: "/api/m2/export/abc123/full",
    mismatch_csv: "/api/m2/export/abc123/mismatches",
    detail_csv: "/api/m2/export/abc123/detail",
    summary_csv: "/api/m2/export/abc123/summary"
  }
}
```

---

## 🎨 Color Codes

| Status       | Color  | Hex     |
| ------------ | ------ | ------- |
| Matched      | Green  | #d4edda |
| Mismatched   | Red    | #f8d7da |
| Missing      | Yellow | #fff3cd |
| Status OK    | Green  | #28a745 |
| Status Error | Red    | #dc3545 |
| Status Warn  | Orange | #ffc107 |

---

## 🔑 Key Mapping Rules

- Case-insensitive column matching
- Whitespace trimmed
- NULL/NaN normalized to empty string
- Values converted to string for comparison
- Numeric values normalized (1750.0 → 1750)

---

## 📤 Export Formats

| Type       | Contents              | Use Case             |
| ---------- | --------------------- | -------------------- |
| full       | All rows + status     | Complete audit trail |
| mismatches | Only discrepancies    | Focus on problems    |
| detail     | Column-by-column diff | Root cause analysis  |
| summary    | Metrics only          | High-level reporting |

---

## ⚙️ Configuration (db_config.json)

```json
{
  "environments": [
    {
      "env_name": "DEV",
      "instances": [
        {
          "server_label": "Primary",
          "host": "dev-server\\SQLEXPRESS",
          "databases": ["PayDB", "RiskDB"]
        }
      ]
    }
  ]
}
```

---

## 🐛 Common Issues & Solutions

### Issue: "Environment not configured"

**Solution**: Add environment to db_config.json

### Issue: "Key column not found"

**Solution**: Verify column names in query results

### Issue: Slow query execution

**Solution**: Add LIMIT/TOP to test queries first

### Issue: Connection timeout

**Solution**: Check network connectivity, increase timeout

### Issue: Missing rows in results

**Solution**: Verify key mapping didn't miss rows

---

## 🧪 Test Queries

```sql
-- Test Query 1 (Source)
SELECT TOP 10
  EmployeeID as emp_id,
  FirstName,
  LastName,
  Salary
FROM HumanResources.Employee

-- Test Query 2 (Target)
SELECT TOP 10
  EmpID as emp_id,
  FirstName,
  LastName,
  BaseSalary as Salary
FROM dbo.EmployeeMaster
```

---

## 🔍 Debugging Tips

### Backend

```python
# Add to routes.py for debugging
import logging
logger = logging.getLogger(__name__)
logger.debug(f"Received: {request.json}")
```

### Frontend

```javascript
// Console logging
console.log("m2State:", m2State);
console.log("Results:", response.data);
```

### API Testing

```bash
# Test health
curl http://localhost:5000/api/m2/status

# Test preview
curl -X POST http://localhost:5000/api/m2/preview_query \
  -H "Content-Type: application/json" \
  -d '{"env":"DEV","database":"PayDB","query":"SELECT * FROM employees"}'
```

---

## 📈 Performance Tips

1. **Add WHERE clause** to reduce rows in preview
2. **Index key columns** for faster joining
3. **Use LIMIT 1000** for large tables first
4. **Select needed columns only** (avoid SELECT \*)
5. **Run during low-traffic periods** for best performance

---

## 🔒 Security Checklist

- ✅ Only SELECT queries allowed
- ✅ Environment credentials in config
- ✅ No hardcoded passwords
- ✅ Connection timeout enforced
- ✅ SQL injection prevention via parameterization
- ✅ Credentials validated against config

---

## 📚 Documentation Files

| File                         | Purpose                     |
| ---------------------------- | --------------------------- |
| MODULE_2_README.md           | Complete documentation      |
| INTEGRATION_GUIDE_MODULE2.js | Frontend-backend APIs       |
| DEPLOYMENT_CHECKLIST.md      | Deployment steps            |
| MODULE_2_COMPLETE.md         | Full implementation summary |
| QUICK_REFERENCE.md           | This file                   |

---

## 👥 Team Reference

### Backend Team

- Modify: `module_2/*.py`
- Run: `python app.py`
- Test: `curl /api/m2/...`

### Frontend Team

- Modify: `module_2/*.jsx`, `App.jsx`, `Sidebar.jsx`
- Run: `npm start`
- Test: Browser UI

### DevOps Team

- Deploy: Backend → Docker, Frontend → CDN
- Monitor: API endpoints, error logs
- Scale: Database connection pool

---

## 🎓 Learning Resources

### Backend (Python)

- `db_loader.py` - Start here for DB connectivity
- `comparator.py` - Pandas merge logic
- `service.py` - Orchestration pattern

### Frontend (React)

- `EnvironmentTab.jsx` - Simple selection UI
- `RunComparisonTab.jsx` - Complex result display
- `App.jsx` - State management

### Integration

- `routes.py` - API endpoint patterns
- `controller.py` - Request validation
- Network calls in JSX components

---

## 🚀 Version Info

- **Version**: 1.0
- **Status**: Production Ready
- **Python**: 3.8+
- **Node**: 14+
- **React**: 17+
- **Flask**: 2.0+
- **Pandas**: 1.3+

---

## 📞 Support

### Quick Help

1. Check MODULE_2_README.md
2. Review this Quick Reference
3. Look at DEPLOYMENT_CHECKLIST.md

### Issues

1. Check console/server logs
2. Verify db_config.json
3. Test endpoint directly with curl

### Questions

1. Review inline code comments
2. Check docstrings
3. Refer to full documentation

---

**Last Updated**: Feb 12, 2026
**Status**: ✅ Complete & Ready for Production
