# MongoMirror — MongoDB Migration & Workspace Helper

A modern, high-performance web studio for MongoDB database management, direct cross-instance live migrations, native `mongodump` backups, `mongorestore` archive imports, and flexible JSON/CSV data transfers.

**Live Demo:** [MongoMirror on Vercel](https://mongo-mirror.vercel.app/) *(replace with your deployed Vercel URL)*

Designed with a clean, quiet developer SaaS aesthetic inspired by Linear and Vercel.

---

## Features

### Dual-Pane Workspace Explorer
* **Simultaneous Dual Connections**: Connect two independent MongoDB instances side-by-side (e.g., Local Docker ➔ Production Atlas Cluster, or Staging ➔ Development).
* **Universal URI Support**: Connect using standard `mongodb://` connection strings or Atlas SRV records (`mongodb+srv://`) with authentication and TLS/SSL.
* **Interactive Tree View**: Real-time database discovery, collection hierarchy with hairline guide lines, formatted storage sizes, and document counts with `tabular-nums`.
* **Instant Search**: Filter through dozens of databases and collections in real-time.

### Drag-and-Drop Cross-Instance Live Migration
* **Zero Dump-and-Load Friction**: Drag any collection or database from the Source workspace and drop it directly onto the Target workspace to initiate transfer.
* **Flexible Conflict Policies**:
  * `Skip`: Inserts new documents, preserves existing matching `_id` documents without failing.
  * `Upsert`: Overwrites and updates existing documents matching `_id`.
  * `Fail`: Immediately aborts on duplicate key collision.
* **Multi-Collection Batching**: Migrate selected collections or entire databases in a single batch with index preservation and optional clean-slate drop (`--drop`).

### Native Backup (`mongodump`)
* **Point-in-Time Binary Archives**: Leverages the official MongoDB Database Tools engine to generate `.archive.gz` or `.archive` backups.
* **Preserves Native BSON**: Full preservation of BSON data types, ObjectIds, timestamps, binary data, and database indexes.
* **Intelligent Validation**: Verifies database and collection existence prior to dumping, providing fuzzy typo suggestions.
* **Direct Browser Download**: Automatically streams and downloads the generated archive to your browser.

### External Backup Import & Restore (`mongorestore`)
* **External Archive Support**: Upload any external `.archive` or `.archive.gz` file created by `mongodump` on any machine or CI pipeline.
* **Recent Backups Picker**: One-click restore from locally stored backup archives in `data/backups/`.
* **Namespace Remapping**: Restore an archive into a different destination database name using automatic `--nsFrom` and `--nsTo` translation.
* **Safety Controls**: Optional collection dropping (`--drop`), GZIP decompression toggle (`--gzip`), and stop-on-error enforcement.

### Data Import & Export (JSON / CSV)
* **Multi-Format Export**: Export collections to Standard JSON Array, Extended JSON (EJSON preserving BSON), or flat CSV with optional document limits.
* **File Import**: Drag-and-drop `.json` or `.csv` files directly into any collection with configurable conflict handling.
* **Smart Format Sniffing**: Dropping a `.archive` or `.archive.gz` into the import modal automatically switches to the mongorestore workflow.

### Real-Time Operation Console
* **Monospace Tabular Feed**: Real-time audit log of all connections, queries, backups, restores, and document transfers.
* **Log Level Filters**: Filter by `ALL`, `INFO`, `SUCCESS`, `WARN`, or `ERROR`.
* **Height Presets**: Quick switch between `30%`, `50%`, and `80%` console heights.
* **Copy & Export**: Hover to copy individual log rows or JSON detail payloads, with one-click full session log file export.

---

## Tech Stack

* **Framework**: [Next.js 16](https://nextjs.org/) (App Router & Turbopack)
* **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with custom dark zinc design tokens
* **State Management**: [Zustand](https://github.com/pmndrs/zustand)
* **Data Fetching**: [TanStack Query v5](https://tanstack.com/query/latest)
* **Database Driver**: [MongoDB Node.js Driver v7](https://www.npmjs.com/package/mongodb)
* **Icons & Notifications**: [Lucide Icons](https://lucide.dev/), [Sonner](https://sonner.emilkowal.ski/)

---

## Prerequisites

1. **Node.js**: v18.18 or higher (v20+ recommended).
2. **MongoDB Database Tools** (Optional but recommended for native backup/restore):
   * Install `mongodump` and `mongorestore` from the [MongoDB Database Tools Download](https://www.mongodb.com/try/download/database-tools).
   * Ensure `mongodump` and `mongorestore` are accessible in your system `PATH` or standard installation directories (e.g., `C:\Program Files\MongoDB\Tools\100\bin\` on Windows).

---

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/CodeFiroz/mongo-mirror.git
   cd mongo-mirror
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3005](http://localhost:3005).

---

## Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `next dev --port 3005` | Starts the development server with Turbopack on port 3005 |
| `npm run build` | `next build` | Compiles the production build |
| `npm run start` | `next start` | Runs the compiled production server |
| `npm run lint` | `eslint` | Runs ESLint checks |

---

## Project Structure

```text
mongo-mirror/
├── data/
│   ├── backups/                  # Local storage for generated and downloaded backups
│   └── uploads/                  # Temporary staging for uploaded restore archives
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── connections/      # Connection pool & database/collection inspection APIs
│   │   │   └── operations/       # Backup, restore, migrate, export, import route handlers
│   │   ├── globals.css           # Design tokens, scrollbar styling, dark zinc theme
│   │   ├── layout.tsx            # Root layout with Inter & JetBrains Mono font loading
│   │   └── page.tsx              # Main application entry point
│   ├── components/
│   │   ├── connection/           # Connection card, connection modal, panel container
│   │   ├── explorer/             # Database tree, database item, collection item, empty state
│   │   ├── layout/               # App header, panel header, workspace layout
│   │   ├── operations/           # Backup, restore, migrate, export, import modal dialogs
│   │   └── terminal/             # Operation console panel, controls toolbar, log row
│   ├── lib/                      # MongoDB client pool, utility functions, formatting
│   ├── server/                   # Server-side backup, restore, and migration services
│   ├── stores/                   # Zustand stores for workspace state and terminal logs
│   └── types/                    # TypeScript interfaces for connections, operations, logs
└── package.json
```

---

## Security & Privacy Note

All connection strings and credentials entered into MongoMirror remain strictly in your local server memory and process environment. No connection details, database data, or telemetry are ever sent to external cloud services or third-party servers.

---

## License

MIT © [MongoMirror](https://github.com/codeFiroz/MongoMirror)

## Credits

Created by [Firoz](https://github.com/codeFiroz) — [firoz.codes@gmail.com](mailto:firoz.codes@gmail.com)
