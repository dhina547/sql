# Module 2 Connection Feature - User Guide

## What Changed?

Module 2 now includes a **Connection Bar** at the top of the screen, just like Module 1. This connection bar lets you securely connect to SQL Server before running any reconciliation queries.

---

## How to Use Module 2 with Server Connection

### Step 1: Switch to Module 2

Click **SQL-to-SQL** in the sidebar to activate Module 2.

You'll see the **M2ConnectionBar** at the top with dropdowns for:

- Environment
- Server
- Username/Password (if needed)

### Step 2: Select Environment

- Click the **Environment** dropdown
- Choose your environment (e.g., "QA_Release_1", "UAT_Phase_2")

### Step 3: Select Server

- Click the **Server** dropdown
- Choose a server from your selected environment
- The dropdown displays the server label and host

### Step 4: Enter Credentials (if required)

**Windows Authentication (Default):**

- No credentials needed
- Click **Connect**
- You'll connect using your current Windows user

**SQL Server Authentication:**

- A **Username** and **Password** field will appear
- Enter your SQL Server credentials
- Click **Connect**

### Step 5: Connect

- Click the **"Connect"** button
- The system validates your credentials
- A green dot appears next to your server name when connected

### Step 6: Run Your Reconciliation

Once connected, the **SQL Query** tab unlocks. You can now:

1. Write and execute SQL queries for source and target
2. Map keys between results
3. Run the full comparison
4. Export results

### Disconnect

- Click the **"Disconnect"** button in the connection bar
- All state is reset and you return to the Environment selection screen

---

## Authentication Types Explained

### Windows Authentication ✓

- **What it is**: You connect as your Windows user account
- **When to use**: In corporate networks with Windows domain integration
- **Credentials**: None needed (grayed out)
- **Badge display**: "Windows Auth"

### SQL Server Authentication

- **What it is**: You connect with an SQL Server username and password
- **When to use**: When SQL Server is using SQL Auth or you need specific permissions
- **Credentials**: Username and password required
- **Badge display**: "SQL Auth"

---

## Session Timeout

**Important:** Your connection automatically times out after **10 minutes of inactivity**.

This is a security feature to prevent unauthorized access.

### How to avoid timeout:

- Stay active in the application
- The timer resets with every action you take
- Your heartbeat keeps the session alive

### What happens on timeout:

- A warning appears in the console
- You're automatically disconnected
- You must reconnect to continue

---

## Comparison with Module 1

| Feature               | Module 1 (SQL→File) | Module 2 (SQL→SQL) |
| --------------------- | ------------------- | ------------------ |
| Connection Bar        | ✓ Yes               | ✓ Yes (NEW)        |
| Server Selection      | ✓ Yes               | ✓ Yes (NEW)        |
| Auth Types            | Windows + SQL       | Windows + SQL      |
| Credential Validation | ✓ Yes               | ✓ Yes (NEW)        |
| Idle Timeout          | ✓ 10 minutes        | ✓ 10 minutes (NEW) |
| Safe Browser Close    | ✓ sendBeacon        | ✓ sendBeacon (NEW) |

---

## Configuration (Admins)

The connection bar reads from **db_config.json** in the backend.

If your environments/servers don't appear, ask your admin to update:

```json
{
  "auth_type": "windows",
  "idle_timeout_minutes": 10,
  "environments": [
    {
      "env_name": "QA_Release_1",
      "instances": [
        {
          "server_label": "QA1_Payments_Server",
          "host": "localhost\\SQLEXPRESS",
          "port": 1433,
          "databases": ["PayDB", "UserDB"]
        }
      ]
    }
  ]
}
```

**Per-Instance Overrides** (optional):

```json
{
  "server_label": "PROD_Primary",
  "host": "prod.domain.com",
  "username": "sa", // Override auth type
  "password": "secret123" // Use SQL Auth instead
}
```

---

## Troubleshooting

### "Connection failed"

**Problem**: Connection attempt failed  
**Solutions**:

- Check server name/hostname is correct
- Verify SQL Server service is running
- Check firewall isn't blocking port (usually 1433)
- For SQL Auth: verify username/password

### "Validation Failed: credentials do not match"

**Problem**: Your entered credentials don't match the config  
**Solutions**:

- Ask your admin to add your credentials to db_config.json
- Use the credentials your admin provided

### "Timed out after 10 minutes"

**Problem**: Session expired due to inactivity  
**Solutions**:

- Click Disconnect
- Reconnect using Connection Bar
- Work faster next time 😊

### Password fields not appearing

**Problem**: Only username appears or no credential fields at all  
**Solutions**:

- System detected Windows Authentication
- Just click Connect (no password needed)
- If you need SQL Auth, check config

---

## Security Notes

✓ **Credentials are validated server-side** - Prevents unauthorized access  
✓ **Sessions timeout automatically** - Inactive users are logged out  
✓ **Safe browser close** - Disconnect message sent even if closed abruptly  
✓ **Per-user credentials** (optional) - Different users = different access levels  
✓ **No credentials in URLs** - All sent securely via POST

---

## What's Next?

Once connected, Module 2 works like this:

```
Environment (shows connection status)
    ↓
SQL Query Tab (write and execute queries on source and target)
    ↓
Keys Mapping Tab (specify which column is your primary key)
    ↓
Run Comparison Tab (see mismatches and export results)
```

Enjoy your secure SQL-to-SQL reconciliation!
