import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useConsole } from "./ConsoleContext";
import {
  Plug,
  Unplug,
  ShieldCheck,
  ShieldAlert,
  Database,
  Copy,
} from "lucide-react";

const M2ConnectionBar = ({ m2Connections, onConnected, onDisconnected }) => {
  const { log } = useConsole();
  const [config, setConfig] = useState({
    environments: [],
    auth_type: "windows",
  });

  // Source connection state
  const [sourceEnv, setSourceEnv] = useState("");
  const [sourceServer, setSourceServer] = useState("");
  const [sourceDatabase, setSourceDatabase] = useState("");
  const [sourceAuthType, setSourceAuthType] = useState("windows");
  const [sourceUsername, setSourceUsername] = useState("");
  const [sourcePassword, setSourcePassword] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);

  // Target connection state
  const [targetEnv, setTargetEnv] = useState("");
  const [targetServer, setTargetServer] = useState("");
  const [targetDatabase, setTargetDatabase] = useState("");
  const [targetAuthType, setTargetAuthType] = useState("windows");
  const [targetUsername, setTargetUsername] = useState("");
  const [targetPassword, setTargetPassword] = useState("");
  const [targetLoading, setTargetLoading] = useState(false);

  const heartbeatRef = useRef(null);

  // Load configuration
  useEffect(() => {
    axios
      .get("/api/config")
      .then((res) => {
        setConfig(res.data);
        log(
          "Module 2 Configuration loaded. Select source and target servers.",
          "system",
        );
      })
      .catch(() => log("Failed to load config.", "error"));
  }, []);

  // Heartbeat polling
  useEffect(() => {
    if (!m2Connections || (!m2Connections.source && !m2Connections.target)) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }
    heartbeatRef.current = setInterval(async () => {
      try {
        const res = await axios.get("/api/heartbeat");
        if (res.data.timed_out) {
          log(`⏱ Session timed out. Disconnecting...`, "warn");
          handleDisconnectAll(true);
        }
      } catch {}
    }, 30000);
    return () => clearInterval(heartbeatRef.current);
  }, [m2Connections]);

  // Safe close
  useEffect(() => {
    const handler = () => {
      if (m2Connections) {
        navigator.sendBeacon("/api/m2/disconnect", "{}");
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [m2Connections]);

  // Helper: Get connection details for source or target
  const getConnectionDetails = (env, server) => {
    const activeEnv = config.environments?.find((e) => e.env_name === env);
    const serverList = activeEnv ? activeEnv.instances : [];

    // If no environment selected, return null
    if (!env || !activeEnv) return null;

    const activeServer = serverList.find((s) => s.server_label === server);

    // Return serverList even if no specific server selected yet
    // This allows the server dropdown to populate when environment is selected
    if (!activeServer) {
      return {
        server: null,
        serverList,
        isSqlAuth: false,
        port: null,
      };
    }

    const globalAuthType = config.auth_type || "windows";
    const instanceHasCreds =
      activeServer &&
      (activeServer.username !== undefined ||
        activeServer.password !== undefined);
    const isSqlAuth = instanceHasCreds ? true : globalAuthType === "sql";

    return {
      server: activeServer,
      serverList,
      isSqlAuth,
      port: activeServer.port,
    };
  };

  const sourceDetails = getConnectionDetails(sourceEnv, sourceServer);
  const targetDetails = getConnectionDetails(targetEnv, targetServer);

  // Connect Source
  const handleConnectSource = async () => {
    if (!sourceDetails) {
      log("Please select a source server first", "error");
      return;
    }

    setSourceLoading(true);
    log(`Connecting to source: ${sourceDetails.server.host}...`, "info");

    try {
      const payload = {
        server: sourceDetails.server.host,
        port: sourceDetails.port,
        database: sourceDatabase,
        connection_type: "source",
      };

      // Only add credentials for SQL Auth
      if (sourceAuthType === "sql") {
        payload.username = sourceUsername;
        payload.password = sourcePassword;
      }

      const res = await axios.post("/api/m2/connect", payload);
      log(`Source connected: ${res.data.message}`, "success");

      onConnected("source", {
        server: sourceDetails.server.host,
        env: sourceEnv,
        port: sourceDetails.port,
        serverLabel: sourceServer,
        authType: sourceAuthType,
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      log(`Source connection failed: ${msg}`, "error");
    } finally {
      setSourceLoading(false);
    }
  };

  // Connect Target
  const handleConnectTarget = async () => {
    if (!targetDetails) {
      log("Please select a target server first", "error");
      return;
    }

    setTargetLoading(true);
    log(`Connecting to target: ${targetDetails.server.host}...`, "info");

    try {
      const payload = {
        server: targetDetails.server.host,
        port: targetDetails.port,
        database: targetDatabase,
        connection_type: "target",
      };

      // Only add credentials for SQL Auth
      if (targetAuthType === "sql") {
        payload.username = targetUsername;
        payload.password = targetPassword;
      }

      const res = await axios.post("/api/m2/connect", payload);
      log(`Target connected: ${res.data.message}`, "success");

      onConnected("target", {
        server: targetDetails.server.host,
        env: targetEnv,
        port: targetDetails.port,
        serverLabel: targetServer,
        authType: targetAuthType,
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      log(`Target connection failed: ${msg}`, "error");
    } finally {
      setTargetLoading(false);
    }
  };

  // Disconnect handler
  const handleDisconnectAll = useCallback(
    (silent = false) => {
      axios.post("/api/m2/disconnect").catch(() => {});
      if (!silent) {
        log("Disconnected from both source and target", "warn");
      }
      onDisconnected();

      // Reset source
      setSourceEnv("");
      setSourceServer("");
      setSourceAuthType("windows");
      setSourceUsername("");
      setSourcePassword("");

      // Reset target
      setTargetEnv("");
      setTargetServer("");
      setTargetAuthType("windows");
      setTargetUsername("");
      setTargetPassword("");
    },
    [onDisconnected, log],
  );

  // Copy source to target
  const handleCopySourceToTarget = () => {
    setTargetEnv(sourceEnv);
    setTargetServer(sourceServer);
    setTargetUsername(sourceUsername);
    setTargetPassword(sourcePassword);
    log("Source connection settings copied to target", "info");
  };

  const isFullyConnected =
    m2Connections && m2Connections.source && m2Connections.target;
  const sourceConnected = m2Connections && m2Connections.source;
  const targetConnected = m2Connections && m2Connections.target;

  return (
    <div className="bg-brand-900 px-4 py-3 border-b border-brand-700/30 flex-shrink-0">
      {/* Connection Status Alert */}
      {!isFullyConnected && (
        <div className="mb-2 text-xs text-yellow-200 bg-yellow-900/30 px-3 py-1 rounded">
          {!sourceConnected &&
            !targetConnected &&
            "📡 Connect to both source and target servers to begin"}
          {sourceConnected &&
            !targetConnected &&
            "✓ Source connected. Connect target server to proceed."}
          {!sourceConnected &&
            targetConnected &&
            "✓ Target connected. Connect source server to proceed."}
        </div>
      )}

      {isFullyConnected ? (
        // Connected View
        <div className="flex items-center gap-4">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <div className="flex-1 grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-gray-400 mb-1">Source</p>
              <p className="text-sm font-semibold text-green-300">
                {m2Connections.source.serverLabel}
              </p>
              <p className="text-xs text-gray-400">
                {m2Connections.source.server}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Target</p>
              <p className="text-sm font-semibold text-green-300">
                {m2Connections.target.serverLabel}
              </p>
              <p className="text-xs text-gray-400">
                {m2Connections.target.server}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDisconnectAll(false)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            <Unplug className="w-4 h-4" />
            Disconnect Both
          </button>
        </div>
      ) : (
        // Disconnected View - Two column layout
        <div className="grid grid-cols-2 gap-4">
          {/* SOURCE SECTION */}
          <div className="border-r border-brand-700/30 pr-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  sourceConnected ? "bg-green-400" : "bg-red-600"
                }`}
              />
              <h3 className="text-sm font-bold text-blue-300">Source</h3>
            </div>

            {!sourceConnected ? (
              <div className="space-y-2">
                <select
                  className="w-full bg-brand-900/80 text-gray-200 text-xs px-2 py-1.5 rounded border border-brand-700/40 focus:border-brand-500 outline-none"
                  value={sourceEnv}
                  onChange={(e) => {
                    setSourceEnv(e.target.value);
                    setSourceServer("");
                  }}
                >
                  <option value="">Environment</option>
                  {(config.environments || []).map((env) => (
                    <option key={env.env_name} value={env.env_name}>
                      {env.env_name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full bg-brand-900/80 text-gray-200 text-xs px-2 py-1.5 rounded border border-brand-700/40 focus:border-brand-500 outline-none disabled:opacity-40"
                  value={sourceServer}
                  onChange={(e) => {
                    setSourceServer(e.target.value);
                    setSourceDatabase("");
                  }}
                  disabled={!sourceEnv}
                >
                  <option value="">Server</option>
                  {sourceDetails?.serverList?.map((srv) => (
                    <option key={srv.server_label} value={srv.server_label}>
                      {srv.server_label}
                    </option>
                  )) || []}
                </select>

                {/* Database Selector - Show when server is selected */}
                {sourceDetails?.server && (
                  <select
                    className="w-full bg-brand-900/80 text-gray-200 text-xs px-2 py-1.5 rounded border border-brand-700/40 focus:border-brand-500 outline-none"
                    value={sourceDatabase}
                    onChange={(e) => setSourceDatabase(e.target.value)}
                  >
                    <option value="">Database</option>
                    {sourceDetails.server.databases?.map((db) => (
                      <option key={db} value={db}>
                        {db}
                      </option>
                    )) || []}
                  </select>
                )}

                {/* Auth Type Selector - Show only when server is selected */}
                {sourceDetails?.server && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSourceAuthType("windows")}
                      className={`flex-1 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                        sourceAuthType === "windows"
                          ? "bg-blue-600 text-white"
                          : "bg-brand-700/50 text-gray-300 hover:bg-brand-700"
                      }`}
                    >
                      Windows Auth
                    </button>
                    <button
                      onClick={() => setSourceAuthType("sql")}
                      className={`flex-1 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                        sourceAuthType === "sql"
                          ? "bg-orange-600 text-white"
                          : "bg-brand-700/50 text-gray-300 hover:bg-brand-700"
                      }`}
                    >
                      SQL Auth
                    </button>
                  </div>
                )}

                {sourceDetails?.server && (
                  <div className="flex items-center gap-1 text-xs text-gray-300 px-2 py-1 bg-brand-900/50 rounded">
                    {sourceAuthType === "sql" ? (
                      <ShieldAlert className="w-3 h-3" />
                    ) : (
                      <ShieldCheck className="w-3 h-3" />
                    )}
                    <span>
                      {sourceAuthType === "sql" ? "SQL Auth" : "Windows Auth"}
                    </span>
                  </div>
                )}

                {sourceAuthType === "sql" && sourceDetails?.server && (
                  <>
                    <input
                      type="text"
                      placeholder="Username"
                      value={sourceUsername}
                      onChange={(e) => setSourceUsername(e.target.value)}
                      className="w-full bg-brand-900/80 text-gray-200 text-xs px-2 py-1.5 rounded border border-brand-700/40 focus:border-brand-500 outline-none placeholder-gray-500"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={sourcePassword}
                      onChange={(e) => setSourcePassword(e.target.value)}
                      className="w-full bg-brand-900/80 text-gray-200 text-xs px-2 py-1.5 rounded border border-brand-700/40 focus:border-brand-500 outline-none placeholder-gray-500"
                    />
                  </>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleConnectSource}
                    disabled={sourceLoading || !sourceDetails}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded transition-colors"
                  >
                    <Plug className="w-3.5 h-3.5" />
                    {sourceLoading ? "Connecting..." : "Connect"}
                  </button>
                  {sourceDetails && (
                    <button
                      onClick={handleCopySourceToTarget}
                      className="px-2 py-1.5 text-xs bg-brand-700 hover:bg-brand-600 text-white rounded transition-colors"
                      title="Copy to target"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-green-300">
                  <p className="font-semibold">
                    {m2Connections.source.serverLabel}
                  </p>
                  <p className="text-gray-400">{m2Connections.source.server}</p>
                </div>
                <button
                  onClick={() => {
                    axios.post("/api/m2/disconnect").catch(() => {});
                    onDisconnected();
                    setSourceEnv("");
                    setSourceServer("");
                    setSourceAuthType("windows");
                    setSourceUsername("");
                    setSourcePassword("");
                    log("Source disconnected", "warn");
                  }}
                  className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {/* TARGET SECTION */}
          <div className="pl-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  targetConnected ? "bg-green-400" : "bg-red-600"
                }`}
              />
              <h3 className="text-sm font-bold text-orange-300">Target</h3>
            </div>

            {!targetConnected ? (
              <div className="space-y-2">
                <select
                  className="w-full bg-brand-900/80 text-gray-200 text-xs px-2 py-1.5 rounded border border-brand-700/40 focus:border-brand-500 outline-none"
                  value={targetEnv}
                  onChange={(e) => {
                    setTargetEnv(e.target.value);
                    setTargetServer("");
                  }}
                >
                  <option value="">Environment</option>
                  {(config.environments || []).map((env) => (
                    <option key={env.env_name} value={env.env_name}>
                      {env.env_name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full bg-brand-900/80 text-gray-200 text-xs px-2 py-1.5 rounded border border-brand-700/40 focus:border-brand-500 outline-none disabled:opacity-40"
                  value={targetServer}
                  onChange={(e) => {
                    setTargetServer(e.target.value);
                    setTargetDatabase("");
                  }}
                  disabled={!targetEnv}
                >
                  <option value="">Server</option>
                  {targetDetails?.serverList?.map((srv) => (
                    <option key={srv.server_label} value={srv.server_label}>
                      {srv.server_label}
                    </option>
                  )) || []}
                </select>

                {/* Database Selector - Show when server is selected */}
                {targetDetails?.server && (
                  <select
                    className="w-full bg-brand-900/80 text-gray-200 text-xs px-2 py-1.5 rounded border border-brand-700/40 focus:border-brand-500 outline-none"
                    value={targetDatabase}
                    onChange={(e) => setTargetDatabase(e.target.value)}
                  >
                    <option value="">Database</option>
                    {targetDetails.server.databases?.map((db) => (
                      <option key={db} value={db}>
                        {db}
                      </option>
                    )) || []}
                  </select>
                )}

                {/* Auth Type Selector - Show only when server is selected */}
                {targetDetails?.server && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTargetAuthType("windows")}
                      className={`flex-1 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                        targetAuthType === "windows"
                          ? "bg-blue-600 text-white"
                          : "bg-brand-700/50 text-gray-300 hover:bg-brand-700"
                      }`}
                    >
                      Windows Auth
                    </button>
                    <button
                      onClick={() => setTargetAuthType("sql")}
                      className={`flex-1 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                        targetAuthType === "sql"
                          ? "bg-orange-600 text-white"
                          : "bg-brand-700/50 text-gray-300 hover:bg-brand-700"
                      }`}
                    >
                      SQL Auth
                    </button>
                  </div>
                )}

                {targetDetails?.server && (
                  <div className="flex items-center gap-1 text-xs text-gray-300 px-2 py-1 bg-brand-900/50 rounded">
                    {targetAuthType === "sql" ? (
                      <ShieldAlert className="w-3 h-3" />
                    ) : (
                      <ShieldCheck className="w-3 h-3" />
                    )}
                    <span>
                      {targetAuthType === "sql" ? "SQL Auth" : "Windows Auth"}
                    </span>
                  </div>
                )}

                {targetAuthType === "sql" && targetDetails?.server && (
                  <>
                    <input
                      type="text"
                      placeholder="Username"
                      value={targetUsername}
                      onChange={(e) => setTargetUsername(e.target.value)}
                      className="w-full bg-brand-900/80 text-gray-200 text-xs px-2 py-1.5 rounded border border-brand-700/40 focus:border-brand-500 outline-none placeholder-gray-500"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={targetPassword}
                      onChange={(e) => setTargetPassword(e.target.value)}
                      className="w-full bg-brand-900/80 text-gray-200 text-xs px-2 py-1.5 rounded border border-brand-700/40 focus:border-brand-500 outline-none placeholder-gray-500"
                    />
                  </>
                )}

                <button
                  onClick={handleConnectTarget}
                  disabled={targetLoading || !targetDetails}
                  className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 text-white rounded transition-colors"
                >
                  <Plug className="w-3.5 h-3.5" />
                  {targetLoading ? "Connecting..." : "Connect"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-green-300">
                  <p className="font-semibold">
                    {m2Connections.target.serverLabel}
                  </p>
                  <p className="text-gray-400">{m2Connections.target.server}</p>
                </div>
                <button
                  onClick={() => {
                    axios.post("/api/m2/disconnect").catch(() => {});
                    onDisconnected();
                    setTargetEnv("");
                    setTargetServer("");
                    setTargetAuthType("windows");
                    setTargetUsername("");
                    setTargetPassword("");
                    log("Target disconnected", "warn");
                  }}
                  className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default M2ConnectionBar;
