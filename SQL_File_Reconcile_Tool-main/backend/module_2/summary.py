"""
Module 2: Summary Generator
Produces reconciliation summary metrics and statistics.
"""

import pandas as pd


def generate_summary(comparison_result, source_df, target_df):
    """
    Generate comprehensive reconciliation summary statistics.
    
    Args:
        comparison_result (dict): Output from compare_dataframes()
        source_df (pd.DataFrame): Original source DataFrame
        target_df (pd.DataFrame): Original target DataFrame
        
    Returns:
        dict: Summary object containing:
            - total_source: Row count in source
            - total_target: Row count in target
            - matched: Count of fully matched rows
            - missing_in_source: Count of rows only in target
            - missing_in_target: Count of rows only in source
            - column_mismatches: Count of rows with column-level differences
            - reconciliation_rate: Percentage of matched rows
            - discrepancy_rate: Percentage of mismatched rows
    """
    
    matched_count = len(comparison_result['matched'])
    missing_in_tgt_count = len(comparison_result['missing_in_target'])
    missing_in_src_count = len(comparison_result['missing_in_source'])
    mismatch_count = len(comparison_result['column_mismatch_rows'])
    
    total_source = len(source_df)
    total_target = len(target_df)
    
    # Calculate reconciliation rates
    total_comparable = matched_count + missing_in_tgt_count + missing_in_src_count + mismatch_count
    
    if total_comparable > 0:
        reconciliation_rate = (matched_count / total_comparable) * 100
        discrepancy_rate = ((missing_in_tgt_count + missing_in_src_count + mismatch_count) / total_comparable) * 100
    else:
        reconciliation_rate = 0
        discrepancy_rate = 0
    
    summary = {
        'total_source': int(total_source),
        'total_target': int(total_target),
        'matched': int(matched_count),
        'missing_in_source': int(missing_in_src_count),
        'missing_in_target': int(missing_in_tgt_count),
        'column_mismatches': int(mismatch_count),
        'total_discrepancies': int(missing_in_tgt_count + missing_in_src_count + mismatch_count),
        'reconciliation_rate': round(reconciliation_rate, 2),
        'discrepancy_rate': round(discrepancy_rate, 2),
        'status': determine_reconciliation_status(matched_count, total_comparable)
    }
    
    return summary


def determine_reconciliation_status(matched_count, total_count):
    """
    Determine overall reconciliation status based on match percentage.
    
    Args:
        matched_count (int): Number of matched rows
        total_count (int): Total rows compared
        
    Returns:
        str: Status (PERFECT, CLEAN, WARNINGS, CRITICAL)
    """
    if total_count == 0:
        return 'EMPTY'
    
    match_rate = (matched_count / total_count) * 100
    
    if match_rate == 100:
        return 'PERFECT'
    elif match_rate >= 95:
        return 'CLEAN'
    elif match_rate >= 80:
        return 'WARNINGS'
    else:
        return 'CRITICAL'


def generate_detailed_summary(comparison_result, source_df, target_df, source_env='Source', target_env='Target'):
    """
    Generate a detailed summary with additional context and recommendations.
    
    Args:
        comparison_result (dict): Output from compare_dataframes()
        source_df (pd.DataFrame): Original source DataFrame
        target_df (pd.DataFrame): Original target DataFrame
        source_env (str): Source environment name
        target_env (str): Target environment name
        
    Returns:
        dict: Extended summary with metadata and recommendations
    """
    base_summary = generate_summary(comparison_result, source_df, target_df)
    
    # Identify problematic columns (columns with most mismatches)
    column_issues = {}
    for mismatch_row in comparison_result.get('column_mismatch_rows', []):
        for mismatch in mismatch_row.get('mismatches', []):
            col = mismatch['column']
            column_issues[col] = column_issues.get(col, 0) + 1
    
    top_issues = sorted(column_issues.items(), key=lambda x: x[1], reverse=True)[:5]
    
    extended_summary = {
        **base_summary,
        'comparison': {
            'source_environment': source_env,
            'target_environment': target_env,
            'source_rows': int(len(source_df)),
            'target_rows': int(len(target_df))
        },
        'top_discrepancy_columns': [
            {
                'column_name': col,
                'mismatch_count': count
            }
            for col, count in top_issues
        ],
        'recommendations': generate_recommendations(base_summary)
    }
    
    return extended_summary


def generate_recommendations(summary):
    """
    Generate reconciliation recommendations based on summary metrics.
    
    Args:
        summary (dict): Summary object
        
    Returns:
        list: List of recommendation strings
    """
    recommendations = []
    
    status = summary.get('status', 'UNKNOWN')
    
    if status == 'PERFECT':
        recommendations.append('✓ Perfect reconciliation achieved. Data is consistent.')
    elif status == 'CLEAN':
        recommendations.append('✓ Data reconciliation is excellent with minor discrepancies.')
    elif status == 'WARNINGS':
        recommendations.append('⚠ Multiple discrepancies detected. Investigate source data quality.')
    elif status == 'CRITICAL':
        recommendations.append('✗ Critical data mismatch. Data integrity may be at risk. Investigate immediately.')
    
    if summary.get('missing_in_target', 0) > 0:
        recommendations.append(f"⚠ {summary['missing_in_target']} rows exist in source but not in target.")
    
    if summary.get('missing_in_source', 0) > 0:
        recommendations.append(f"⚠ {summary['missing_in_source']} rows exist in target but not in source.")
    
    if summary.get('column_mismatches', 0) > 0:
        recommendations.append(f"⚠ {summary['column_mismatches']} rows have column-level mismatches.")
    
    return recommendations


def get_summary_for_export(summary):
    """
    Format summary for CSV/report export.
    
    Args:
        summary (dict): Summary from generate_summary()
        
    Returns:
        dict: Flattened summary suitable for export
    """
    return {
        'Total Source Rows': summary['total_source'],
        'Total Target Rows': summary['total_target'],
        'Fully Matched Rows': summary['matched'],
        'Missing in Source': summary['missing_in_source'],
        'Missing in Target': summary['missing_in_target'],
        'Column-Level Mismatches': summary['column_mismatches'],
        'Total Discrepancies': summary['total_discrepancies'],
        'Reconciliation Rate (%)': summary['reconciliation_rate'],
        'Discrepancy Rate (%)': summary['discrepancy_rate'],
        'Status': summary['status']
    }
