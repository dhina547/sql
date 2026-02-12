"""
Module 2: Controller
Handles API request/response logic for SQL-to-SQL reconciliation.
Manages validation, service orchestration, and response formatting.
"""

import uuid
from .service import ReconciliationService
from common.storage_manager import save_df, load_df, RESULTS_DIR
from common.json_utils import sanitize_df_for_json


class ReconciliationController:
    """
    Controller for SQL-to-SQL reconciliation API.
    Handles all HTTP request/response logic.
    """
    
    @staticmethod
    def validate_request(data):
        """
        Validate incoming API request.
        
        Args:
            data (dict): Request JSON data
            
        Returns:
            tuple: (is_valid, error_message)
        """
        required_fields = [
            'source_env', 'target_env',
            'source_db', 'target_db',
            'source_query', 'target_query',
            'source_key', 'target_key'
        ]
        
        for field in required_fields:
            if field not in data or not data[field]:
                return False, f"Missing required field: {field}"
        
        # Validate query strings (must start with SELECT)
        source_query = data['source_query'].strip()
        target_query = data['target_query'].strip()
        
        if not source_query.upper().startswith('SELECT'):
            return False, "Source query must be a SELECT statement"
        
        if not target_query.upper().startswith('SELECT'):
            return False, "Target query must be a SELECT statement"
        
        return True, None
    
    
    @staticmethod
    def process_reconciliation(request_data):
        """
        Process a reconciliation request end-to-end.
        
        Args:
            request_data (dict): Request payload with all reconciliation parameters
            
        Returns:
            dict: Response object with results or error
        """
        # Validate request
        is_valid, error_msg = ReconciliationController.validate_request(request_data)
        if not is_valid:
            return {
                'success': False,
                'error': error_msg,
                'status_code': 400
            }
        
        # Generate unique reconciliation ID
        reconciliation_id = str(uuid.uuid4())[:8]
        
        try:
            # Create service instance
            service = ReconciliationService(
                source_env=request_data['source_env'],
                target_env=request_data['target_env'],
                source_db=request_data['source_db'],
                target_db=request_data['target_db'],
                source_query=request_data['source_query'],
                target_query=request_data['target_query'],
                source_key=request_data['source_key'],
                target_key=request_data['target_key']
            )
            
            # Execute reconciliation
            result = service.execute()
            
            # Save results for later retrieval/export
            ReconciliationController._save_reconciliation_data(
                reconciliation_id,
                service,
                result
            )
            
            # Format response
            response = {
                'success': True,
                'reconciliation_id': reconciliation_id,
                'summary': result['summary'],
                'table_data': result['table_data'],
                'styling': result['styling'],
                'record_count': result['record_count'],
                'download_links': {
                    'full_csv': f'/api/m2/export/{reconciliation_id}/full',
                    'mismatch_csv': f'/api/m2/export/{reconciliation_id}/mismatches',
                    'detail_csv': f'/api/m2/export/{reconciliation_id}/detail',
                    'summary_csv': f'/api/m2/export/{reconciliation_id}/summary'
                }
            }
            
            return response
            
        except ValueError as e:
            return {
                'success': False,
                'error': str(e),
                'status_code': 400
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Reconciliation failed: {str(e)}",
                'status_code': 500
            }
    
    
    @staticmethod
    def process_reconciliation_direct(request_data):
        """
        Process reconciliation using direct server connections (Module 2 dual-connection mode).
        
        Args:
            request_data (dict): Request with direct connection parameters
            
        Returns:
            dict: Response object with results or error
        """
        # Validate required fields for direct connections
        required_fields = ['source_query', 'target_query', 'source_key', 'target_key',
                          'source_server', 'source_database', 'source_username',
                          'target_server', 'target_database', 'target_username']
        
        for field in required_fields:
            if field not in request_data:
                return {
                    'success': False,
                    'error': f"Missing required field: {field}",
                    'status_code': 400
                }
        
        # Generate unique reconciliation ID
        reconciliation_id = str(uuid.uuid4())[:8]
        
        try:
            # Create service instance with direct connections
            service = ReconciliationService.create_direct(
                source_server=request_data['source_server'],
                source_database=request_data['source_database'],
                source_port=request_data.get('source_port'),
                source_username=request_data['source_username'],
                source_password=request_data.get('source_password'),
                target_server=request_data['target_server'],
                target_database=request_data['target_database'],
                target_port=request_data.get('target_port'),
                target_username=request_data['target_username'],
                target_password=request_data.get('target_password'),
                source_query=request_data['source_query'],
                target_query=request_data['target_query'],
                source_key=request_data['source_key'],
                target_key=request_data['target_key']
            )
            
            # Execute reconciliation
            result = service.execute()
            
            # Save results for later retrieval/export
            ReconciliationController._save_reconciliation_data(
                reconciliation_id,
                service,
                result
            )
            
            # Format response
            response = {
                'success': True,
                'reconciliation_id': reconciliation_id,
                'summary': result['summary'],
                'table_data': result['table_data'],
                'styling': result['styling'],
                'record_count': result['record_count'],
                'download_links': {
                    'full_csv': f'/api/m2/export/{reconciliation_id}/full',
                    'mismatch_csv': f'/api/m2/export/{reconciliation_id}/mismatches',
                    'detail_csv': f'/api/m2/export/{reconciliation_id}/detail',
                    'summary_csv': f'/api/m2/export/{reconciliation_id}/summary'
                }
            }
            
            return response
            
        except ValueError as e:
            return {
                'success': False,
                'error': str(e),
                'status_code': 400
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Reconciliation failed: {str(e)}",
                'status_code': 500
            }
    
    
    @staticmethod
    def _save_reconciliation_data(reconciliation_id, service, result):
        """
        Save reconciliation data for later retrieval and export.
        
        Args:
            reconciliation_id (str): Unique reconciliation ID
            service (ReconciliationService): Service with original DataFrames
            result (dict): Reconciliation result
        """
        # Save comparison table
        if service.comparison_table is not None and not service.comparison_table.empty:
            save_df(service.comparison_table, 'results', f"{reconciliation_id}_comparison")
        
        # Save source DataFrame
        if service.source_df is not None and not service.source_df.empty:
            save_df(service.source_df, 'results', f"{reconciliation_id}_source")
        
        # Save target DataFrame
        if service.target_df is not None and not service.target_df.empty:
            save_df(service.target_df, 'results', f"{reconciliation_id}_target")
    
    
    @staticmethod
    def get_export_file(reconciliation_id, export_type):
        """
        Generate and return export file.
        
        Args:
            reconciliation_id (str): Reconciliation ID
            export_type (str): Type of export ('full', 'mismatches', 'detail', 'summary')
            
        Returns:
            tuple: (file_path, error_message) - one will be None
        """
        try:
            # Load comparison table and source/target data
            comparison_df = load_df('results', f"{reconciliation_id}_comparison")
            source_df = load_df('results', f"{reconciliation_id}_source")
            target_df = load_df('results', f"{reconciliation_id}_target")
            
            if comparison_df is None:
                return None, "Reconciliation data not found"
            
            # Generate summary from loaded data
            from . import comparator, summary as summary_module
            
            # Reconstruct comparison result structure
            comparison_result = {
                'matched': comparison_df[comparison_df['__STATUS__'] == 'Matched'],
                'missing_in_target': comparison_df[comparison_df['__STATUS__'] == 'MissingInTarget'],
                'missing_in_source': comparison_df[comparison_df['__STATUS__'] == 'MissingInSource'],
                'column_mismatch_rows': []  # This is approximate
            }
            
            recon_summary = summary_module.generate_summary(
                comparison_result,
                source_df if source_df is not None else comparison_df,
                target_df if target_df is not None else comparison_df
            )
            
            from . import exporter
            
            if export_type == 'full':
                filepath = exporter.export_full_reconciliation(
                    comparison_df,
                    recon_summary,
                    RESULTS_DIR,
                    reconciliation_id
                )
            elif export_type == 'mismatches':
                mismatch_df = comparator.get_mismatches_only(comparison_df)
                filepath = exporter.export_mismatches_only(
                    mismatch_df,
                    recon_summary,
                    RESULTS_DIR,
                    reconciliation_id
                )
            elif export_type == 'detail':
                filepath = exporter.create_mismatch_detail_report(
                    comparison_result,
                    RESULTS_DIR,
                    reconciliation_id
                )
            elif export_type == 'summary':
                filepath = exporter.export_summary_report(
                    recon_summary,
                    RESULTS_DIR,
                    reconciliation_id
                )
            else:
                return None, f"Unknown export type: {export_type}"
            
            return filepath, None
            
        except Exception as e:
            return None, f"Export failed: {str(e)}"
