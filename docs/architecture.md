## System Architecture

### Frontend

* React
* Vite
* TypeScript
* Tailwind CSS
* React Router
* TanStack Query
* React Hook Form
* Zod

### Backend

* FastAPI
* Python

### Storage

* PostgreSQL
* Object Storage

### Vector Database

* Qdrant

### Knowledge Graph (Future)

* Neo4j

### AI Services

* Claude API
* Embedding Models
* Reranking Models

### Observability

* OpenTelemetry
* Structured Logging
* Audit Logging

---

## Repository Structure

```
apps/
├── web/                # React + Vite frontend
├── api/                # FastAPI backend
├── workers/            # Background jobs
├── ai/                 # AI pipelines
└── shared/             # Shared schemas and utilities

docs/
infrastructure/
scripts/
```

---

## Frontend Principles

The frontend should prioritize clarity over visual complexity.

Design every interaction around evidence exploration rather than chat.

Primary interface components include:

* Evidence Heatmap
* Semantic Evidence Map
* Citation Graph
* Retrieval Explorer
* Regulation Coverage Matrix
* Protocol Alignment Viewer
* Audit Replay Timeline
* Document Comparison Workspace

Use React component composition and keep business logic out of UI components.

Favor reusable, strongly typed components with predictable state management.

Avoid framework-specific abstractions that make future maintenance difficult.
