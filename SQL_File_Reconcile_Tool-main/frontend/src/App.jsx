import React, { useState, useRef, useEffect } from "react";
import { ConsoleProvider, useConsole } from "./common_Resources/ConsoleContext";
import Sidebar from "./common_Resources/Sidebar";
import ConnectionBar from "./common_Resources/ConnectionBar";
import M2ConnectionBar from "./common_Resources/M2ConnectionBar";
import ConsolePanel from "./common_Resources/ConsolePanel";
import SqlQueryTab from "./module_1/SqlQueryTab";
import FileUploadTab from "./module_1/FileUploadTab";
import KeysMappingTab from "./module_1/KeysMappingTab";
import RunComparisonTab from "./module_1/RunComparisonTab";
import EnvironmentTab from "./module_2/EnvironmentTab";
import SqlQueryTabM2 from "./module_2/SqlQueryTab";
import KeysMappingTabM2 from "./module_2/KeysMappingTab";
import RunComparisonTabM2 from "./module_2/RunComparisonTab";
import FileToFilePlaceholder from "./module_3/Placeholder";

const TABS_M1 = [
  { id: "sql-query", label: "SQL Query" },
  { id: "file-upload", label: "File Upload" },
  { id: "keys-mapping", label: "Keys Mapping" },
  { id: "run-comparison", label: "Run Comparison" },
];

const TABS_M2 = [
  { id: "environment", label: "Environment" },
  { id: "sql-query", label: "SQL Query" },
  { id: "keys-mapping", label: "Keys Mapping" },
  { id: "run-comparison", label: "Run Comparison" },
];

