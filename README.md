# CCE Public Dashboard (Cloud)

This is the public-facing component of the **Cascade Compounding Engine (CCE)**. It is a lightweight Express.js server designed to run on a cloud platform (like Railway, Heroku, or Vercel) to display trading results without exposing the core trading engine's IP address or security keys.

## 🚀 Features

- **Secure Sync**: Receives data from the private Node (Raspberry Pi) via a secured API endpoint.
- **Public Dashboard**: Serves a clean, read-only HTML/JS frontend to visualize portfolio performance.
- **Ephemeral Storage**: Uses in-memory storage for simplicity (state is refreshed by the Node every cycle).
- **Security**: Implements rate limiting, Helmet headers, and secret-key authentication for syncs.

## 🛠️ Prerequisites

- Node.js v18+
- A cloud hosting provider (Recommended: [Railway](https://railway.app/))

## 📦 Local Development

1. **Install Dependencies**

    ```bash
    npm install
    ```

2. **Configure Environment**
    Create a `.env` file in the `Cloud` directory:

    ```env
    PORT=8080
    SYNC_SECRET=my_local_secret_password
    ```

3. **Start Server**

    ```bash
    npm start
    ```

    The dashboard will be available at `http://localhost:8080`.

4. **Test Sync (Optional)**
    You can simulate a sync from the Node using curl:

    ```bash
    curl -X POST http://localhost:8080/api/sync \
      -H "Content-Type: application/json" \
      -H "x-sync-secret: my_local_secret_password" \
      -d '{"stats": {"current_state": "TESTING", "portfolio_value": 1000}}'
    ```

## ☁️ Deployment (Railway)

This project is optimized for Railway, but works on any Node.js host.

1. **Push to GitHub**: Ensure this `Cloud` folder is in a GitHub repository.
2. **New Project on Railway**:
    - Click "New Project" > "Deploy from GitHub repo".
    - Select your repository.
    - **Important**: If this is a monorepo (Node + Cloud in one repo), configure the **Root Directory** in Railway settings to `/Cloud`.
3. **Set Environment Variables**:
    - Go to the "Variables" tab in Railway.
    - Add `SYNC_SECRET`: Generate a strong password (e.g., `Xy9#mK2$pL5vQ`).
    - (Optional) `PORT`: Railway sets this automatically, but you can define it if needed.

4. **Get Public URL**:
    - Railway will generate a domain (e.g., `cce-dashboard.up.railway.app`).
    - Use this URL to configure your Raspberry Pi Node.

## 🔗 Integration with Node (Pi)

Once deployed, update your **Node** (Raspberry Pi) `.env` file to point to this cloud instance:

```env
# On Raspberry Pi (.env)
CLOUD_URL=https://your-app-name.up.railway.app/api/sync
SYNC_SECRET=TheSameSecretYouSetOnRailway
```

## 📡 API Reference

### `POST /api/sync`

Used by the private Node to push updates.

- **Headers**:
  - `x-sync-secret`: Must match `SYNC_SECRET` env var.
  - `Content-Type`: `application/json`
- **Body**: JSON object containing `stats`, `history`, and `trades`.

### `GET /api/data`

Used by the frontend to fetch the latest state.

- **Public**: Yes
- **Rate Limit**: 100 requests per 15 minutes per IP.
- **Response**: JSON object of the current dashboard state.

## 🛡️ Security Notes

- **No Database**: This server does not connect to a database. It holds the latest sync data in memory. If the server restarts, data is lost until the next sync from the Pi.
- **Read-Only**: The public interface cannot execute trades or modify settings.
- **DDoS Protection**: Basic rate limiting is enabled via `express-rate-limit`.

---

&copy; 2026 Giblets Creations
