const sql = require("mssql/msnodesqlv8");

const sqlConfig = {
  server: "PNANTE859",
  database: "FF_TERADYNE_H1A",
  driver: "ODBC Driver 17 for SQL Server",
  options: {
    trustedConnection: true,
    trustServerCertificate: true
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const pool = new sql.ConnectionPool(sqlConfig);
let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = pool.connect().catch(err => {
      poolPromise = null; // allow retry next time
      throw err;
    });
  }
  return poolPromise;
}

function normalizeUserId(userId) {
  if (!userId) return "";
  let u = userId.trim();

  const slash = u.lastIndexOf("\\");
  if (slash >= 0 && slash < u.length - 1) {
    u = u.slice(slash + 1);
  }

  const at = u.indexOf("@");
  if (at > 0) {
    u = u.slice(0, at);
  }

  return u.toLowerCase();
}

function getRemoteUser(req) {
  if (req.connection && req.connection.user) return req.connection.user;
  if (req.connection && req.connection.userName) return req.connection.userName;
  if (req.headers["x-iisnode-logon_user"]) return req.headers["x-iisnode-logon_user"];
  if (req.headers["remote_user"]) return req.headers["remote_user"];
  return null;
}

async function lookupFlexFlowEmployee(userId) {
  const connectedPool = await getPool();

  const request = connectedPool.request();
  request.input("UserId", sql.NVarChar(128), userId);

  const result = await request.query(`
    SELECT TOP (1)
      ID,
      UserID,
      Firstname,
      Lastname,
      EmployeeGroupID,
      StatusID
    FROM dbo.ffEmployee
    WHERE UserID = @UserId
      AND StatusID = 1;
  `);

  return result.recordset[0] || null;
}

async function authMiddleware(req, res, next) {
  const rawUser = getRemoteUser(req);
  const normalizedUser = normalizeUserId(rawUser);

  if (!normalizedUser) {
    return res.status(401).json({
      error: "Windows authentication required."
    });
  }

  try {
    const employee = await lookupFlexFlowEmployee(normalizedUser);

    if (!employee) {
      return res.status(403).json({ error: "Access denied" });
    }

    req.user = {
      id: employee.ID,
      userId: employee.UserID,
      firstName: employee.Firstname,
      lastName: employee.Lastname,
      employeeGroupId: employee.EmployeeGroupID,
      statusId: employee.StatusID
    };

    next();
  } catch (err) {
    console.error("[Auth] SQL / FlexFlow lookup failed:", err);
    return res.status(500).json({
      error: "Authentication service unavailable"
    });
  }
}

module.exports = authMiddleware;