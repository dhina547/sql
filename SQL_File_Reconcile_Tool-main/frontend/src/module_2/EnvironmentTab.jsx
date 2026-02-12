import React, { useState, useEffect } from "react";
import axios from "axios";
import { useConsole } from "../common_Resources/ConsoleContext";
import { Database, ChevronDown } from "lucide-react";

const EnvironmentTab = ({ m2State, setM2State, onNext }) => {
  const { log } = useConsole();
  const [environments, setEnvironments] = useState([]);
  const [databases, setDatabases] = useState({ source: [], target: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load environments from config via API
    const loadEnvs = async () => {
      try {
        // This would be a new backend endpoint we add
        // For now, use app config directly if available
        const envs = ["QA_Release_1", "UAT_Phase_2"];
        setEnvironments(envs);
        log("Environments loaded", "info");
      } catch (err) {
        log("Failed to load environments", "error");
      }
    };
    loadEnvs();
  }, []);

  const handleEnvironmentSelect = (type, env) => {
    setM2State((prev) => ({
      ...prev,
      [type === "source" ? "source_env" : "target_env"]: env,
    }));
    log(
      `Selected ${type === "source" ? "Source" : "Target"} Environment: ${env}`,
      "info",
    );
  };

  const handleDatabaseSelect = (type, db) => {
    setM2State((prev) => ({
      ...prev,
      [type === "source" ? "source_db" : "target_db"]: db,
    }));
    log(
      `Selected ${type === "source" ? "Source" : "Target"} Database: ${db}`,
      "info",
    );
  };

  const isComplete =
    m2State.source_env &&
    m2State.target_env &&
    m2State.source_db &&
    m2State.target_db;

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center gap-2 text-slate-700">
        <Database className="w-5 h-5 text-brand-700" />
        <h3 className="font-bold text-sm">Environment & Database Selection</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {/* Source Environment */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-600">
            Source Environment
          </label>
          <select
            value={m2State.source_env}
            onChange={(e) => handleEnvironmentSelect("source", e.target.value)}
            className="p-2 border border-gray-300 rounded-lg text-sm bg-white focus:border-brand-700 focus:ring-1 focus:ring-brand-700 outline-none"
          >
            <option value="">Select Environment...</option>
            {environments.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </select>
          {m2State.source_env && (
            <span className="text-xs text-green-600 font-semibold">
              ✓ Selected
            </span>
          )}
        </div>

        {/* Target Environment */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-600">
            Target Environment
          </label>
          <select
            value={m2State.target_env}
            onChange={(e) => handleEnvironmentSelect("target", e.target.value)}
            className="p-2 border border-gray-300 rounded-lg text-sm bg-white focus:border-brand-700 focus:ring-1 focus:ring-brand-700 outline-none"
          >
            <option value="">Select Environment...</option>
            {environments.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </select>
          {m2State.target_env && (
            <span className="text-xs text-green-600 font-semibold">
              ✓ Selected
            </span>
          )}
        </div>

        {/* Source Database */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-600">
            Source Database
          </label>
          <input
            type="text"
            value={m2State.source_db}
            onChange={(e) => handleDatabaseSelect("source", e.target.value)}
            placeholder="e.g., PayDB"
            className="p-2 border border-gray-300 rounded-lg text-sm bg-white focus:border-brand-700 focus:ring-1 focus:ring-brand-700 outline-none"
          />
          {m2State.source_db && (
            <span className="text-xs text-green-600 font-semibold">
              ✓ {m2State.source_db}
            </span>
          )}
        </div>

        {/* Target Database */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-600">
            Target Database
          </label>
          <input
            type="text"
            value={m2State.target_db}
            onChange={(e) => handleDatabaseSelect("target", e.target.value)}
            placeholder="e.g., PayDB"
            className="p-2 border border-gray-300 rounded-lg text-sm bg-white focus:border-brand-700 focus:ring-1 focus:ring-brand-700 outline-none"
          />
          {m2State.target_db && (
            <span className="text-xs text-green-600 font-semibold">
              ✓ {m2State.target_db}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">
          {isComplete
            ? "✓ Configuration complete"
            : "Configure environment and database selections"}
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

export default EnvironmentTab;
