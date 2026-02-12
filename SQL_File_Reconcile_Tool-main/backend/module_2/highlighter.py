"""
Module 2: Highlighter
Generates cell-level styling and formatting for comparison results.
Uses color codes for visual distinction of matched, mismatched, and missing data.
"""

import pandas as pd


# Color scheme for highlighting
COLOR_MATCHED = '#d4edda'      # Light green for matched
COLOR_MISMATCHED = '#f8d7da'   # Light red for mismatched values
COLOR_MISSING = '#fff3cd'      # Light yellow for missing rows
COLOR_STATUS_OK = '#28a745'    # Green text for matched status
COLOR_STATUS_ERROR = '#dc3545' # Red text for mismatched status
COLOR_STATUS_WARN = '#ffc107'  # Orange text for missing status


def apply_cell_highlighting(comparison_table):
    """
    Apply cell-level highlighting based on row status and value differences.
    
    Args:
        comparison_table (pd.DataFrame): Comparison table with __STATUS__ column
        
    Returns:
        dict: Styling information for UI rendering
            - row_styles: Dict[key: str] -> status_color
            - cell_styles: Dict[key: {col: color}] -> for mismatched values
            - summary_colors: Summary metadata
    """
    if comparison_table.empty:
        return {'row_styles': {}, 'cell_styles': {}, 'summary_colors': {}}
    
    COMMON_KEY = "__COMMON_KEY__"
    row_styles = {}
    cell_styles = {}
    
    for idx, row in comparison_table.iterrows():
        key = str(row[COMMON_KEY])
        status = row.get('__STATUS__', 'Unknown')
        
        # Set row-level background color
        if status == 'Matched':
            row_styles[key] = {'bg_color': COLOR_MATCHED, 'text_color': 'black'}
        elif status == 'Mismatched':
            row_styles[key] = {'bg_color': COLOR_MISMATCHED, 'text_color': 'black'}
        elif status in ('MissingInTarget', 'MissingInSource'):
            row_styles[key] = {'bg_color': COLOR_MISSING, 'text_color': 'black'}
        else:
            row_styles[key] = {'bg_color': '#ffffff', 'text_color': 'black'}
        
        # Apply cell-level styling for mismatched columns (only for mismatched rows)
        if status == 'Mismatched':
            cell_styles[key] = {}
            
            # Identify mismatched columns (those ending with _Source or _Target)
            for col in row.index:
                if col in ('__COMMON_KEY__', '__STATUS__', '_merge_indicator'):
                    continue
                
                # Check if this is a value column that wasn't fully matched
                if col.endswith('_Source') or col.endswith('_Target'):
                    cell_styles[key][col] = {'bg_color': COLOR_MISMATCHED, 'text_color': '#721c24'}
    
    return {
        'row_styles': row_styles,
        'cell_styles': cell_styles,
        'summary_colors': {
            'matched': COLOR_MATCHED,
            'mismatched': COLOR_MISMATCHED,
            'missing': COLOR_MISSING
        }
    }


def get_status_badge_info(status):
    """
    Get display information for a status badge.
    
    Args:
        status (str): Status value (Matched, Mismatched, MissingInTarget, MissingInSource)
        
    Returns:
        dict: Badge info with color, label, icon
    """
    status_map = {
        'Matched': {
            'color': COLOR_STATUS_OK,
            'label': '✓ Matched',
            'icon': 'check-circle',
            'severity': 'ok'
        },
        'Mismatched': {
            'color': COLOR_STATUS_ERROR,
            'label': '✗ Mismatched',
            'icon': 'alert-circle',
            'severity': 'error'
        },
        'MissingInTarget': {
            'color': COLOR_STATUS_WARN,
            'label': '⚠ Missing in Target',
            'icon': 'alert-triangle',
            'severity': 'warning'
        },
        'MissingInSource': {
            'color': COLOR_STATUS_WARN,
            'label': '⚠ Missing in Source',
            'icon': 'alert-triangle',
            'severity': 'warning'
        }
    }
    
    return status_map.get(status, {
        'color': '#6c757d',
        'label': 'Unknown',
        'icon': 'help-circle',
        'severity': 'unknown'
    })


def highlight_mismatches_only(mismatch_df):
    """
    Generate highlighting for mismatch-only view (excludes matched rows).
    
    Args:
        mismatch_df (pd.DataFrame): DataFrame with only mismatches
        
    Returns:
        dict: Highlighting information
    """
    return apply_cell_highlighting(mismatch_df)


def build_cell_diff_info(source_value, target_value):
    """
    Build detailed diff information for a single cell comparison.
    
    Args:
        source_value: Source cell value
        target_value: Target cell value
        
    Returns:
        dict: Diff info with source, target, diff_type, highlighted_diffs
    """
    src_str = str(source_value).strip() if source_value is not None else ''
    tgt_str = str(target_value).strip() if target_value is not None else ''
    
    # Determine diff type
    if not src_str and tgt_str:
        diff_type = 'added'
    elif src_str and not tgt_str:
        diff_type = 'removed'
    elif src_str != tgt_str:
        diff_type = 'modified'
    else:
        diff_type = 'same'
    
    return {
        'source_value': source_value,
        'target_value': target_value,
        'diff_type': diff_type,
        'source_str': src_str,
        'target_str': tgt_str
    }


def get_column_comparison_detail(comparison_result):
    """
    Build detailed column-by-column comparison info.
    
    Args:
        comparison_result (dict): Output from compare_dataframes()
        
    Returns:
        dict: Column comparison details with mismatch counts per column
    """
    column_stats = {}
    
    for mismatch_row in comparison_result.get('column_mismatch_rows', []):
        for mismatch in mismatch_row.get('mismatches', []):
            col = mismatch['column']
            if col not in column_stats:
                column_stats[col] = {
                    'mismatch_count': 0,
                    'mismatches': []
                }
            column_stats[col]['mismatch_count'] += 1
            column_stats[col]['mismatches'].append({
                'key': mismatch_row['__COMMON_KEY__'],
                'source': mismatch['source_value'],
                'target': mismatch['target_value']
            })
    
    return column_stats
