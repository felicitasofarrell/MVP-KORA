# KORA MVP — Internal AI Copilot for CX Operations

> An AI-powered internal assistant designed to help CX teams retrieve operational knowledge faster, reduce dependency on tribal knowledge, and answer internal questions grounded in company documentation.

## Overview

KORA is a minimum viable product for an internal AI assistant built for the **Analista CX** role at Nubceo.  
Its goal is to centralize fragmented internal knowledge and turn it into a fast, conversational support tool for day-to-day operational work.

Instead of forcing teams to search across documents, notes, and informal channels, KORA provides a chat-based interface that answers questions using a **Retrieval-Augmented Generation (RAG)** workflow powered by OpenAI.

This repository contains the end-to-end MVP, including:

- a **React + Vite frontend** for the chat experience,
- a **FastAPI backend** exposing the assistant APIs,
- a **document ingestion pipeline** for normalization and indexing,
- and the data layer used to support retrieval.

---

## Why this project matters

Operational teams often rely on:

- scattered documentation,
- repeated questions across teams,
- context stored in people's heads instead of systems,
- slow onboarding for new team members,
- and inconsistent answers depending on who is available.

KORA addresses that by creating a single assistant capable of answering internal questions grounded in existing documentation.

### Core value proposition

- **Faster access to internal knowledge**
- **Reduced onboarding friction**
- **Less dependency on informal knowledge holders**
- **More consistent operational answers**
- **A foundation for future agentic workflows**

---

## What the MVP does

The current MVP supports the following flow:

1. Internal documents are collected and normalized.
2. Content is chunked and indexed for semantic retrieval.
3. A user asks a question in the chat UI.
4. The backend retrieves relevant context.
5. The LLM generates an answer grounded in the retrieved documents.
6. The response is returned through the frontend.

### Current capabilities

- Chat-style interface for asking operational questions
- FastAPI backend with API endpoints for querying and ingestion
- RAG-based answering using internal documentation
- Document preprocessing and indexing pipeline
- Modular project structure across frontend, backend, data, and scripts

---

## Product vision

While this repository contains an MVP, the broader vision behind KORA is larger:

KORA is intended to evolve from a retrieval assistant into an **operational copilot** capable of:

- guiding onboarding flows,
- assisting with standard operating procedures,
- supporting decision-making in internal operations,
- capturing recurring questions as reusable knowledge,
- and eventually orchestrating more structured, semi-automated operational workflows.

This MVP is the first step: **reliable access to internal knowledge through a conversational interface**.

---

## Architecture

### High-level architecture

```text
User
  ↓
Frontend (React + Vite)
  ↓
Backend API (FastAPI)
  ├── /ask      → question answering
  └── /ingest   → document ingestion
  ↓
Retrieval Layer
  ├── normalized documents
  ├── chunks
  └── vector index
  ↓
LLM (OpenAI)
  ↓
Grounded answer returned to user


################### GCS#####################

# Firebase, correr en el frontend
npm install firebase

