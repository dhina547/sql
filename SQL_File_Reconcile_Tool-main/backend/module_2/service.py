"""
Module 2: Reconciliation Service
Orchestrates SQL-to-SQL comparison workflow.
Coordinates all components: db_loader, key_mapper, comparator, summary, exporter, highlighter.
"""

import logging
from . import db_loader, key_mapper, comparator, summary, exporter, highlighter

logger = logging.getLogger(__name__)


class ReconciliationService:
    """
    High-level service that orchestrates SQL-to-SQL reconciliation.
    """
    
    def __init__(self, source_env=None, target_env=None, source_db=None, target_db=None,
                 source_query=None, target_query=None, source_key=None, target_key=None,
                 source_server=None, source_port=None, source_username=None, source_password=None,
                 target_server=None, target_port=None, target_username=None, target_password=None):
        """
        Initialize reconciliation service.
        
        Either provide environment names (source_env, target_env, source_db, target_db)
        or direct server details (source_server, source_port, etc.).
        
        Args:
            source_env (str): Source environment name
            target_env (str): Target environment name
            source_db (str): Source database name
            target_db (str): Target database name
            source_query (str): SQL query for source
            target_query (str): SQL query for target
            source_key (str): Source key column name
            target_key (str): Target key column name
            source_server (str): Source SQL Server address
            source_port (int): Source SQL Server port
            source_username (str): Source SQL Server username
            source_password (str): Source SQL Server password
            target_server (str): Target SQL Server address
            target_port (int): Target SQL Server port
            target_username (str): Target SQL Server username
            target_password (str): Target SQL Server password
            
        Raises:
            ValueError: If any parameters are invalid
        """
        # Environment-based initialization
        self.source_env = source_env
        self.target_env = target_env
        self.source_db = source_db
        self.target_db = target_db
        
        # Direct connection initialization
        self.source_server = source_server
        self.source_port = source_port
        self.source_username = source_username
        self.source_password = source_password
        self.target_server = target_server
        self.target_port = target_port
        self.target_username = target_username
        self.target_password = target_password
        
        self.source_query = source_query
        self.target_query = target_query
        self.source_key = source_key
        self.target_key = target_key
        
        # Validate inputs
        self._validate_inputs()
        
        # Results storage
        self.source_df = None
        self.target_df = None
        self.source_df_mapped = None
        self.target_df_mapped = None
        self.comparison_result = None
        self.comparison_table = None
        self.summary = None
        self.styling = None
    
    
    @classmethod
    def create_direct(cls, source_server, source_database, source_port, source_username, source_password,
                      target_server, target_database, target_port, target_username, target_password,
                      source_query, target_query, source_key, target_key):
        """
        Create a ReconciliationService with direct server connections.
        
        Args:
            source_server, source_port, source_username, source_password: Source connection details
            target_server, target_port, target_username, target_password: Target connection details
            source_query, target_query, source_key, target_key: Reconciliation queries and keys
            
        Returns:
            ReconciliationService: Configured service instance
        """
        instance = cls(
            source_db=source_database,
            target_db=target_database,
            source_query=source_query,
            target_query=target_query,
            source_key=source_key,
            target_key=target_key,
            source_server=source_server,
            source_port=source_port,
            source_username=source_username,
            source_password=source_password,
            target_server=target_server,
            target_port=target_port,
            target_username=target_username,
            target_password=target_password
        )
        return instance
    
    
    def _validate_inputs(self):
        """Validate initialization parameters."""
        # Check for environment-based initialization
        if self.source_env and self.target_env:
            if not self.source_db or not self.target_db:
                raise ValueError("Source and target databases must be specified")
        # Check for direct connection initialization
        elif self.source_server and self.target_server:
            # Ports can be None (uses default), so just check servers exist
            if not self.source_db or not self.target_db:
                raise ValueError("Source and target databases must be specified")
        else:
            raise ValueError("Either provide (source_env, target_env, source_db, target_db) or direct server details")
        
        if not self.source_query or not self.target_query:
            raise ValueError("Both SQL queries must be provided")
        if not self.source_key or not self.target_key:
            raise ValueError("Both key columns must be specified")
    
    
    def execute(self):
        """
        Execute the complete reconciliation workflow.
        
        Returns:
            dict: Reconciliation result with all data and metrics
            
        Raises:
            ValueError: If any step fails
        """
        if self.source_env:
            logger.info(f"Starting reconciliation: {self.source_env}/{self.source_db} -> {self.target_env}/{self.target_db}")
        else:
            logger.info(f"Starting reconciliation: {self.source_server}:{self.source_port}/{self.source_db} -> {self.target_server}:{self.target_port}/{self.target_db}")
        
        try:
            # Step 1: Load data from databases
            logger.info("Step 1: Loading data from databases...")
            self._load_data()
            
            # Step 2: Map keys
            logger.info("Step 2: Mapping key columns...")
            self._map_keys()
            
            # Step 3: Perform comparison
            logger.info("Step 3: Comparing datasets...")
            self._compare_data()
            
            # Step 4: Build comparison table
            logger.info("Step 4: Building comparison table...")
            self._build_table()
            
            # Step 5: Generate summary
            logger.info("Step 5: Generating summary...")
            self._generate_summary()
            
            # Step 6: Apply styling
            logger.info("Step 6: Applying styling...")
            self._apply_styling()
            
            logger.info("Reconciliation completed successfully")
            
            return self.get_result()
            
        except Exception as e:
            logger.error(f"Reconciliation failed: {str(e)}")
            raise
    
    
    def _load_data(self):
        """Load data from source and target databases."""
        # Handle direct connection mode (Module 2)
        if self.source_server:
            self.source_df = db_loader.execute_query_with_connection(
                server=self.source_server,
                port=self.source_port,
                username=self.source_username,
                password=self.source_password,
                database=self.source_db,
                query=self.source_query,
                timeout=30
            )
            
            self.target_df = db_loader.execute_query_with_connection(
                server=self.target_server,
                port=self.target_port,
                username=self.target_username,
                password=self.target_password,
                database=self.target_db,
                query=self.target_query,
                timeout=30
            )
        else:
            # Handle environment-based mode (Module 1)
            self.source_df = db_loader.execute_query(
                self.source_env,
                self.source_db,
                self.source_query
            )
            
            self.target_df = db_loader.execute_query(
                self.target_env,
                self.target_db,
                self.target_query
            )
        
        logger.info(f"Loaded {len(self.source_df)} rows from source")
        logger.info(f"Loaded {len(self.target_df)} rows from target")
    
    
    def _map_keys(self):
        """Map keys in both DataFrames to a common key name."""
        self.source_df_mapped, self.target_df_mapped = key_mapper.map_keys(
            self.source_df,
            self.target_df,
            self.source_key,
            self.target_key
        )
        
        logger.info(f"Keys mapped: {self.source_key} -> {self.target_key}")
    
    
    def _compare_data(self):
        """Perform the actual data comparison."""
        self.comparison_result = comparator.compare_dataframes(
            self.source_df_mapped,
            self.target_df_mapped,
            source_alias='Source',
            target_alias='Target'
        )
    
    
    def _build_table(self):
        """Build the comprehensive comparison table."""
        self.comparison_table = comparator.build_comparison_table(
            self.comparison_result,
            source_alias='Source',
            target_alias='Target'
        )
    
    
    def _generate_summary(self):
        """Generate reconciliation summary metrics."""
        self.summary = summary.generate_detailed_summary(
            self.comparison_result,
            self.source_df,
            self.target_df,
            source_env=self.source_env,
            target_env=self.target_env
        )
    
    
    def _apply_styling(self):
        """Apply highlighting and styling rules."""
        self.styling = highlighter.apply_cell_highlighting(self.comparison_table)
    
    
    def get_result(self):
        """
        Get the complete reconciliation result.
        
        Returns:
            dict: Result with summary, table data, and styling
        """
        if not self.summary:
            raise ValueError("Reconciliation not executed. Call execute() first.")
        
        # Convert DataFrame to records for JSON serialization
        table_records = self.comparison_table.to_dict(orient='records') if not self.comparison_table.empty else []
        
        return {
            'summary': self.summary,
            'table_data': table_records,
            'styling': self.styling,
            'record_count': len(table_records)
        }
    
    
    def export_full_csv(self, output_dir, file_id):
        """
        Export full reconciliation report to CSV.
        
        Args:
            output_dir (str): Output directory
            file_id (str): File identifier
            
        Returns:
            str: Path to exported file
        """
        if self.comparison_table is None:
            raise ValueError("No comparison results to export. Call execute() first.")
        
        return exporter.export_full_reconciliation(
            self.comparison_table,
            self.summary,
            output_dir,
            file_id
        )
    
    
    def export_mismatches_csv(self, output_dir, file_id):
        """
        Export mismatches-only report to CSV.
        
        Args:
            output_dir (str): Output directory
            file_id (str): File identifier
            
        Returns:
            str: Path to exported file
        """
        if self.comparison_table is None:
            raise ValueError("No comparison results to export. Call execute() first.")
        
        mismatch_df = comparator.get_mismatches_only(self.comparison_table)
        
        return exporter.export_mismatches_only(
            mismatch_df,
            self.summary,
            output_dir,
            file_id
        )
    
    
    def export_detail_csv(self, output_dir, file_id):
        """
        Export detailed mismatch report to CSV.
        
        Args:
            output_dir (str): Output directory
            file_id (str): File identifier
            
        Returns:
            str: Path to exported file
        """
        if self.comparison_result is None:
            raise ValueError("No comparison results to export. Call execute() first.")
        
        return exporter.create_mismatch_detail_report(
            self.comparison_result,
            output_dir,
            file_id,
            source_alias=self.source_env,
            target_alias=self.target_env
        )
