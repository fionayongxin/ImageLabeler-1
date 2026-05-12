let NodeSSPI;
try {
  NodeSSPI = require("node-sspi");
} catch (e) {
  console.warn("[Auth] node-sspi is not installed. IIS header-based auth only.");
}

const sql = require("mssql");
const { FLEXFLOW_CONN } = require("../config/db");

// Parse connection string for mssql config
const parseConnectionString = (connStr) => {
  const config = {};
  const parts = connStr.split(';');
  parts.forEach(part => {
    const [key, value] = part.split('=');
    if (key && value) {
      const cleanKey = key.trim().toLowerCase();
      const cleanValue = value.trim();
      switch (cleanKey) {
        case 'server':
          config.server = cleanValue;
          break;
        case 'database':
          config.database = cleanValue;
          break;
        case 'trusted_connection':
          config.trustServerCertificate = cleanValue.toLowerCase() === 'true';
          config.integratedSecurity = cleanValue.toLowerCase() === 'true';
          break;
        case 'trustservercertificate':
          config.trustServerCertificate = cleanValue.toLowerCase() === 'true';
          break;
      }
    }
  });
  return config;
};

const sqlConfig = {
  ...parseConnectionString(FLEXFLOW_CONN),
  options: {
    encrypt: false,
    enableArithAbort: true
  }
};

const pool = new sql.ConnectionPool(sqlConfig);
const poolConnect = pool.connect().catch(err => {
  console.error("[Auth] SQL pool connection failed:", err);
});

function normalizeUserId(userId) {
  if (!userId) return "";
  let u = userId.trim();
  const slash = u.lastIndexOf("\\");
  if (slash >= 0 && slash < u.length - 1) u = u.slice(slash + 1);
  const at = u.indexOf("@");
  if (at > 0) u = u.slice(0, at);
  return u.toLowerCase();
}

async function lookupFlexFlowEmployee(userId) {
  await poolConnect;
  const request = pool.request();
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

function getRemoteUser(req) {
  if (req.connection && req.connection.user) return req.connection.user;
  if (req.connection && req.connection.userName) return req.connection.userName;
  if (req.headers["x-iisnode-logon_user"]) return req.headers["x-iisnode-logon_user"];
  if (req.headers["remote_user"]) return req.headers["remote_user"];
  return null;
}

async function authMiddleware(req, res, next) {
  if (NodeSSPI) {
    const nodeSSPI = new NodeSSPI({ retrieveGroups: false });

    return nodeSSPI.authenticate(req, res, async function (err) {
      if (err) return next(err);
      if (res.finished) return;

      const rawUser = getRemoteUser(req);
      const normalizedUser = normalizeUserId(rawUser);

      if (!normalizedUser) {
        return res.status(401).json({
          error:
            "Windows authentication required. If running behind IIS, enable Windows Auth; otherwise install node-sspi and build tools."
        });
      }

      let employee;
      try {
        employee = await lookupFlexFlowEmployee(normalizedUser);
      } catch (lookupError) {
        console.error("[Auth] FlexFlow lookup failed", lookupError);
        return res.status(500).json({ error: "Authentication service unavailable" });
      }

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
    });
  }

  const rawUser = getRemoteUser(req);
  const normalizedUser = normalizeUserId(rawUser);

  if (!normalizedUser) {
    return res.status(401).json({
      error:
        "Windows authentication required. If using IIS, enable Windows Authentication and pass REMOTE_USER/LOGON_USER."
    });
  }

  let employee;
  try {
    employee = await lookupFlexFlowEmployee(normalizedUser);
  } catch (lookupError) {
    console.error("[Auth] FlexFlow lookup failed", lookupError);
    return res.status(500).json({ error: "Authentication service unavailable" });
  }

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
}

module.exports = authMiddleware;
