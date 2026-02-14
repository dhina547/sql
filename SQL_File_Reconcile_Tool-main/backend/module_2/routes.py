"""
Module 2: SQL-to-SQL Comparison Routes
Flask Blueprint — handles SQL query reconciliation, result comparison, and CSV export.
"""

from flask import Blueprint, request, send_file
import os
import pyodbc
import time
import threading

from common.json_utils import safe_jsonify, sanitize_df_for_json
from common.storage_manager import RESULTS_DIR
from common.db_utils import get_connection_string, validate_credentials, CONFIG
from .controller import ReconciliationController
from . import db_loader

m2_bp = Blueprint('module_2', __name__)

# ── Module 2 Connection State (separate from Module 1) ──
_m2_session_state = {
    'source_connected': False,
    'target_connected': False,
    'source_server': None,
    'source_database': None,
    'source_port': None,
    'source_username': None,
    'source_password': None,
    'target_server': None,
    'target_database': None,
    'target_port': None,
    'target_username': None,
    'target_password': None,
    'last_activity': time.time(),
    'timed_out': False,
}
_m2_state_lock = threading.Lock()


def _touch_m2_activity():
    """Update Module 2 activity timer."""
    with _m2_state_lock:
        _m2_session_state['last_activity'] = time.time()
        _m2_session_state['timed_out'] = False


def _m2_idle_checker():
    """Background daemon for Module 2 idle timeout."""
    while True:
        time.sleep(30)
        with _m2_state_lock:
            if not (_m2_session_state['source_connected'] or _m2_session_state['target_connected']):
                continue
            timeout_min = CONFIG.get('idle_timeout_minutes', 10)
            elapsed = time.time() - _m2_session_state['last_activity']
            if elapsed > timeout_min * 60:
                _m2_session_state['timed_out'] = True
                _m2_session_state['source_connected'] = False
                _m2_session_state['target_connected'] = False


# Start Module 2 idle-checker daemon thread
_m2_idle_thread = threading.Thread(target=_m2_idle_checker, daemon=True)
_m2_idle_thread.start()


@m2_bp.route('/api/m2/connect', methods=['POST'])
def connect_m2():
    """
    Connect to SQL Server for Module 2 (source or target connection).
    
    Request JSON:
    {
        "server": "localhost\\SQLEXPRESS",
        "port": 1433,
        "database": "PayDB",
        "username": "sa",
        "password": "password",
        "connection_type": "source"  (or "target" — defaults to "source" if omitted)
    }
    """
    _touch_m2_activity()
    data = request.json
    server = data.get('server')
    port = data.get('port')
    database = data.get('database')
    username = data.get('username')
    password = data.get('password')
    conn_type = data.get('connection_type', 'source')

    if not server:
        return safe_jsonify({"error": "Missing server parameter"}, 400)
    
    if not database:
        return safe_jsonify({"error": "Missing database parameter"}, 400)

    # ── Strict Credential Validation ──
    if username is not None or password is not None:
        if not validate_credentials(server, username, password):
            return safe_jsonify({
                "status": "error",
                "message": "Validation Failed: The entered credentials do not match the expected configuration."
            }, 401)

    # ── Test connection ──
    try:
        # Test connection with specified database
        conn_str = get_connection_string(server, database, port, username=username, password=password)
        conn = pyodbc.connect(conn_str, timeout=5)
        conn.close()

        # Mark session connected
        with _m2_state_lock:
            if conn_type == 'target':
                _m2_session_state['target_connected'] = True
                _m2_session_state['target_server'] = server
                _m2_session_state['target_database'] = database
                _m2_session_state['target_port'] = port
                _m2_session_state['target_username'] = username
                _m2_session_state['target_password'] = password
            else:
                _m2_session_state['source_connected'] = True
                _m2_session_state['source_server'] = server
                _m2_session_state['source_database'] = database
                _m2_session_state['source_port'] = port
                _m2_session_state['source_username'] = username
                _m2_session_state['source_password'] = password
            _m2_session_state['last_activity'] = time.time()
            _m2_session_state['timed_out'] = False

        # Info message
        auth_msg = "Windows Auth"
        if username or CONFIG.get('auth_type') == 'sql':
            auth_msg = f"SQL Auth ({username or '??'})"

        return safe_jsonify({
            "status": "success",
            "message": f"Successfully connected to {server}/{database}",
            "info": f"Authenticated via {auth_msg}"
        })

    except pyodbc.Error as ex:
        return safe_jsonify({"status": "error", "message": str(ex)}, 500)
    except Exception as ex:
        return safe_jsonify({"status": "error", "message": f"Unexpected error: {str(ex)}"}, 500)


