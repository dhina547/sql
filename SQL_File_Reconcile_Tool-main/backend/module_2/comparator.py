"""
Module 2: Data Comparator
Performs row-level and column-level comparison between two DataFrames.
Uses Pandas merge with indicator to identify matched, missing, and mismatched data.
"""

import pandas as pd
import numpy as np


def normalize_for_comparison(val):
    """
    Normalize a single value for comparison.
    Handles NULL values, whitespace, and type conversions.
    
    Args:
        val: Input value
        
    Returns:
        str: Normalized value
    """
    if val is None or val is pd.NaT:
        return ''
    
    str_val = str(val).strip()
    
    if str_val in ('', 'None', 'nan', 'NaT', 'NaN', '<NA>'):
        return ''
    
    # Numeric normalization (e.g., 1750.0 -> 1750)
    try:
        float_val = float(str_val)
        if float_val == int(float_val):
            return str(int(float_val))
        return f"{float_val:g}"
    except (ValueError, OverflowError):
        pass
    
    return str_val


def compare_dataframes(source_df, target_df, source_alias='Source', target_alias='Target'):
    """
    Perform full comparison between two DataFrames using Pandas merge.
    
    Args:
        source_df (pd.DataFrame): Source dataset with __COMMON_KEY__ column
        target_df (pd.DataFrame): Target dataset with __COMMON_KEY__ column
        source_alias (str): Label for source data
        target_alias (str): Label for target data
        
    Returns:
        dict: Comparison results containing:
            - matched: DataFrame with matching rows
            - missing_in_target: Rows only in source
            - missing_in_source: Rows only in target
            - column_mismatches: List of rows with value differences
            - all_rows: Full merged DataFrame with indicators
    """
    COMMON_KEY = "__COMMON_KEY__"
    
    # Make copies to avoid modifying originals
    src = source_df.copy()
    tgt = target_df.copy()
    
    # Validate that COMMON_KEY exists in both DataFrames
    if COMMON_KEY not in src.columns:
        raise ValueError(f"Source DataFrame missing '{COMMON_KEY}' column. Keys must be normalized first.")
    if COMMON_KEY not in tgt.columns:
        raise ValueError(f"Target DataFrame missing '{COMMON_KEY}' column. Keys must be normalized first.")
    
    # Add suffixes to distinguish source/target columns
    src_cols = {col: f"{col}_{source_alias}" for col in src.columns if col != COMMON_KEY}
    tgt_cols = {col: f"{col}_{target_alias}" for col in tgt.columns if col != COMMON_KEY}
    
    src = src.rename(columns=src_cols)
    tgt = tgt.rename(columns=tgt_cols)
    
    # Perform merge with indicator
    merged = pd.merge(
        src,
        tgt,
        on=COMMON_KEY,
        how='outer',
        indicator='_merge_indicator'
    )
    
    # Categorize rows
    matched_mask = merged['_merge_indicator'] == 'both'
    missing_in_tgt_mask = merged['_merge_indicator'] == 'left_only'
    missing_in_src_mask = merged['_merge_indicator'] == 'right_only'
    
    matched = merged[matched_mask].copy()
    missing_in_target = merged[missing_in_tgt_mask].copy()
    missing_in_source = merged[missing_in_src_mask].copy()
    
    # Identify column mismatches in matched rows
    column_mismatch_rows = []
    mismatched_cols = set()
    
    for idx, row in matched.iterrows():
        row_mismatch = {COMMON_KEY: row[COMMON_KEY], 'mismatches': []}
        
        # Compare columns (source vs target)
        src_suffix = f"_{source_alias}"
        tgt_suffix = f"_{target_alias}"
        
        # Get unique base column names
        unique_cols = set()
        for col in matched.columns:
            if col.endswith(src_suffix):
                unique_cols.add(col[:-len(src_suffix)])
            elif col.endswith(tgt_suffix):
                unique_cols.add(col[:-len(tgt_suffix)])
        
        for base_col in unique_cols:
            if base_col == COMMON_KEY or base_col == '_merge_indicator':
                continue
            
            src_col = f"{base_col}{src_suffix}"
            tgt_col = f"{base_col}{tgt_suffix}"
            
            if src_col not in row.index or tgt_col not in row.index:
                continue
            
            src_val = normalize_for_comparison(row[src_col])
            tgt_val = normalize_for_comparison(row[tgt_col])
            
            if src_val != tgt_val:
                mismatched_cols.add(base_col)
                row_mismatch['mismatches'].append({
                    'column': base_col,
                    'source_value': row[src_col],
                    'target_value': row[tgt_col]
                })
        
        if row_mismatch['mismatches']:
            column_mismatch_rows.append(row_mismatch)
    
    return {
        'matched': matched,
        'missing_in_target': missing_in_target,
        'missing_in_source': missing_in_source,
        'column_mismatch_rows': column_mismatch_rows,
        'mismatched_columns': list(mismatched_cols),
        'all_rows': merged
    }


