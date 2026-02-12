import React, { useState, useEffect } from "react";
import axios from "axios";
import { useConsole } from "../common_Resources/ConsoleContext";
import {
  Play,
  Download,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Users,
} from "lucide-react";

const RunComparisonTab = ({ m2State, m2Connections, onReset }) => {
  const { log, logTable } = useConsole();

  const [reconciliationId, setReconciliationId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [allData, setAllData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [collapsed, setCollapsed] = useState({
    matched: true,
    mismatched: false,
    missing: false,
  });
  const [exporting, setExporting] = useState(null);

  // --- Run Comparison ---
  const handleRun = async () => {
    setLoading(true);
    log("───── Running SQL-to-SQL Comparison ─────", "header");

    try {
      // Updated payload for dual connection approach
      // No longer sends env names, instead comparison happens via connection types
      const payload = {
        source_query: m2State.source_query,
        target_query: m2State.target_query,
        source_key: m2State.source_key,
        target_key: m2State.target_key,
        use_connections: true, // Flag to indicate we're using dual connections
      };

      const sourceServer =
        m2Connections?.source?.serverLabel ||
        m2Connections?.source?.server ||
        "Source";
      const targetServer =
        m2Connections?.target?.serverLabel ||
        m2Connections?.target?.server ||
        "Target";

      log(`Comparing: ${sourceServer} ↔ ${targetServer}`, "info");
      log(
        `Primary Keys: ${m2State.source_key} → ${m2State.target_key}`,
        "info",
      );

      const res = await axios.post("/api/sql-compare", payload);

      if (!res.data.success) {
        log(`Comparison failed: ${res.data.error}`, "error");
        return;
      }

      const result = res.data;
      setReconciliationId(result.reconciliation_id);
      setSummary(result.summary);
      setAllData(result.table_data || []);

      if (result.table_data && result.table_data.length > 0) {
        setColumns(
          Object.keys(result.table_data[0]).filter((k) => k !== "__STATUS__"),
        );
      }

      log(
        `Comparison complete! ${result.record_count} total records processed`,
        "success",
      );

      // Log summary
      const {
        matched,
        missing_in_source,
        missing_in_target,
        column_mismatches,
      } = result.summary;
      log(
        `Matched: ${matched} | Missing in Target: ${missing_in_target} | Missing in Source: ${missing_in_source} | Mismatches: ${column_mismatches}`,
        "info",
      );

      const { reconciliation_rate, discrepancy_rate } = result.summary;
      log(
        `Reconciliation Rate: ${reconciliation_rate}% | Discrepancy Rate: ${discrepancy_rate}%`,
        result.summary.status === "PERFECT" ? "success" : "warn",
      );
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      log(`Comparison failed: ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Export Handlers ---
  const handleExport = async (type) => {
    if (!reconciliationId) return;

    setExporting(type);
    try {
      const link = `/api/m2/export/${reconciliationId}/${type}`;
      const response = await axios.get(link, { responseType: "blob" });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `reconciliation_${type}_${reconciliationId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      log(`Downloaded ${type} CSV report`, "success");
    } catch (err) {
      log(`Export failed: ${err.message}`, "error");
    } finally {
      setExporting(null);
    }
  };

  // --- Data Filtering ---
  const matched = allData.filter((r) => r.__STATUS__ === "Matched");
  const mismatched = allData.filter((r) => r.__STATUS__ === "Mismatched");
  const missing_in_target = allData.filter(
    (r) => r.__STATUS__ === "MissingInTarget",
  );
  const missing_in_source = allData.filter(
    (r) => r.__STATUS__ === "MissingInSource",
  );

  const renderTable = (rows, label, iconColor) => {
    if (rows.length === 0) {
      return <p className="text-xs text-gray-400 italic px-3 py-2">None</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-[10px] text-left whitespace-nowrap">
          <thead className="bg-brand-900 text-white sticky top-0 z-10 font-bold">
            <tr>
              <th className="px-2 py-1 border-r border-slate-600 w-12">
                Status
              </th>
              {columns.slice(0, 10).map((col) => (
                <th
                  key={col}
                  className="px-2 py-1 border-r border-slate-600 max-w-xs"
                >
                  {col}
                </th>
              ))}
              {columns.length > 10 && (
                <th className="px-2 py-1 text-gray-300">
                  +{columns.length - 10} more
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((row, idx) => (
              <tr
                key={idx}
                className={`border-b border-gray-200 hover:bg-gray-50 ${
                  row.__STATUS__ === "Matched"
                    ? "bg-green-50"
                    : row.__STATUS__ === "Mismatched"
                      ? "bg-red-50"
                      : "bg-yellow-50"
                }`}
              >
                <td className="px-2 py-1 font-bold text-[9px]">
                  {row.__STATUS__?.charAt(0)}
                </td>
                {columns.slice(0, 10).map((col) => (
                  <td
                    key={`${idx}-${col}`}
                    className="px-2 py-1 text-gray-700 max-w-xs truncate"
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 100 && (
          <p className="text-xs text-gray-400 italic px-3 py-2">
            Showing 100 of {rows.length} records
          </p>
        )}
      </div>
    );
  };

  const toggle = (key) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <div className="flex items-center gap-2 text-slate-700">
        <TrendingUp className="w-5 h-5 text-brand-700" />
        <h3 className="font-bold text-sm">Run Comparison & Results</h3>
      </div>

      {!summary ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-50 rounded-lg border-2 border-dashed border-gray-300 p-8">
          <Users className="w-12 h-12 text-gray-400" />
          <div className="text-center">
            <p className="text-sm font-bold text-gray-700 mb-2">
              Ready to Compare
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Click "Run Comparison" to start reconciliation
            </p>
            <button
              onClick={handleRun}
              disabled={loading}
              className="bg-brand-700 hover:bg-brand-900 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 mx-auto transition-colors"
            >
              <Play className="w-4 h-4" />
              {loading ? "Running..." : "Run Comparison"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <p className="text-xs text-gray-600">Total Source</p>
              <p className="font-bold text-lg text-blue-700">
                {summary.total_source}
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <p className="text-xs text-gray-600">Total Target</p>
              <p className="font-bold text-lg text-blue-700">
                {summary.total_target}
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-2">
              <p className="text-xs text-gray-600">Matched</p>
              <p className="font-bold text-lg text-green-700">
                {summary.matched}
              </p>
            </div>
            <div
              className={`${summary.total_discrepancies > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"} border rounded p-2`}
            >
              <p className="text-xs text-gray-600">Discrepancies</p>
              <p
                className={`font-bold text-lg ${summary.total_discrepancies > 0 ? "text-red-700" : "text-green-700"}`}
              >
                {summary.total_discrepancies}
              </p>
            </div>
          </div>

          {/* Status & Metrics */}
          <div
            className={`rounded-lg p-3 border ${
              summary.status === "PERFECT"
                ? "bg-green-50 border-green-300"
                : summary.status === "CLEAN"
                  ? "bg-green-50 border-green-200"
                  : summary.status === "WARNINGS"
                    ? "bg-yellow-50 border-yellow-300"
                    : "bg-red-50 border-red-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2
                className={`w-4 h-4 ${
                  summary.status === "PERFECT" || summary.status === "CLEAN"
                    ? "text-green-600"
                    : summary.status === "WARNINGS"
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              />
              <span className="font-bold text-sm">{summary.status}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                Missing in Target:{" "}
                <span className="font-bold">{summary.missing_in_target}</span>
              </div>
              <div>
                Missing in Source:{" "}
                <span className="font-bold">{summary.missing_in_source}</span>
              </div>
              <div>
                Column Mismatches:{" "}
                <span className="font-bold">{summary.column_mismatches}</span>
              </div>
            </div>
            <div className="mt-2 text-xs">
              Reconciliation Rate:{" "}
              <span className="font-bold text-green-700">
                {summary.reconciliation_rate}%
              </span>{" "}
              | Discrepancy Rate:{" "}
              <span className="font-bold text-red-700">
                {summary.discrepancy_rate}%
              </span>
            </div>
          </div>

          {/* Recommendations */}
          {summary.recommendations && summary.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <p className="text-xs font-bold text-blue-800 mb-1">
                Recommendations:
              </p>
              <ul className="space-y-0.5">
                {summary.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-xs text-blue-700">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Results Tables */}
          <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-auto">
            {/* Matched */}
            <div className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggle("matched")}
                className="w-full bg-green-100 hover:bg-green-200 text-green-900 px-3 py-2 text-left font-bold text-xs flex items-center justify-between transition-colors"
              >
                <span>✓ Matched ({matched.length})</span>
                {collapsed.matched ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronUp size={16} />
                )}
              </button>
              {!collapsed.matched && (
                <div className="max-h-48 overflow-auto bg-white">
                  {renderTable(matched, "Matched", "green")}
                </div>
              )}
            </div>

            {/* Mismatched */}
            {mismatched.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggle("mismatched")}
                  className="w-full bg-red-100 hover:bg-red-200 text-red-900 px-3 py-2 text-left font-bold text-xs flex items-center justify-between transition-colors"
                >
                  <span>✗ Mismatched ({mismatched.length})</span>
                  {collapsed.mismatched ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronUp size={16} />
                  )}
                </button>
                {!collapsed.mismatched && (
                  <div className="max-h-48 overflow-auto bg-white">
                    {renderTable(mismatched, "Mismatched", "red")}
                  </div>
                )}
              </div>
            )}

            {/* Missing in Target */}
            {missing_in_target.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggle("missing")}
                  className="w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-900 px-3 py-2 text-left font-bold text-xs flex items-center justify-between transition-colors"
                >
                  <span>⚠ Missing in Target ({missing_in_target.length})</span>
                  {collapsed.missing ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronUp size={16} />
                  )}
                </button>
                {!collapsed.missing && (
                  <div className="max-h-48 overflow-auto bg-white">
                    {renderTable(
                      missing_in_target,
                      "Missing in Target",
                      "yellow",
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Missing in Source */}
            {missing_in_source.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggle("missing")}
                  className="w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-900 px-3 py-2 text-left font-bold text-xs flex items-center justify-between transition-colors"
                >
                  <span>⚠ Missing in Source ({missing_in_source.length})</span>
                  {collapsed.missing ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronUp size={16} />
                  )}
                </button>
                {!collapsed.missing && (
                  <div className="max-h-48 overflow-auto bg-white">
                    {renderTable(
                      missing_in_source,
                      "Missing in Source",
                      "yellow",
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export & Reset Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleExport("full")}
              disabled={exporting === "full"}
              className="bg-blue-600 hover:bg-blue-800 disabled:bg-gray-300 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <Download className="w-3 h-3" />
              {exporting === "full" ? "Exporting..." : "Full CSV"}
            </button>
            <button
              onClick={() => handleExport("mismatches")}
              disabled={exporting === "mismatches"}
              className="bg-blue-600 hover:bg-blue-800 disabled:bg-gray-300 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <Download className="w-3 h-3" />
              {exporting === "mismatches" ? "Exporting..." : "Mismatches CSV"}
            </button>
            <button
              onClick={() => handleExport("detail")}
              disabled={exporting === "detail"}
              className="bg-blue-600 hover:bg-blue-800 disabled:bg-gray-300 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <Download className="w-3 h-3" />
              {exporting === "detail" ? "Exporting..." : "Detail CSV"}
            </button>
            <button
              onClick={onReset}
              className="ml-auto bg-gray-600 hover:bg-gray-800 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RunComparisonTab;