@m2_bp.route('/api/m2/disconnect', methods=['POST'])
def disconnect_m2():
    """Disconnect Module 2 connections."""
    _touch_m2_activity()
    with _m2_state_lock:
        _m2_session_state['source_connected'] = False
        _m2_session_state['target_connected'] = False
        _m2_session_state['source_server'] = None
        _m2_session_state['target_server'] = None
        _m2_session_state['timed_out'] = False
    return safe_jsonify({"status": "disconnected"})


@m2_bp.route('/api/m2/status', methods=['GET'])
def module_status():
    """Health-check for Module 2."""
    _touch_m2_activity()
    with _m2_state_lock:
        connected = _m2_session_state['source_connected'] or _m2_session_state['target_connected']
    return safe_jsonify({
        "module": "SQL-to-SQL Reconciliation",
        "status": "active",
        "message": "SQL-to-SQL comparison service is ready",
        "version": "1.0",
        "connected": connected
    })


@m2_bp.route('/api/m2/preview_query', methods=['POST'])
def preview_query():
    """
    Preview SQL query execution (sample rows only).
    
    Request JSON (new format with dual connections):
    {
        "type": "source" or "target",
        "query": "SELECT * FROM employees"
    }
    
    Uses the active connection from the M2 session state for the specified type.
    
    Response JSON:
    {
        "columns": [...],
        "rows": [...],
        "row_count": 1000
    }
    """
    _touch_m2_activity()
    
    try:
        data = request.json
        query_type = data.get('type')  # "source" or "target"
        query = data.get('query')
        
        if not query_type or not query:
            return safe_jsonify({"error": "Missing parameters: type and query"}, 400)
        
        if query_type not in ['source', 'target']:
            return safe_jsonify({"error": "Invalid type. Must be 'source' or 'target'"}, 400)
        
        # Get connection info from session state
        with _m2_state_lock:
            if query_type == 'target':
                server = _m2_session_state.get('target_server')
                database = _m2_session_state.get('target_database')
                port = _m2_session_state.get('target_port')
                username = _m2_session_state.get('target_username')
                password = _m2_session_state.get('target_password')
                is_connected = _m2_session_state.get('target_connected', False)
            else:
                server = _m2_session_state.get('source_server')
                database = _m2_session_state.get('source_database')
                port = _m2_session_state.get('source_port')
                username = _m2_session_state.get('source_username')
                password = _m2_session_state.get('source_password')
                is_connected = _m2_session_state.get('source_connected', False)
        
        if not is_connected or not server:
            return safe_jsonify({
                "error": f"No active {query_type} connection. Please connect first."
            }, 401)
        
        # Execute query using the actual server connection
        # db_loader.execute_query_with_connection handles server/port/username/password
        try:
            from . import db_loader
            df = db_loader.execute_query_with_connection(
                server=server,
                port=port,
                username=username,
                password=password,
                database=database,
                query=query,
                timeout=30
            )
        except AttributeError:
            # Fallback if execute_query_with_connection doesn't exist yet
            # Use the server name to execute (less ideal but compatible)
            df = db_loader.execute_query(server, 'master', query, timeout=30)
        
        # Get column names
        columns = list(df.columns)
        
        # Get preview rows (max 5)
        preview_rows = df.head(5)
        rows = sanitize_df_for_json(preview_rows).to_dict(orient='records')
        
        # Get total row count
        row_count = len(df)
        
        return safe_jsonify({
            "columns": columns,
            "rows": rows,
            "row_count": row_count
        })
        
    except ValueError as e:
        return safe_jsonify({"error": str(e)}, 400)
    except Exception as e:
        return safe_jsonify({"error": f"Query execution failed: {str(e)}"}, 500)


