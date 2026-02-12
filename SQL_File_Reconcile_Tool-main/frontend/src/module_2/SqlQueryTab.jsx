import React, { useState } from "react";
import axios from "axios";
import { useConsole } from "../common_Resources/ConsoleContext";
import {
  Play,
  Database,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

const SqlQueryTab = ({ m2Connections, m2State, setM2State, onNext }) => {
  const { log, logTable } = useConsole();
  const [loading, setLoading] = useState({ source: false, target: false });
  const [previewOpen, setPreviewOpen] = useState({
    source: false,
    target: false,
  });

  // Get server labels from connections
  const getServerLabel = (type) => {
    const conn =
      type === "source" ? m2Connections?.source : m2Connections?.target;
    return conn?.serverLabel || "Unknown Server";
  };

  const handleExecuteQuery = async (type) => {
    const query =
      type === "source" ? m2State.source_query : m2State.target_query;
    const serverLabel = getServerLabel(type);

    if (!query.trim()) return;

    setLoading((prev) => ({ ...prev, [type]: true }));
    log(`Executing query on ${serverLabel}...`, "info");
    log(query.trim(), "header");

    try {
      // Backend endpoint to preview query
      // Now sending 'type' instead of env/database to use active connection
      const res = await axios.post("/api/m2/preview_query", {
        type: type, // "source" or "target"
        query: query,
      });

      const { columns, rows, row_count } = res.data;

      if (type === "source") {
        setM2State((prev) => ({
          ...prev,
          source_columns: columns || [],
          source_rows: rows || [],
          source_count: row_count || 0,
          source_executed: true,
        }));
      } else {
        setM2State((prev) => ({
          ...prev,
          target_columns: columns || [],
          target_rows: rows || [],
          target_count: row_count || 0,
          target_executed: true,
        }));
      }

      log(`Query executed successfully — ${row_count} rows fetched`, "success");
      log(`Columns: ${(columns || []).join(", ")}`, "info");
      logTable(columns || [], rows || [], 5);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      log(`Query failed: ${msg}`, "error");
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const isComplete = m2State.source_executed && m2State.target_executed;

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <div className="flex items-center gap-2 text-slate-700">
        <Database className="w-5 h-5 text-brand-700" />
        <h3 className="font-bold text-sm">SQL Query Execution</h3>
      </div>

      {/* Source Query */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-600">
            Source Query ({getServerLabel("source")})
          </label>
          {m2State.source_executed && (
            <span className="text-xs bg-green-100 text-green-900 px-2 py-0.5 rounded font-bold">
              ✓ {m2State.source_count} rows
            </span>
          )}
        </div>
        <textarea
          className="flex-1 w-full p-3 border border-gray-300 rounded-lg font-mono text-xs bg-slate-50 focus:border-brand-700 focus:ring-1 focus:ring-brand-700 outline-none resize-none min-h-[80px]"
          value={m2State.source_query}
          onChange={(e) => {
            setM2State((prev) => ({
              ...prev,
              source_query: e.target.value,
              source_executed: false,
            }));
          }}
          placeholder="SELECT * FROM source_table"
          spellCheck={false}
        />
        <button
          onClick={() => handleExecuteQuery("source")}
          disabled={loading.source || !m2State.source_query.trim()}
          className="self-end bg-brand-700 hover:bg-brand-900 disabled:bg-gray-300 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors"
        >
          <Play className="w-3 h-3" />
          {loading.source ? "Executing..." : "Execute"}
        </button>
      </div>

      {/* Target Query */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-600">
            Target Query ({getServerLabel("target")})
          </label>
          {m2State.target_executed && (
            <span className="text-xs bg-green-100 text-green-900 px-2 py-0.5 rounded font-bold">
              ✓ {m2State.target_count} rows
            </span>
          )}
        </div>
        <textarea
          className="flex-1 w-full p-3 border border-gray-300 rounded-lg font-mono text-xs bg-slate-50 focus:border-brand-700 focus:ring-1 focus:ring-brand-700 outline-none resize-none min-h-[80px]"
          value={m2State.target_query}
          onChange={(e) => {
            setM2State((prev) => ({
              ...prev,
              target_query: e.target.value,
              target_executed: false,
            }));
          }}
          placeholder="SELECT * FROM target_table"
          spellCheck={false}
        />
        <button
          onClick={() => handleExecuteQuery("target")}
          disabled={loading.target || !m2State.target_query.trim()}
          className="self-end bg-brand-700 hover:bg-brand-900 disabled:bg-gray-300 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors"
        >
          <Play className="w-3 h-3" />
          {loading.target ? "Executing..." : "Execute"}
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">
          {isComplete
            ? "✓ Both queries executed"
            : "Execute both queries to continue"}
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

export default SqlQueryTab;
