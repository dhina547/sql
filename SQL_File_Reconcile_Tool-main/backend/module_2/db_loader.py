"""
Module 2: Database Loader
Executes SQL queries across different environments and loads results into Pandas DataFrames.
Handles connection management and query validation.
"""

import pyodbc
import pandas as pd
from common.db_utils import CONFIG, get_connection_string


def load_environment_databases():
    """
    Load all available environments from config.
    
    Returns:
        dict: {env_name: [{server_label, host, databases}, ...], ...}
    """
    environments = {}
    for env in CONFIG.get('environments', []):
        env_name = env.get('env_name')
        instances = env.get('instances', [])
        environments[env_name] = instances
    return environments


def validate_environment(env_name):
    """
    Validate that an environment exists in config.
    
    Args:
        env_name (str): Environment name from config
        
    Returns:
        bool: True if environment exists
        
    Raises:
        ValueError: If environment not found
    """
    environments = load_environment_databases()
    if env_name not in environments:
        raise ValueError(f"Environment '{env_name}' not configured. Available: {list(environments.keys())}")
    return True


def get_env_connection_string(env_name, database):
    """
    Get connection string for a specific environment and database.
    Uses the first instance (primary server) of the environment.
    
    Args:
        env_name (str): Environment name
        database (str): Database name
        
    Returns:
        str: ODBC connection string
        
    Raises:
        ValueError: If environment or database not found
    """
    environments = load_environment_databases()
    
    if env_name not in environments:
        raise ValueError(f"Environment '{env_name}' not configured")
    
    instances = environments[env_name]
    if not instances:
        raise ValueError(f"No instances configured for environment '{env_name}'")
    
    # Use first instance as primary
    instance = instances[0]
    server = instance.get('host')
    port = instance.get('port')
    username = instance.get('username')
    password = instance.get('password')
    
    if not server:
        raise ValueError(f"No server configured for environment '{env_name}'")
    
    conn_str = get_connection_string(
        server=server,
        database=database,
        port=port,
        username=username,
        password=password
    )
    return conn_str


def execute_query(env_name, database, query, timeout=30):
    """
    Execute a SQL query against a specific environment/database.
    
    Args:
        env_name (str): Environment name
        database (str): Database name
        query (str): SQL SELECT query
        timeout (int): Connection timeout in seconds
        
    Returns:
        pd.DataFrame: Query results
        
    Raises:
        ValueError: If environment/database not found
        pyodbc.Error: If query execution fails
    """
    # Validate inputs
    validate_environment(env_name)
    
    # Security check: only SELECT queries allowed
    forbidden_keywords = [
        'DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE',
        'ALTER', 'GRANT', 'REVOKE', 'EXEC', 'CREATE', 'MERGE'
    ]
    if any(keyword in query.upper() for keyword in forbidden_keywords):
        raise ValueError("Security error: Only SELECT queries are permitted")
    
    if not query.strip().upper().startswith('SELECT'):
        raise ValueError("Only SELECT queries are supported")
    
    try:
        conn_str = get_env_connection_string(env_name, database)
        conn = pyodbc.connect(conn_str, timeout=timeout)
        
        # Load results into DataFrame
        df = pd.read_sql(query, conn)
        conn.close()
        
        return df
        
    except pyodbc.Error as e:
        raise ValueError(f"Database error in {env_name}/{database}: {str(e)}")
    except Exception as e:
        raise ValueError(f"Error executing query: {str(e)}")


def get_database_list(env_name):
    """
    Get list of available databases for an environment.
    
    Args:
        env_name (str): Environment name
        
    Returns:
        list: Database names configured for this environment
        
    Raises:
        ValueError: If environment not found
    """
    environments = load_environment_databases()
    
    if env_name not in environments:
        raise ValueError(f"Environment '{env_name}' not configured")
    
    instances = environments[env_name]
    databases = set()
    
    for instance in instances:
        dbs = instance.get('databases', [])
        databases.update(dbs)
    
    return sorted(list(databases))


def execute_query_with_connection(server, port, username, password, database, query, timeout=30):
    """
    Execute a SQL query using explicit connection details (for dual-connection setup).
    
    Args:
        server (str): SQL Server hostname (e.g., "localhost\\SQLEXPRESS")
        port (int): SQL Server port (optional)
        username (str): Username for SQL authentication (optional for Windows auth)
        password (str): Password for SQL authentication (optional for Windows auth)
        database (str): Database name
        query (str): SQL SELECT query
        timeout (int): Connection timeout in seconds
        
    Returns:
        pd.DataFrame: Query results
        
    Raises:
        ValueError: If query validation fails
        pyodbc.Error: If query execution fails
    """
    # Security check: only SELECT queries allowed
    forbidden_keywords = [
        'DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE',
        'ALTER', 'GRANT', 'REVOKE', 'EXEC', 'CREATE', 'MERGE'
    ]
    if any(keyword in query.upper() for keyword in forbidden_keywords):
        raise ValueError("Security error: Only SELECT queries are permitted")
    
    if not query.strip().upper().startswith('SELECT'):
        raise ValueError("Only SELECT queries are supported")
    
    try:
        # Create connection string from explicit parameters
        conn_str = get_connection_string(
            server=server,
            database=database,
            port=port,
            username=username,
            password=password
        )
        
        conn = pyodbc.connect(conn_str, timeout=timeout)
        
        # Load results into DataFrame
        df = pd.read_sql(query, conn)
        conn.close()
        
        return df
        
    except pyodbc.Error as e:
        raise ValueError(f"Database error on {server}/{database}: {str(e)}")
    except Exception as e:
        raise ValueError(f"Error executing query: {str(e)}")
