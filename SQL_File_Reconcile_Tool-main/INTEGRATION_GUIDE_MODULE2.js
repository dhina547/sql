/**
 * Module 2: Frontend-Backend Integration Guide
 *
 * FRONTEND COMPONENTS:
 *
 * 1. EnvironmentTab.jsx
 *    - Allows user to select source and target environments
 *    - Allows selection of source and target databases
 *    - State: source_env, target_env, source_db, target_db
 *    - Navigates to: SqlQueryTab
 *
 * 2. SqlQueryTab.jsx
 *    - User enters two SQL queries (source and target)
 *    - Calls: POST /api/m2/preview_query (to preview each query)
 *    - Displays: Column count, row count from query
 *    - State: source_query, target_query, source_columns, target_columns,
 *             source_executed, target_executed, source_count, target_count
 *    - Navigates to: KeysMappingTab
 *
 * 3. KeysMappingTab.jsx
 *    - User selects primary key from source columns
 *    - User selects primary key from target columns
 *    - These keys are used to match rows across queries
 *    - State: source_key, target_key, keys_mapped
 *    - Navigates to: RunComparisonTab
 *
 * 4. RunComparisonTab.jsx
 *    - Calls: POST /api/sql-compare (Main reconciliation endpoint)
 *    - Displays: Summary, matched rows, mismatched rows, missing rows
 *    - Allows Export:
 *      - GET /api/m2/export/{reconciliation_id}/full
 *      - GET /api/m2/export/{reconciliation_id}/mismatches
 *      - GET /api/m2/export/{reconciliation_id}/detail
 *      - GET /api/m2/export/{reconciliation_id}/summary
 *
 *
 * BACKEND ENDPOINTS:
 *
 * 1. GET /api/m2/status
 *    - Health check
 *    - Response: { module, status, message, version }
 *
 * 2. POST /api/m2/preview_query
 *    - Preview SQL query results
 *    - Request: { env, database, query }
 *    - Response: { columns, rows, row_count }
 *
 * 3. POST /api/sql-compare
 *    - Execute SQL-to-SQL reconciliation
 *    - Request: {
 *        source_env, target_env, source_db, target_db,
 *        source_query, target_query, source_key, target_key
 *      }
 *    - Response: {
 *        success, reconciliation_id, summary, table_data, styling,
 *        record_count, download_links
 *      }
 *
 * 4. GET /api/m2/export/{reconciliation_id}/{export_type}
 *    - Download reconciliation results as CSV
 *    - export_type: 'full', 'mismatches', 'detail', 'summary'
 *    - Returns: CSV file
 *
 *
 * DATA FLOW:
 *
 * Step 1: Environment Selection
 *   User → EnvironmentTab → m2State (env/db selection)
 *
 * Step 2: Query Execution
 *   User → SqlQueryTab → POST /api/m2/preview_query (per query)
 *   Response → m2State (columns, rows, count)
 *
 * Step 3: Key Mapping
 *   User → KeysMappingTab → m2State (key selections)
 *
 * Step 4: Run Comparison
 *   User → RunComparisonTab → POST /api/sql-compare
 *   Backend:
 *     - db_loader.execute_query() → DataFrame
 *     - key_mapper.map_keys() → Normalized keys
 *     - comparator.compare_dataframes() → Results
 *     - summary.generate_summary() → Metrics
 *     - highlighter.apply_cell_highlighting() → Styling
 *   Response → Display results with styling
 *
 * Step 5: Export Results
 *   User → RunComparisonTab → GET /api/m2/export/{id}/{type}
 *   Backend: exporter.export_*() → CSV file
 *   Browser: Download file
 *
 */
