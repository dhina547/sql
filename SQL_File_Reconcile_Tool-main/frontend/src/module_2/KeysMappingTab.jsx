import React, { useState } from "react";
import { useConsole } from "../common_Resources/ConsoleContext";
import { Key, ArrowRight, CheckCircle2 } from "lucide-react";

const KeysMappingTab = ({ m2State, setM2State, onNext }) => {
  const { log } = useConsole();

  const sourceColumns = m2State.source_columns || [];
  const targetColumns = m2State.target_columns || [];

  const handleKeyMapping = (sourceKey, targetKey) => {
    setM2State((prev) => ({
      ...prev,
      source_key: sourceKey,
      target_key: targetKey,
      keys_mapped: true,
    }));
    log(`Key mapping set: ${sourceKey} → ${targetKey}`, "info");
  };

  const isComplete =
    m2State.keys_mapped && m2State.source_key && m2State.target_key;

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center gap-2 text-slate-700">
        <Key className="w-5 h-5 text-brand-700" />
        <h3 className="font-bold text-sm">Primary Key Mapping</h3>
      </div>

      <p className="text-xs text-gray-600">
        Select the primary key columns from source and target queries for row
        matching.
      </p>

      <div className="grid grid-cols-2 gap-6 flex-1">
        {/* Source Key Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-600">
            Source Key Column
          </label>
          <div className="flex-1 bg-slate-50 border border-gray-300 rounded-lg overflow-auto">
            {sourceColumns.length === 0 ? (
              <p className="text-xs text-gray-400 p-2">No columns available</p>
            ) : (
              <div className="space-y-1 p-2">
                {sourceColumns.map((col) => (
                  <button
                    key={col}
                    onClick={() => handleKeyMapping(col, m2State.target_key)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      m2State.source_key === col
                        ? "bg-brand-500 text-white"
                        : "bg-white border border-gray-200 text-slate-700 hover:bg-brand-100"
                    }`}
                  >
                    {col}
                    {m2State.source_key === col && (
                      <span className="float-right">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Target Key Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-600">
            Target Key Column
          </label>
          <div className="flex-1 bg-slate-50 border border-gray-300 rounded-lg overflow-auto">
            {targetColumns.length === 0 ? (
              <p className="text-xs text-gray-400 p-2">No columns available</p>
            ) : (
              <div className="space-y-1 p-2">
                {targetColumns.map((col) => (
                  <button
                    key={col}
                    onClick={() => handleKeyMapping(m2State.source_key, col)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      m2State.target_key === col
                        ? "bg-brand-500 text-white"
                        : "bg-white border border-gray-200 text-slate-700 hover:bg-brand-100"
                    }`}
                  >
                    {col}
                    {m2State.target_key === col && (
                      <span className="float-right">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Mapping Summary */}
      {isComplete && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-700">
            <span className="font-bold">{m2State.source_key}</span>
            <span className="mx-1">→</span>
            <span className="font-bold">{m2State.target_key}</span>
            <span className="mx-1">mapping configured</span>
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">
          {isComplete
            ? "✓ Key mapping complete"
            : "Select key columns from both sides"}
        </span>
        <button
          onClick={onNext}
          disabled={!isComplete}
          className="bg-brand-500 hover:bg-brand-700 disabled:bg-gray-300 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default KeysMappingTab;
