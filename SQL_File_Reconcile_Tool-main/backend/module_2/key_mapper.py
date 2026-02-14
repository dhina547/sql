"""
Module 2: Key Mapper
Handles primary key mapping between source and target datasets.
Normalizes and renames keys for safe comparison.
"""

import pandas as pd


def validate_keys_exist(source_df, target_df, source_key, target_key):
    """
    Validate that specified key columns exist in both DataFrames.
    
    Args:
        source_df (pd.DataFrame): Source dataset
        target_df (pd.DataFrame): Target dataset
        source_key (str): Source key column name
        target_key (str): Target key column name
        
    Returns:
        tuple: (True, None) if valid
        
    Raises:
        ValueError: If keys don't exist
    """
    source_cols = [col for col in source_df.columns]
    target_cols = [col for col in target_df.columns]
    
    # Case-insensitive search
    source_key_exists = any(col.lower() == source_key.lower() for col in source_cols)
    target_key_exists = any(col.lower() == target_key.lower() for col in target_cols)
    
    if not source_key_exists:
        raise ValueError(f"Key column '{source_key}' not found in source. Available: {source_cols}")
    
    if not target_key_exists:
        raise ValueError(f"Key column '{target_key}' not found in target. Available: {target_cols}")
    
    return True, None


def normalize_dataframe_keys(df, old_key_name, new_key_name="__COMMON_KEY__"):
    """
    Rename and normalize a key column in a DataFrame.
    Handles case-insensitive column selection and null handling.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        old_key_name (str): Current column name (case-insensitive)
        new_key_name (str): New column name (default: __COMMON_KEY__)
        
    Returns:
        pd.DataFrame: DataFrame with normalized key column
        
    Raises:
        ValueError: If key column not found
        
    Note:
        Rows with NULL/empty keys are assigned unique identifiers (NULL_KEY_0, NULL_KEY_1, etc.)
        to prevent them from incorrectly matching each other during merge operations.
        Numeric keys are normalized (1750.0 → 1750) for consistent matching.
    """
    df_copy = df.copy()
    
    # Find the actual column name (case-insensitive)
    actual_col = None
    for col in df_copy.columns:
        if col.lower() == old_key_name.lower():
            actual_col = col
            break
    
    if actual_col is None:
        raise ValueError(f"Key column '{old_key_name}' not found")
    
    # Rename the column
    df_copy = df_copy.rename(columns={actual_col: new_key_name})
    
    # Normalize key values: convert to string & handle nulls
    processed_keys = []
    null_indices = []
    
    for i, val in enumerate(df_copy[new_key_name]):
        # Check if null/empty
        if val is None or pd.isna(val):
            null_indices.append(i)
            processed_keys.append(f"__NULL_KEY_{len(null_indices)-1}__")
        else:
            str_val = str(val).strip()
            
            # Check if string representation is null-like
            if str_val in ('None', 'nan', 'NaT', 'NaN', '<NA>', ''):
                null_indices.append(i)
                processed_keys.append(f"__NULL_KEY_{len(null_indices)-1}__")
            else:
                # Normalize numeric values (1750.0 → 1750)
                try:
                    float_val = float(str_val)
                    if float_val == int(float_val):
                        processed_keys.append(str(int(float_val)))
                    else:
                        processed_keys.append(f"{float_val:g}")
                except (ValueError, OverflowError):
                    # Not numeric, keep as-is
                    processed_keys.append(str_val)
    
    df_copy[new_key_name] = processed_keys
    
    return df_copy


def map_keys(source_df, target_df, source_key, target_key):
    """
    Normalize key columns in both DataFrames to a common key name.
    
    Args:
        source_df (pd.DataFrame): Source dataset
        target_df (pd.DataFrame): Target dataset
        source_key (str): Source key column (case-insensitive)
        target_key (str): Target key column (case-insensitive)
        
    Returns:
        tuple: (source_df_normalized, target_df_normalized)
        
    Raises:
        ValueError: If key columns not found or invalid
    """
    COMMON_KEY = "__COMMON_KEY__"
    
    # Validate keys exist
    validate_keys_exist(source_df, target_df, source_key, target_key)
    
    # Normalize both DataFrames
    source_normalized = normalize_dataframe_keys(source_df, source_key, COMMON_KEY)
    target_normalized = normalize_dataframe_keys(target_df, target_key, COMMON_KEY)
    
    return source_normalized, target_normalized


def get_key_column_name():
    """
    Get the internal common key column name used by the mapper.
    
    Returns:
        str: "__COMMON_KEY__"
    """
    return "__COMMON_KEY__"


def validate_datatype_compatibility(source_key_series, target_key_series):
    """
    Validate that key columns have compatible data types for comparison.
    
    Args:
        source_key_series (pd.Series): Source key column
        target_key_series (pd.Series): Target key column
        
    Returns:
        bool: True if types are compatible
        
    Note:
        Keys are normalized to strings, so most types are compatible.
        This is a safety check for obvious mismatches.
    """
    # After normalization, both will be strings, so this is primarily a warning function
    source_dtype = source_key_series.dtype
    target_dtype = target_key_series.dtype
    
    # Log mapping if dtypes differ significantly
    if source_dtype != target_dtype:
        print(f"Warning: Key type mismatch - Source: {source_dtype}, Target: {target_dtype}")
        print("Keys will be normalized to strings for safe comparison")
    
    return True
