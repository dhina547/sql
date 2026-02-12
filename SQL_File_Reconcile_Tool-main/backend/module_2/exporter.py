"""
Module 2: Exporter
Handles CSV export of reconciliation results.
"""

import pandas as pd
import os
from datetime import datetime


def export_full_reconciliation(comparison_table, summary, output_dir, file_id):
    """
    Export full reconciliation report (all rows) to CSV.
    
    Args:
        comparison_table (pd.DataFrame): Full comparison table with all rows
        summary (dict): Summary metrics
        output_dir (str): Output directory path
        file_id (str): Unique file identifier
        
    Returns:
        str: Path to exported CSV file
    """
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"reconciliation_full_{file_id}_{timestamp}.csv"
    filepath = os.path.join(output_dir, filename)
    
    # Prepare data for export
    export_df = comparison_table.copy()
    
    # Add summary metadata as header comments (some CSV readers skip these)
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        f.write(f"# Reconciliation Report - Full Dataset\n")
        f.write(f"# Generated: {datetime.now().isoformat()}\n")
        f.write(f"# Total Source Rows: {summary['total_source']}\n")
        f.write(f"# Total Target Rows: {summary['total_target']}\n")
        f.write(f"# Matched Rows: {summary['matched']}\n")
        f.write(f"# Missing in Source: {summary['missing_in_source']}\n")
        f.write(f"# Missing in Target: {summary['missing_in_target']}\n")
        f.write(f"# Column Mismatches: {summary['column_mismatches']}\n")
        f.write(f"# Reconciliation Rate: {summary['reconciliation_rate']}%\n")
        f.write(f"#\n")
    
    # Append data
    export_df.to_csv(filepath, mode='a', index=False, encoding='utf-8')
    
    return filepath


def export_mismatches_only(mismatch_df, summary, output_dir, file_id):
    """
    Export mismatch-only report (excludes matched rows) to CSV.
    
    Args:
        mismatch_df (pd.DataFrame): DataFrame with only mismatched/missing rows
        summary (dict): Summary metrics
        output_dir (str): Output directory path
        file_id (str): Unique file identifier
        
    Returns:
        str: Path to exported CSV file
    """
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"reconciliation_mismatches_{file_id}_{timestamp}.csv"
    filepath = os.path.join(output_dir, filename)
    
    # Prepare data for export
    export_df = mismatch_df.copy()
    
    # Write with metadata
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        f.write(f"# Reconciliation Report - Mismatches Only\n")
        f.write(f"# Generated: {datetime.now().isoformat()}\n")
        f.write(f"# Total Source Rows: {summary['total_source']}\n")
        f.write(f"# Total Target Rows: {summary['total_target']}\n")
        f.write(f"# Matched Rows: {summary['matched']}\n")
        f.write(f"# Missing in Source: {summary['missing_in_source']}\n")
        f.write(f"# Missing in Target: {summary['missing_in_target']}\n")
        f.write(f"# Total Discrepancy Rows: {len(export_df)}\n")
        f.write(f"# Reconciliation Rate: {summary['reconciliation_rate']}%\n")
        f.write(f"#\n")
    
    # Append data
    export_df.to_csv(filepath, mode='a', index=False, encoding='utf-8')
    
    return filepath


def export_summary_report(summary, output_dir, file_id):
    """
    Export summary metrics to CSV.
    
    Args:
        summary (dict): Summary metrics
        output_dir (str): Output directory path
        file_id (str): Unique file identifier
        
    Returns:
        str: Path to exported CSV file
    """
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"reconciliation_summary_{file_id}_{timestamp}.csv"
    filepath = os.path.join(output_dir, filename)
    
    # Convert summary dict to DataFrame for export
    summary_data = {
        'Metric': list(summary.keys()),
        'Value': list(summary.values())
    }
    
    summary_df = pd.DataFrame(summary_data)
    summary_df.to_csv(filepath, index=False, encoding='utf-8')
    
    return filepath


def create_mismatch_detail_report(comparison_result, output_dir, file_id, source_alias='Source', target_alias='Target'):
    """
    Create detailed mismatch report with column-by-column differences.
    
    Args:
        comparison_result (dict): Output from compare_dataframes()
        output_dir (str): Output directory path
        file_id (str): Unique file identifier
        source_alias (str): Source environment label
        target_alias (str): Target environment label
        
    Returns:
        str: Path to exported CSV file
    """
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"reconciliation_detail_mismatches_{file_id}_{timestamp}.csv"
    filepath = os.path.join(output_dir, filename)
    
    # Build detailed mismatch records
    detail_rows = []
    
    for mismatch_row in comparison_result.get('column_mismatch_rows', []):
        key = mismatch_row.get('__COMMON_KEY__', '')
        
        for mismatch in mismatch_row.get('mismatches', []):
            detail_rows.append({
                'Key': key,
                'Column': mismatch['column'],
                f'{source_alias}_Value': mismatch['source_value'],
                f'{target_alias}_Value': mismatch['target_value'],
                'Status': 'MISMATCH'
            })
    
    # Add missing in target rows
    for idx, row in comparison_result['missing_in_target'].iterrows():
        key = row.get('__COMMON_KEY__', '')
        detail_rows.append({
            'Key': key,
            'Column': 'ROW_LEVEL',
            f'{source_alias}_Value': 'EXISTS',
            f'{target_alias}_Value': 'MISSING',
            'Status': 'MISSING_IN_TARGET'
        })
    
    # Add missing in source rows
    for idx, row in comparison_result['missing_in_source'].iterrows():
        key = row.get('__COMMON_KEY__', '')
        detail_rows.append({
            'Key': key,
            'Column': 'ROW_LEVEL',
            f'{source_alias}_Value': 'MISSING',
            f'{target_alias}_Value': 'EXISTS',
            'Status': 'MISSING_IN_SOURCE'
        })
    
    if detail_rows:
        detail_df = pd.DataFrame(detail_rows)
        detail_df.to_csv(filepath, index=False, encoding='utf-8')
    else:
        # Create empty file if no mismatches
        pd.DataFrame(columns=['Key', 'Column', f'{source_alias}_Value', f'{target_alias}_Value', 'Status']).to_csv(
            filepath, index=False, encoding='utf-8'
        )
    
    return filepath


def get_export_filename(export_type, file_id):
    """
    Generate a standardized export filename.
    
    Args:
        export_type (str): Type of export ('full', 'mismatches', 'summary', 'detail')
        file_id (str): Unique file identifier
        
    Returns:
        str: Filename with timestamp
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if export_type == 'full':
        return f"reconciliation_full_{file_id}_{timestamp}.csv"
    elif export_type == 'mismatches':
        return f"reconciliation_mismatches_{file_id}_{timestamp}.csv"
    elif export_type == 'summary':
        return f"reconciliation_summary_{file_id}_{timestamp}.csv"
    elif export_type == 'detail':
        return f"reconciliation_detail_{file_id}_{timestamp}.csv"
    else:
        return f"reconciliation_{file_id}_{timestamp}.csv"
