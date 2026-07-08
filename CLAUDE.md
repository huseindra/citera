# CLAUDE.md

# Philosophy

This project is built on a simple belief:

AI should not only generate answers.

AI should generate trust.

Trust comes from transparent evidence, explainable reasoning, and complete auditability.

Every feature in this repository should strengthen those three principles.

If a feature improves AI accuracy but reduces transparency, question whether it belongs.

---

# Project Overview

## Project

Citera — Evidence Intelligence Platform

## Mission

Build an AI-native platform that helps clinical researchers and regulatory reviewers analyze clinical trial documents through transparent, evidence-driven AI.

Unlike traditional Retrieval-Augmented Generation (RAG) systems, this project focuses on **Evidence Observability**.

Every AI-generated finding should be traceable back to its supporting regulations, protocol sections, retrieved evidence, and reasoning process.

The objective is not to replace reviewers.

The objective is to help reviewers trust AI.

---

# Core Product Principles

Every feature should strengthen one or more of these principles.

## Evidence First

Never generate conclusions without evidence.

Evidence should always be inspectable.

---

## Explainability

Every finding should answer:

- Why?
- Based on what?
- How confident?
- Which regulation?
- Which protocol section?

---

## Auditability

Every decision should be replayable.

Reviewers must be able to inspect:

- retrieval
- reranking
- prompt context
- generated output

---

## Human-in-the-Loop

The reviewer always makes the final decision.

AI assists.

Humans approve.

---

## Semantic Understanding

Prioritize semantic reasoning over keyword matching.

Always compare meaning instead of exact wording.

---

## Simplicity

Avoid unnecessary engineering complexity.

Prefer simple, maintainable solutions.

Architecture should evolve with the product.

Do not optimize for scale before Product-Market Fit.

---

# Success Criteria

The product succeeds if a reviewer can answer these questions within seconds.

- What is wrong?
- Why is it wrong?
- Where is the supporting evidence?
- Which regulation applies?
- How confident is the AI?
- Can I independently verify this finding?

Everything else is secondary.