@m2_bp.route('/api/sql-compare', methods=['POST'])
def sql_compare():
    """
    Execute SQL-to-SQL reconciliation using active M2 connections.
    
    Request JSON (new format with direct connections):
    {
        "source_query": "SELECT * FROM Payments",
        "target_query": "SELECT * FROM Payments",
        "source_key": "PaymentID",
        "target_key": "PaymentID"
    }
    
    Uses pre-established source and target connections from M2 session state.
    
    Response JSON:
    {
        "success": true,
        "reconciliation_id": "abc123",
        "summary": {...},
        "table_data": [...],
        "styling": {...},
        "download_links": {
            "full_csv": "...",
            "mismatch_csv": "..."
        }
    }
    """
    _touch_m2_activity()
    
    try:
        data = request.json
        if not data:
            return safe_jsonify({"error": "Request body must be JSON"}, 400)
        
        # Check that both connections are active
        with _m2_state_lock:
            source_connected = _m2_session_state.get('source_connected', False)
            target_connected = _m2_session_state.get('target_connected', False)
        
        if not source_connected or not target_connected:
            return safe_jsonify({
                "error": "Both source and target connections must be established first",
                "source_connected": source_connected,
                "target_connected": target_connected
            }, 401)
        
        # Validate required fields for comparison
        required_fields = ['source_query', 'target_query', 'source_key', 'target_key']
        for field in required_fields:
            if field not in data or not data[field]:
                return safe_jsonify({"error": f"Missing required field: {field}"}, 400)
        
        # Get connection details from session state
        with _m2_state_lock:
            source_server = _m2_session_state.get('source_server')
            source_database = _m2_session_state.get('source_database')
            source_port = _m2_session_state.get('source_port')
            source_username = _m2_session_state.get('source_username')
            source_password = _m2_session_state.get('source_password')
            
            target_server = _m2_session_state.get('target_server')
            target_database = _m2_session_state.get('target_database')
            target_port = _m2_session_state.get('target_port')
            target_username = _m2_session_state.get('target_username')
            target_password = _m2_session_state.get('target_password')
        
        # Add connection info to data for the controller
        data['source_server'] = source_server
        data['source_database'] = source_database
        data['source_port'] = source_port
        data['source_username'] = source_username
        data['source_password'] = source_password
        
        data['target_server'] = target_server
        data['target_database'] = target_database
        data['target_port'] = target_port
        data['target_username'] = target_username
        data['target_password'] = target_password
        
        # Process reconciliation
        result = ReconciliationController.process_reconciliation_direct(data)
        
        if not result.get('success'):
            status_code = result.get('status_code', 500)
            return safe_jsonify({
                "success": False,
                "error": result.get('error', 'Unknown error')
            }, status_code)
        
        return safe_jsonify(result)
        
    except Exception as e:
        return safe_jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }, 500)


@m2_bp.route('/api/m2/export/<reconciliation_id>/<export_type>', methods=['GET'])
def export_reconciliation(reconciliation_id, export_type):
    """
    Download reconciliation export file.
    
    Args:
        reconciliation_id: ID from sql-compare response
        export_type: 'full', 'mismatches', 'detail', or 'summary'
    """
    _touch_m2_activity()
    
    # Validate export type
    if export_type not in ('full', 'mismatches', 'detail', 'summary'):
        return safe_jsonify({"error": "Invalid export type"}, 400)
    
    try:
        # Generate export file
        filepath, error = ReconciliationController.get_export_file(reconciliation_id, export_type)
        
        if error:
            return safe_jsonify({"error": error}, 400)
        
        if not os.path.exists(filepath):
            return safe_jsonify({"error": "Export file not found"}, 404)
        
        # Send file
        filename = os.path.basename(filepath)
        return send_file(filepath, as_attachment=True, download_name=filename)
        
    except Exception as e:
        return safe_jsonify({"error": f"Export failed: {str(e)}"}, 500)