def build_comparison_table(comparison_result, source_alias='Source', target_alias='Target'):
    """
    Build a comprehensive comparison table for display/export.
    Combines matched, missing, and mismatched data.
    
    Args:
        comparison_result (dict): Output from compare_dataframes()
        source_alias (str): Label for source data
        target_alias (str): Label for target data
        
    Returns:
        pd.DataFrame: Table with columns:
            - __COMMON_KEY__
            - __STATUS__ (Matched, MissingInTarget, MissingInSource, Mismatched)
            - [data columns with _Source, _Target suffixes]
    """
    COMMON_KEY = "__COMMON_KEY__"
    
    rows = []
    
    # Add matched rows with status
    for idx, row in comparison_result['matched'].iterrows():
        is_mismatch = False
        row_dict = {
            COMMON_KEY: row[COMMON_KEY],
            '__STATUS__': 'Matched'
        }
        
        # Check if this row has column mismatches
        for mismatch in comparison_result['column_mismatch_rows']:
            if mismatch[COMMON_KEY] == row[COMMON_KEY]:
                row_dict['__STATUS__'] = 'Mismatched'
                is_mismatch = True
                break
        
        # Add all columns from matched row
        for col in row.index:
            if col not in ('_merge_indicator', '__COMMON_KEY__'):
                row_dict[col] = row[col]
        
        rows.append(row_dict)
    
    # Add missing in target (only if key is valid, not a NULL key)
    for idx, row in comparison_result['missing_in_target'].iterrows():
        key = str(row[COMMON_KEY])
        # Skip NULL key rows - they will be handled separately
        if key.startswith('__NULL_KEY_'):
            continue
            
        row_dict = {
            COMMON_KEY: row[COMMON_KEY],
            '__STATUS__': 'MissingInTarget'
        }
        for col in row.index:
            if col not in ('_merge_indicator', '__COMMON_KEY__'):
                row_dict[col] = row[col]
        rows.append(row_dict)
    
    # Add missing in source (only if key is valid, not a NULL key)
    for idx, row in comparison_result['missing_in_source'].iterrows():
        key = str(row[COMMON_KEY])
        # Skip NULL key rows - they will be handled separately
        if key.startswith('__NULL_KEY_'):
            continue
            
        row_dict = {
            COMMON_KEY: row[COMMON_KEY],
            '__STATUS__': 'MissingInSource'
        }
        for col in row.index:
            if col not in ('_merge_indicator', '__COMMON_KEY__'):
                row_dict[col] = row[col]
        rows.append(row_dict)
    
    # Add NULL key rows separately with proper status
    # These are rows with no valid key - they cannot be matched
    for idx, row in comparison_result['missing_in_target'].iterrows():
        key = str(row[COMMON_KEY])
        if key.startswith('__NULL_KEY_'):
            row_dict = {
                COMMON_KEY: '[NULL KEY]',  # Display as NULL KEY for clarity
                '__STATUS__': 'MissingInTarget'
            }
            for col in row.index:
                if col not in ('_merge_indicator', '__COMMON_KEY__'):
                    row_dict[col] = row[col]
            rows.append(row_dict)
    
    for idx, row in comparison_result['missing_in_source'].iterrows():
        key = str(row[COMMON_KEY])
        if key.startswith('__NULL_KEY_'):
            row_dict = {
                COMMON_KEY: '[NULL KEY]',  # Display as NULL KEY for clarity
                '__STATUS__': 'MissingInSource'
            }
            for col in row.index:
                if col not in ('_merge_indicator', '__COMMON_KEY__'):
                    row_dict[col] = row[col]
            rows.append(row_dict)
    
    result_df = pd.DataFrame(rows)
    return result_df if len(result_df) > 0 else pd.DataFrame({COMMON_KEY: [], '__STATUS__': []})


def get_mismatches_only(comparison_table):
    """
    Filter comparison table to show only mismatched and missing rows (exclude Matched).
    
    Args:
        comparison_table (pd.DataFrame): Output from build_comparison_table()
        
    Returns:
        pd.DataFrame: Filtered table with only mismatches
    """
    return comparison_table[comparison_table['__STATUS__'] != 'Matched'].copy()
