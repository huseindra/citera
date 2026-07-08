# Citera

> Evidence intelligence platform — AI-powered clinical document review with explainable retrieval, semantic evidence mapping, and transparent regulatory reasoning.

## Vision

Citera helps regulatory teams review clinical trial documents faster by making AI reasoning transparent, explainable, and auditable.

Unlike traditional Retrieval-Augmented Generation (RAG) systems that only return answers with citations, this platform exposes the complete evidence path behind every AI-generated conclusion.

Every finding is backed by regulations, study protocols, semantic similarity, and an observable audit trail.

---

## Problem

Reviewing an Informed Consent Form (ICF) is a manual and time-consuming process.

Regulatory reviewers must verify that every consent form:

- Includes all required regulatory elements
- Matches the study protocol
- Contains no conflicting information
- Uses compliant language

This often requires hours of cross-referencing between multiple documents.

Current AI tools generate answers.

This platform generates evidence.

---

## Key Features

- 📄 Clinical document ingestion
- 🧠 Hybrid Retrieval (Dense + Sparse Search)
- 📚 Regulation-aware reasoning
- 🔎 Explainable Retrieval
- 🗺️ Semantic Evidence Map
- 🌡️ Evidence Heatmap
- 🔗 Citation Graph
- 📊 Regulation Coverage Matrix
- ⚖️ Protocol vs ICF Alignment
- 📝 AI-assisted compliant language drafting
- 📜 Complete audit replay
- 🛡️ Modular regulatory rule engine

---

## Design Principles

The platform follows four core principles.

### Evidence First

Every conclusion must be supported by verifiable evidence.

### Explainability

Users should understand how every AI decision was made.

### Auditability

Every retrieval, prompt, and generated finding must be reproducible.

### Human-in-the-Loop

The platform assists reviewers rather than replacing them.

---

## Planned Architecture

See [docs/architecture.md](docs/architecture.md) for the authoritative technical architecture.

```
Frontend
React + Vite

        │

        ▼

FastAPI Backend

        │

        ▼

Document Processing

OCR
↓

Chunking
↓

Embedding
↓

Hybrid Retrieval
↓

Rule Engine
↓

Claude
↓

Evidence Graph
↓

Audit Log
```

---

## Technology Stack

The authoritative list lives in [docs/architecture.md](docs/architecture.md). Summary:

Frontend

- React + Vite
- TypeScript
- Tailwind CSS
- TanStack Query

Backend

- FastAPI
- Python

AI

- Claude API
- Embedding Models
- Reranking Models
- Hybrid Retrieval

Storage

- PostgreSQL
- Object Storage
- Qdrant
- Neo4j (planned)

Infrastructure

- Docker
- GitHub Actions
- OpenTelemetry

---

## Roadmap

- [ ] Document ingestion
- [ ] OCR pipeline
- [ ] Chunking pipeline
- [ ] Embedding pipeline
- [ ] Hybrid Retrieval
- [ ] Regulation Engine
- [ ] Evidence Heatmap
- [ ] Semantic Evidence Map
- [ ] Citation Graph
- [ ] Explainable Retrieval
- [ ] Audit Replay
- [ ] FDA 21 CFR Part 50 Rule Set
- [ ] Common Rule (45 CFR 46) Rule Set

---

## Philosophy

AI should not only generate answers.

AI should generate trust.

Trust comes from transparent evidence, observable reasoning, and verifiable regulatory compliance.

Every feature in this repository exists to make AI reasoning visible.
