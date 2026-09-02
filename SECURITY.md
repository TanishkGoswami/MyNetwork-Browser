# Security Architecture & Policies: MyNetwork Browser

## 1. Security Design Principles

MyNetwork Browser follows defense-in-depth principles across process isolation, webview sandboxing, safe URL handling, and local storage containment.

---

## 2. Process & Context Isolation

1. **Webview Sandboxing**:
   - Webviews run third-party web content in isolated renderer instances with `allowpopups` and separated guest contexts.
   - Node integration is disabled in guest web content.
2. **Main / Renderer Separation**:
   - The main process maintains strict validation on all IPC channels.
   - Renderer initiates native window operations (minimize, maximize, close) strictly through typed, bounded IPC messages.
3. **Safe URL Navigation**:
   - Raw user input is sanitized before protocol evaluation.
   - Non-standard protocols (e.g., `javascript:`, `data:`, `file:`) are validated and prevented from bypassing engine security policies.
   - Custom browser schemes (`mynetwork://newtab`, `zen://newtab`) resolve strictly to safe local internal templates.

---

## 3. Data & Storage Security

1. **Storage Sandboxing**:
   - User notes, tasks, and history are scoped to isolated local application storage.
   - No external trackers, telemetry beacons, or unauthorized external sync calls exist in the core codebase.
2. **AI Assistant Safety**:
   - Future AI integrations must run via authenticated user keys or local inference models without leaking full raw disk or credentials to remote endpoints.