// ───── Inner App (inside ConsoleProvider) ─────
const AppInner = () => {
  const { log } = useConsole();

  // ── Global state ──
  const [activeModule, setActiveModule] = useState("sql-to-file");
  const [activeTab, setActiveTab] = useState("sql-query");
  const [connection, setConnection] = useState(null);
  const [m2Connections, setM2Connections] = useState(null); // { source, target }

  // ── Module 1: Lifted tab state ──
  const [sqlState, setSqlState] = useState({
    query: "",
    columns: [],
    rows: [],
    count: 0,
    executed: false,
  });
  const [fileState, setFileState] = useState({
    fileId: null,
    fileName: "",
    columns: [],
    rows: [],
    count: 0,
    uploaded: false,
  });
  const [mappingState, setMappingState] = useState({
    mapping: {},
    keys: [],
    initialized: false,
  });

  // ── Module 2: Lifted tab state ──
  const [m2State, setM2State] = useState({
    source_env: "",
    target_env: "",
    source_db: "",
    target_db: "",
    source_query: "",
    target_query: "",
    source_columns: [],
    target_columns: [],
    source_rows: [],
    target_rows: [],
    source_count: 0,
    target_count: 0,
    source_executed: false,
    target_executed: false,
    source_key: "",
    target_key: "",
    keys_mapped: false,
  });

  // ── Resizable console ──
  const [consoleHeight, setConsoleHeight] = useState(280);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const onMouseDown = (e) => {
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = consoleHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      const delta = startY.current - e.clientY;
      const newH = Math.max(
        100,
        Math.min(window.innerHeight - 200, startH.current + delta),
      );
      setConsoleHeight(newH);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [consoleHeight]);

  // ── Tab lock logic ──
  const tabEnabled = (tabId) => {
    // Module 1
    if (activeModule === "sql-to-file") {
      if (!connection) return false;
      if (tabId === "sql-query") return true;
      if (tabId === "file-upload") return sqlState.executed;
      if (tabId === "keys-mapping")
        return sqlState.executed && fileState.uploaded;
      if (tabId === "run-comparison")
        return (
          sqlState.executed && fileState.uploaded && mappingState.initialized
        );
      return false;
    }

    // Module 2
    if (activeModule === "sql-to-sql") {
      if (tabId === "environment") return true; // Always allow connection bar
      if (tabId === "sql-query")
        return m2Connections && m2Connections.source && m2Connections.target;
      if (tabId === "keys-mapping")
        return (
          m2Connections &&
          m2Connections.source &&
          m2Connections.target &&
          m2State.source_executed &&
          m2State.target_executed
        );
      if (tabId === "run-comparison")
        return (
          m2Connections &&
          m2Connections.source &&
          m2Connections.target &&
          m2State.keys_mapped &&
          m2State.source_key &&
          m2State.target_key
        );
      return false;
    }

    return false;
  };

  // ── Connection handlers ──
  const handleConnected = (conn) => {
    setConnection(conn);
    if (activeModule === "sql-to-file") {
      setTimeout(() => setActiveTab("sql-query"), 300);
    }
  };

  const handleDisconnected = () => {
    setConnection(null);
    setActiveTab(activeModule === "sql-to-file" ? "sql-query" : "environment");
    setSqlState({
      query: "",
      columns: [],
      rows: [],
      count: 0,
      executed: false,
    });
    setFileState({
      fileId: null,
      fileName: "",
      columns: [],
      rows: [],
      count: 0,
      uploaded: false,
    });
    setMappingState({ mapping: {}, keys: [], initialized: false });
    log("All state reset.", "system");
  };

  const handleM2Connected = (type, conn) => {
    // type is "source" or "target"
    setM2Connections((prev) => ({
      ...prev,
      [type]: conn,
    }));
    if (activeTab === "environment") {
      setTimeout(() => setActiveTab("sql-query"), 300);
    }
  };

  const handleM2Disconnected = () => {
    setM2Connections(null);
    setActiveTab("environment");
    setM2State({
      source_env: "",
      target_env: "",
      source_db: "",
      target_db: "",
      source_query: "",
      target_query: "",
      source_columns: [],
      target_columns: [],
      source_rows: [],
      target_rows: [],
      source_count: 0,
      target_count: 0,
      source_executed: false,
      target_executed: false,
      source_key: "",
      target_key: "",
      keys_mapped: false,
    });
    log("Module 2 connection closed. State reset.", "system");
  };

  // ── Module change handler ──
  const handleModuleChange = (moduleId) => {
    setActiveModule(moduleId);
    setConnection(null);
    setM2Connections(null);
    if (moduleId === "sql-to-file") {
      setActiveTab("sql-query");
    } else if (moduleId === "sql-to-sql") {
      setActiveTab("environment");
    }
    log(
      `Switched to ${moduleId === "sql-to-file" ? "SQL-to-File" : "SQL-to-SQL"} module`,
      "system",
    );
  };

  // ── Next handlers ──
  const goNext = (from) => {
    const TABS = activeModule === "sql-to-file" ? TABS_M1 : TABS_M2;
    const order = TABS.map((t) => t.id);
    const idx = order.indexOf(from);
    if (idx >= 0 && idx < order.length - 1) {
      setActiveTab(order[idx + 1]);
    }
  };

  // ── Reset for new comparison ──
  const handleReset = () => {
    if (activeModule === "sql-to-file") {
      setSqlState({
        query: "",
        columns: [],
        rows: [],
        count: 0,
        executed: false,
      });
      setFileState({
        fileId: null,
        fileName: "",
        columns: [],
        rows: [],
        count: 0,
        uploaded: false,
      });
      setMappingState({ mapping: {}, keys: [], initialized: false });
      setActiveTab("sql-query");
    } else if (activeModule === "sql-to-sql") {
      setM2State({
        source_env: "",
        target_env: "",
        source_db: "",
        target_db: "",
        source_query: "",
        target_query: "",
        source_columns: [],
        target_columns: [],
        source_rows: [],
        target_rows: [],
        source_count: 0,
        target_count: 0,
        source_executed: false,
        target_executed: false,
        source_key: "",
        target_key: "",
        keys_mapped: false,
      });
      setActiveTab("environment");
    }
    log("───── New Comparison ─────", "header");
    log("State cleared. Ready for a new comparison.", "system");
  };

  // ── Render active tab content ──
  const renderTab = () => {
    // Module 3 placeholder (no connection required)
    if (activeModule === "file-to-file") return <FileToFilePlaceholder />;

    // Module 2: SQL-to-SQL
    if (activeModule === "sql-to-sql") {
      if (!m2Connections || !m2Connections.source || !m2Connections.target) {
        return (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Connect to both source and target servers using the connection bar
            above to begin.
          </div>
        );
      }
      switch (activeTab) {
        case "environment":
          return (
            <div className="h-full flex items-center justify-center text-gray-600 text-sm p-4">
              <div className="text-center">
                <p className="font-semibold mb-4">
                  Connected to Both Servers! ✅
                </p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-blue-400 mb-1">
                      Source
                    </p>
                    <p className="text-xs text-gray-400">
                      {m2Connections.source.serverLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-orange-400 mb-1">
                      Target
                    </p>
                    <p className="text-xs text-gray-400">
                      {m2Connections.target.serverLabel}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Proceed to the SQL Query tab to write and execute your
                  comparison queries.
                </p>
              </div>
            </div>
          );
        case "sql-query":
          return (
            <SqlQueryTabM2
              m2State={m2State}
              setM2State={setM2State}
              m2Connections={m2Connections}
              onNext={() => goNext("sql-query")}
            />
          );
        case "keys-mapping":
          return (
            <KeysMappingTabM2
              m2State={m2State}
              setM2State={setM2State}
              onNext={() => goNext("keys-mapping")}
            />
          );
        case "run-comparison":
          return (
            <RunComparisonTabM2
              m2State={m2State}
              m2Connections={m2Connections}
              onReset={handleReset}
            />
          );
        default:
          return null;
      }
    }

    // Module 1: SQL-to-File (requires connection)
    if (!connection) {
      return (
        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
          Connect to a database to begin.
        </div>
      );
    }
    switch (activeTab) {
      case "sql-query":
        return (
          <SqlQueryTab
            connection={connection}
            sqlState={sqlState}
            setSqlState={setSqlState}
            onNext={() => goNext("sql-query")}
          />
        );
      case "file-upload":
        return (
          <FileUploadTab
            fileState={fileState}
            setFileState={setFileState}
            onNext={() => goNext("file-upload")}
          />
        );
      case "keys-mapping":
        return (
          <KeysMappingTab
            sqlState={sqlState}
            fileState={fileState}
            mappingState={mappingState}
            setMappingState={setMappingState}
            onNext={() => goNext("keys-mapping")}
          />
        );
      case "run-comparison":
        return (
          <RunComparisonTab
            connection={connection}
            sqlState={sqlState}
            fileState={fileState}
            mappingState={mappingState}
            onReset={handleReset}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
      {/* ── Sidebar ── */}
      <Sidebar
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
      />

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Connection Bar (Module 1: SQL-to-File) ── */}
        {activeModule === "sql-to-file" && (
          <ConnectionBar
            connection={connection}
            onConnected={handleConnected}
            onDisconnected={handleDisconnected}
          />
        )}

        {/* ── Connection Bar (Module 2: SQL-to-SQL) ── */}
        {activeModule === "sql-to-sql" && (
          <M2ConnectionBar
            m2Connections={m2Connections}
            onConnected={handleM2Connected}
            onDisconnected={handleM2Disconnected}
          />
        )}

        {/* ── Tab Bar ── */}
        <div className="bg-white border-b border-gray-200 flex px-2 pt-1 gap-0.5 flex-shrink-0">
          {(activeModule === "sql-to-file" ? TABS_M1 : TABS_M2).map(
            (tab, i) => {
              const enabled = tabEnabled(tab.id);
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => enabled && setActiveTab(tab.id)}
                  disabled={!enabled}
                  className={`px-4 py-2 text-xs font-bold rounded-t transition-all relative
                                    ${
                                      active
                                        ? "bg-gray-50 text-brand-900 border border-b-0 border-gray-200 -mb-px z-10"
                                        : enabled
                                          ? "text-gray-500 hover:text-brand-700 hover:bg-brand-100/20"
                                          : "text-gray-300 cursor-default"
                                    }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold flex-shrink-0
                                        ${active ? "bg-brand-700 text-white" : enabled ? "bg-brand-500/60 text-white" : "bg-gray-200 text-gray-400"}`}
                    >
                      {i + 1}
                    </span>
                    {tab.label}
                  </span>
                </button>
              );
            },
          )}
        </div>

        {/* ── Content + Console Split ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content area */}
          <div className="flex-1 overflow-auto bg-gray-50">{renderTab()}</div>

          {/* Drag handle */}
          <div
            onMouseDown={onMouseDown}
            className="h-1.5 bg-gray-300 hover:bg-brand-700 cursor-row-resize flex-shrink-0 transition-colors relative group"
          >
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
              <div className="w-8 h-0.5 bg-gray-400 group-hover:bg-white rounded-full" />
            </div>
          </div>

          {/* Console */}
          <div
            style={{ height: consoleHeight }}
            className="flex-shrink-0 overflow-hidden"
          >
            <ConsolePanel />
          </div>
        </div>
      </div>
    </div>
  );
};

// ───── Root App with Provider ─────
const App = () => (
  <ConsoleProvider>
    <AppInner />
  </ConsoleProvider>
);

export default App;
