/**
 * ======================================================
 * env.js (Environment Configuration)
 * ======================================================
 *
 * Purpose:
 * - Centralize runtime configuration
 * - Define service endpoints and system identity
 *
 * Design:
 * - Static config (machine-level)
 * - No logic
 * - Node-only usage
 */

module.exports = {

  /* ======================================================
     SERVER SETTINGS
     ====================================================== */

  SERVER_PORT: 3000,


  /* ======================================================
     EXTERNAL SERVICES
     ====================================================== */

  // Backward compatibility (NO break)
  TRAINING_SERVER_BASE: "http://10.192.74.39:8002",
  INFERENCE_SERVER_BASE: "http://127.0.0.1:8005",
  CAMERA_SERVER_BASE: "http://127.0.0.1:8001",

  /* ======================================================
     STATION IDENTITY
     ====================================================== */

  STATION: "station_01",
  PROCESS: "final_inspection"

};