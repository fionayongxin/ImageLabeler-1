const FLEXFLOW_CONN =
  process.env.FLEXFLOW_CONN ||
  "Driver={ODBC Driver 17 for SQL Server};Server=PNANTE859;Database=FF_TERADYNE_H1A;Trusted_Connection=Yes;TrustServerCertificate=Yes;";

module.exports = {
  FLEXFLOW_CONN
};
