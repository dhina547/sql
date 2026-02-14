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
  const [exporting, setExporting] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // "table" or "detail"

  // --- Run Comparison ---
  const handleRun = async () => {
    setLoading(true);
    log(
      "â”€â”€â”€â”€â”€ Running SQL-to-SQL Comparison â”€â”€â”€â”€â”€",
      "header",
    );

    try {
      const payload = {
        source_query: m2State.source_query,
        target_query: m2State.target_query,
        source_key: m2State.source_key,
        target_key: m2State.target_key,
        use_connections: true,
      };

      const sourceServer =
        m2Connections?.source?.serverLabel ||
        m2Connections?.source?.server ||
        "Source";
      const targetServer =
        m2Connections?.target?.serverLabel ||
        m2Connections?.target?.server ||
        "Target";

      log(`Comparing: ${sourceServer} â†” ${targetServer}`, "info");
      log(
        `Primary Keys: ${m2State.source_key} â†’ ${m2State.target_key}`,
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
          Object.keys(result.table_data[0]).filter(
            (k) => k !== "__STATUS__" && k !== "__COMMON_KEY__",
          ),
        );
      }

      log(
        `Comparison complete! ${result.record_count} total records processed`,
        "success",
      );

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

  // --- Render Table View (Excel-like with Highlighting) ---
  const renderTableView = () => {
    if (!allData || allData.length === 0) return null;

    // Get base column names (without _Source or _Target suffix)
    const baseColNames = [];
    const colSet = new Set();
    columns.forEach((col) => {
      if (col.endsWith("_Source")) {
        const baseName = col.replace("_Source", "");
        colSet.add(baseName);
      }
    });
    colSet.forEach((col) => baseColNames.push(col));

    return (
      <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-300">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-gray-100 border-b-2 border-gray-400">
            <tr>
              <th className="border border-gray-300 px-3 py-2 font-bold text-left bg-gray-200 w-24">
                Status
              </th>
              <th className="border border-gray-300 px-3 py-2 font-bold text-left bg-gray-200 w-32">
                Key
              </th>
              {baseColNames.map((colName) => (
                <th
                  key={colName}
                  className="border border-gray-300 px-3 py-2 font-bold text-left bg-gray-200 min-w-48"
                >
                  {colName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allData.map((row, idx) => {
              const status = row.__STATUS__;
              const key = row.__COMMON_KEY__;

              // Status styling
              const statusStyles = {
                Matched: "bg-green-100 border-green-300",
                Mismatched: "bg-red-100 border-red-300",
                MissingInTarget: "bg-yellow-100 border-yellow-300",
                MissingInSource: "bg-yellow-100 border-yellow-300",
              };

              const statusBadge = {
                Matched: "✓ Matched",
                Mismatched: "✗ Mismatch",
                MissingInTarget: "⚠ Missing Target",
                MissingInSource: "⚠ Missing Source",
              };

              const rowBgClass = statusStyles[status] || "bg-white";

              return (
                <tr
                  key={idx}
                  className={`border-b border-gray-300 hover:bg-gray-50`}
                >
                  {/* Status Column */}
                  <td
                    className={`border border-gray-300 px-3 py-2 font-bold ${rowBgClass}`}
                  >
                    <span className="whitespace-nowrap">
                      {statusBadge[status]}
                    </span>
                  </td>

                  {/* Key Column */}
                  <td
                    className={`border border-gray-300 px-3 py-2 font-mono ${rowBgClass}`}
                  >
                    {String(key).includes("NULL") ? (
                      <span className="text-red-600 font-bold italic">
                        ∅ {key}
                      </span>
                    ) : (
                      key
                    )}
                  </td>

                  {/* Data Columns */}
                  {baseColNames.map((colName) => {
                    const sourceCol = `${colName}_Source`;
                    const targetCol = `${colName}_Target`;
                    const sourceVal = row[sourceCol];
                    const targetVal = row[targetCol];

                    // Determine if values mismatch
                    const isMismatch =
                      status === "Mismatched" &&
                      sourceVal !== "" &&
                      sourceVal !== null &&
                      targetVal !== "" &&
                      targetVal !== null &&
                      String(sourceVal) !== String(targetVal);

                    // Determine background color
                    let cellBg = "bg-white";
                    if (isMismatch) {
                      cellBg = "bg-red-300";
                    } else if (status === "MissingInTarget") {
                      cellBg = "bg-yellow-50";
                    } else if (status === "MissingInSource") {
                      cellBg = "bg-yellow-50";
                    }

                    return (
                      <td
                        key={sourceCol}
                        className={`border border-gray-300 px-3 py-2 ${cellBg} ${
                          isMismatch ? "font-bold text-white" : ""
                        }`}
                      >
                        <div className="flex gap-1">
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 font-semibold">
                              Source:
                            </div>
                            <div
                              className={
                                isMismatch ? "text-white font-bold" : ""
                              }
                            >
                              {sourceVal !== null && sourceVal !== ""
                                ? sourceVal
                                : "—"}
                            </div>
                          </div>
                          {(status === "Mismatched" ||
                            status === "MissingInSource") && (
                            <>
                              <div className="border-l-2 border-gray-400 mx-1"></div>
                              <div className="flex-1">
                                <div className="text-xs text-gray-500 font-semibold">
                                  Target:
                                </div>
                                <div
                                  className={
                                    isMismatch ? "text-white font-bold" : ""
                                  }
                                >
                                  {targetVal !== null && targetVal !== ""
                                    ? targetVal
                                    : "—"}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
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

  // --- Render Side-by-Side Comparison Tables ---
  const renderComparison = () => {
    if (!allData || allData.length === 0) return null;

    // Get base column names (without _Source or _Target suffix)
    const baseColNames = new Set();
    columns.forEach((col) => {
      if (col.endsWith("_Source")) {
        baseColNames.add(col.replace("_Source", ""));
      }
    });

    return (
      <div className="space-y-3 overflow-y-auto pr-2">
        {allData.map((row, idx) => {
          const status = row.__STATUS__;
          const key = row.__COMMON_KEY__;

          const statusConfig = {
            Matched: {
              border: "border-green-400",
              bg: "bg-green-50",
              label: "âœ“ Matched",
              textColor: "text-green-900",
            },
            Mismatched: {
              border: "border-red-400",
              bg: "bg-red-50",
              label: "âœ— Mismatched",
              textColor: "text-red-900",
            },
            MissingInTarget: {
              border: "border-yellow-400",
              bg: "bg-yellow-50",
              label: "âš  Missing in Target",
              textColor: "text-yellow-900",
            },
            MissingInSource: {
              border: "border-yellow-400",
              bg: "bg-yellow-50",
              label: "âš  Missing in Source",
              textColor: "text-yellow-900",
            },
          };

          const config = statusConfig[status] || statusConfig.Matched;

          return (
            <div
              key={idx}
              className={`border-2 ${config.border} ${config.bg} rounded-lg p-3`}
            >
              {/* Header */}
              <div className={`text-xs font-bold ${config.textColor} mb-2`}>
                {config.label} - Key: <span className="font-mono">{key}</span>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-4">
                {/* Source Column */}
                <div className="bg-white bg-opacity-60 rounded p-2 border border-blue-200">
                  <div className="text-xs font-bold bg-blue-100 text-blue-900 px-2 py-1 rounded mb-2">
                    Source Database
                  </div>
                  <div className="space-y-2 text-xs">
                    {Array.from(baseColNames).map((colName) => {
                      const sourceCol = `${colName}_Source`;
                      const targetCol = `${colName}_Target`;
                      const sourceVal = row[sourceCol];
                      const targetVal = row[targetCol];

                      // Determine if this cell should be highlighted
                      const isMismatch =
                        status === "Mismatched" &&
                        sourceVal !== "" &&
                        sourceVal !== null &&
                        targetVal !== "" &&
                        targetVal !== null &&
                        String(sourceVal) !== String(targetVal);

                      return (
                        <div
                          key={sourceCol}
                          className={`px-2 py-1 rounded ${
                            isMismatch
                              ? "bg-red-400 text-white font-bold"
                              : "bg-gray-100"
                          }`}
                        >
                          <span className="font-bold">{colName}:</span>{" "}
                          {sourceVal !== null && sourceVal !== ""
                            ? sourceVal
                            : "-"}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Target Column */}
                <div className="bg-white bg-opacity-60 rounded p-2 border border-purple-200">
                  <div className="text-xs font-bold bg-purple-100 text-purple-900 px-2 py-1 rounded mb-2">
                    Target Database
                  </div>
                  <div className="space-y-2 text-xs">
                    {Array.from(baseColNames).map((colName) => {
                      const sourceCol = `${colName}_Source`;
                      const targetCol = `${colName}_Target`;
                      const sourceVal = row[sourceCol];
                      const targetVal = row[targetCol];

                      // Determine if this cell should be highlighted
                      const isMismatch =
                        status === "Mismatched" &&
                        sourceVal !== "" &&
                        sourceVal !== null &&
                        targetVal !== "" &&
                        targetVal !== null &&
                        String(sourceVal) !== String(targetVal);

                      return (
                        <div
                          key={targetCol}
                          className={`px-2 py-1 rounded ${
                            isMismatch
                              ? "bg-red-400 text-white font-bold"
                              : "bg-gray-100"
                          }`}
                        >
                          <span className="font-bold">{colName}:</span>{" "}
                          {targetVal !== null && targetVal !== ""
                            ? targetVal
                            : "-"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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
          {/* Summary Metrics - Compact */}
          <div className="grid grid-cols-4 gap-2">
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
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <p className="text-xs text-gray-600">Discrepancies</p>
              <p className="font-bold text-lg text-red-700">
                {summary.total_discrepancies}
              </p>
            </div>
          </div>

          {/* NULL Key Information */}
          {(summary.null_key_source > 0 || summary.null_key_target > 0) && (
            <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
              <p className="text-sm font-bold text-orange-900 mb-2">
                ⚠ Records with NULL or Empty Primary Keys
              </p>
              <p className="text-xs text-orange-800">
                {summary.null_key_source > 0 && (
                  <span>
                    {summary.null_key_source} source records have NULL keys
                    •{" "}
                  </span>
                )}
                {summary.null_key_target > 0 && (
                  <span>
                    {summary.null_key_target} target records have NULL keys
                  </span>
                )}
              </p>
              <p className="text-xs text-orange-700 mt-1 italic">
                These records cannot be matched and are marked as missing.
                Consider validating your primary key column.
              </p>
            </div>
          )}

          {/* View Mode Tabs */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setViewMode("table")}
              className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                viewMode === "table"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              📊 Table View
            </button>
            <button
              onClick={() => setViewMode("detail")}
              className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                viewMode === "detail"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              📋 Detail View
            </button>
            <p className="text-xs text-gray-600 ml-auto">
              Red = Mismatched Values | Yellow = Missing Records
            </p>
          </div>

          {/* Comparison View */}
          <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
            {viewMode === "table" ? (
              <div className="flex-1 overflow-y-auto">{renderTableView()}</div>
            ) : (
              <div className="flex-1 overflow-y-auto">{renderComparison()}</div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 flex-wrap">
            <button
              onClick={() => handleExport("full")}
              disabled={exporting === "full"}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              {exporting === "full" ? "Exporting..." : "Full CSV"}
            </button>
            <button
              onClick={() => handleExport("mismatches")}
              disabled={exporting === "mismatches"}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              {exporting === "mismatches" ? "Exporting..." : "Mismatches CSV"}
            </button>
            <button
              onClick={() => handleExport("detail")}
              disabled={exporting === "detail"}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              {exporting === "detail" ? "Exporting..." : "Detail CSV"}
            </button>
            <button
              onClick={onReset}
              className="ml-auto bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RunComparisonTab;
