# KORA MVP — Asistente de onboarding para rol de CX

Asistente interno impulsado por IA, diseñado para ayudar a equipos de **Customer Experience (CX)** a acceder más rápido al conocimiento operativo, reducir la dependencia del conocimiento informal y responder preguntas internas basadas en documentación de la empresa.

## Descripción general

KORA es un **producto mínimo viable (MVP)** de un asistente interno de IA, desarrollado para el rol de **Analista CX** en Nubceo.

Su objetivo es centralizar conocimiento interno fragmentado y transformarlo en una herramienta conversacional, ágil y útil para el trabajo operativo del día a día.

En lugar de obligar a los equipos a buscar información entre documentos dispersos, notas sueltas o canales informales, KORA ofrece una interfaz tipo chat que responde preguntas utilizando un flujo de **Retrieval-Augmented Generation (RAG)** potenciado por OpenAI.

Este repositorio contiene el MVP de punta a punta, incluyendo:

- un **frontend en React + Vite** para la experiencia conversacional,
- un **backend en FastAPI** que expone las APIs del asistente,
- un pipeline de **ingesta de documentos** para normalización e indexado,
- y la capa de datos que soporta el proceso de recuperación de información.

## Por qué este proyecto es importante

Los equipos operativos suelen depender de:

- documentación dispersa,
- preguntas repetidas entre equipos,
- contexto almacenado en la cabeza de las personas en vez de sistemas,
- procesos de onboarding lentos para nuevos integrantes,
- y respuestas inconsistentes según quién esté disponible.

KORA busca resolver esto mediante un único asistente capaz de responder preguntas internas de forma consistente, basándose en documentación existente.

## Propuesta de valor principal

- Acceso más rápido al conocimiento interno
- Menor fricción en el onboarding
- Menor dependencia de referentes informales
- Respuestas operativas más consistentes
- Base para futuros flujos agentic

## Qué hace el MVP

El MVP actual soporta el siguiente flujo:

1. Los documentos internos se recopilan y normalizan.
2. El contenido se divide en fragmentos y se indexa para recuperación semántica.
3. Un usuario realiza una pregunta desde la interfaz de chat.
4. El backend recupera el contexto más relevante.
5. El modelo genera una respuesta basada en los documentos recuperados.
6. La respuesta se devuelve al frontend.

## Capacidades actuales

- Interfaz tipo chat para consultas operativas
- Backend en FastAPI con endpoints para consulta e ingesta
- Respuestas basadas en RAG usando documentación interna
- Pipeline de preprocesamiento e indexado de documentos
- Estructura modular separada entre frontend, backend, data y scripts

## Visión de producto

Aunque este repositorio contiene un MVP, la visión detrás de KORA es más amplia.

KORA está pensado para evolucionar desde un asistente de consulta documental hacia un **copiloto operativo**, capaz de:

- guiar procesos de onboarding,
- asistir en procedimientos operativos estándar,
- apoyar la toma de decisiones en operaciones internas,
- capturar preguntas recurrentes como conocimiento reutilizable,
- y eventualmente orquestar flujos operativos más estructurados y semiautomatizados.

Este MVP representa el primer paso: **acceso confiable al conocimiento interno a través de una interfaz conversacional**.

## Arquitectura

### Arquitectura de alto nivel

```text
Usuario
  ↓
Frontend (React + Vite)
  ↓
Backend API (FastAPI)
  ├── /ask      → preguntas al asistente
  └── /ingest   → ingesta de documentos
  ↓
Capa de recuperación
  ├── documentos normalizados
  ├── chunks
  └── índice vectorial
  ↓
LLM (OpenAI)
  ↓
Respuesta fundamentada al usuario
