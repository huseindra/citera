# Multi-Jurisdiction Ruleset Research

> Research report — verified against primary legal texts (statute PDFs downloaded
> and text-extracted), July 2026. No implementation yet. Facts marked
> **UNVERIFIED** must be human-confirmed before they appear on a compliance report.

Baseline: the FDA pack has 8 rules from 21 CFR 50.25(a)(1)–(8) — purpose/procedures,
risks, benefits, alternatives, confidentiality, injury compensation, contacts,
voluntary participation. Every rule = one YAML with `citation`, `description`,
`retrieval_queries`, `evaluation_criteria`, `severity`.

---

## 1. HSA Singapore (preview)

**Key finding — our registry entry is legally wrong for drug trials.** The registry
currently names "Human Biomedical Research Act (HBRA)", but HBRA's Second Schedule
(paras 6–7) **excludes** clinical trials of health products and medicinal products
from HBRA entirely. For drug/IMP trials (our product's core case) the correct
instrument is:

- **Health Products (Clinical Trials) Regulations 2016 (S 331/2016), reg 19(1)(a)–(u)**
  — a statutory, enumerated list of ~21 consent elements (ICH-GCP hard-coded into law),
  identical text in Medicines (Clinical Trials) Regulations 2016 reg 19(1).
- **HBRA 2015 s 12(1)/(2)** applies only to non-regulated biomedical/tissue research.

All 8 FDA elements map cleanly onto reg 19(1). Net-new beyond FDA: subject
responsibilities (e), pro-rated payment (k), subject expenses (l), new-information
duty (p), termination circumstances (r), approximate subject count (t), regulator
record-access disclosure (n), and the Singapore-specific **tissue triple** in (ta)
(voluntariness + IP renunciation, export of tissue from Singapore, incidental-finding
re-identification — added by S 731/2021).

- Official text: English (no translation risk).
- Old SG-GCP superseded; HSA adopted ICH E6(R3) Principles + Annex 1 effective
  1 Jan 2026 (**UNVERIFIED exact date** — hsa.gov.sg blocked automated fetch).
- Estimated pack: **~14 content rules** (grouping the 21 letters the way FDA groups
  (a)(1)) for drug trials, citing HP(CT) reg 19(1). HBRA variant deferred.
- Registry fix needed at implementation time: name → "Health Products (Clinical
  Trials) Regulations 2016, reg 19".

Sources: sso.agc.gov.sg/Act/HBRA2015 · sso.agc.gov.sg/SL/HPA2007-S331-2016 ·
sso.agc.gov.sg/SL/MA1975-S335-2016 · hsa.gov.sg clinical-trials pages.
Extracted statute text saved in session scratchpad (hbra.txt, hpct.txt, med.txt).

---

## 2. BPOM Indonesia (preview)

**Authority: Peraturan BPOM No. 8 Tahun 2024** (Tata Laksana Persetujuan Pelaksanaan
Uji Klinik; replaces PerKa 21/2015), whose **Lampiran I = Pedoman CUKB** (Indonesian
GCP, full ICH-GCP adoption, binding via Pasal 5(1)). Amended by **PerBPOM No. 34
Tahun 2025** (adds cosmetics trials; Lampiran I re-issued **verbatim** — 4.8.10
byte-identical, so citations are stable).

- Consent content list: **CUKB butir 4.8.10 huruf a–t** — 20 elements, the ICH E6
  4.8.10 mirror. All 8 FDA elements map cleanly.
- Net-new beyond FDA: randomization probability (c), subject responsibilities (e),
  pro-rated payment (k), expenses (l), record-access authorization (n),
  new-information duty (p), termination (r), subject count (t).
- Worth encoding as structural rules: **4.8.9** impartial witness for illiterate
  subjects; **4.8.11** signed/dated copy to subject; **Ketentuan Umum butir 17**
  mandatory sponsor compensation/insurance statement in the subject information
  (stronger than FDA (a)(6)).
- **Language:** official text Bahasa Indonesia only. Retrieval queries for this pack
  must be written in Indonesian ("menarik diri tanpa hukuman", "kerahasiaan identitas
  subjek", "kompensasi cedera", …) because the engine retrieves semantically over the
  ICF text. Needs an Indonesian sample ICF/protocol pair to validate retrieval +
  embedding quality (voyage-3.5-lite is multilingual, but unproven in our pipeline
  for Indonesian).
- No hard "ICF must be in Bahasa Indonesia" clause found; CUKB 4.8.6 requires
  comprehensibility to the subject. (**UNVERIFIED:** UU 24/2009 applicability to
  ICFs; KEPPKN 2021 item numbering — do not cite either.)
- Estimated pack: **20 content rules + 3 structural**, citation string
  `PerBPOM No. 8 Tahun 2024, Lampiran I (Pedoman CUKB), butir 4.8.10 huruf (x)`.

Sources: peraturan.bpk.go.id/Details/286416 (PDF verified) ·
standar-otskk.pom.go.id PerBPOM-34-2025 PDF · jdih.pom.go.id.
Extracted text in session scratchpad (perbpom8.txt, perbpom34.txt).

---

## 3. TGA Australia (preview)

**No single statute enumerates ICF content.** Three layers, bound together by
**Therapeutic Goods Regulations 1990 reg 12AD** (conditions of CTN/CTA supply):

1. **NHMRC National Statement** — 2025 edition; **Ch 2.2 unchanged from 2023**
   (2.2.6 (a)–(m) word-for-word identical → citations stable). Element list 2.2.6
   plus core disclosure 2.2.2. Effective date of the 2025 edition ~23 June 2026
   (**UNVERIFIED** — confirm on nhmrc.gov.au).
2. **ICH GCP as adopted by TGA** — in transition: **E6(R2) §4.8.10(a)–(t)** or
   **E6(R3) Annex 1 §2.8.10(a)–(v)** both acceptable **13 Jan 2026 – 13 Jan 2027**;
   R3-only afterwards. Section number AND letters shift between versions
   (voluntariness m→l, injury j→i, contacts q→r) → pack should emit dual citations
   during the window. E6(R3) adds 3 new elements: post-withdrawal follow-up (m),
   data handling on withdrawal (n), results/actual-treatment availability (v);
   risks extend to participant's partner.
3. Devices use ISO 14155, not ICH GCP (TG (MD) Regs 2002 reg 7.5) — out of v1 scope.

Net-new beyond FDA (selection): separate **complaints contact** distinct from
researchers (NS 2.2.6(d)) — very Australian; funding sources + declarations of
interest (2.2.6(h),(i)); how the research is monitored (b); data-withdrawal
implications (g); dissemination/publication + registration (k); no-exculpatory-
language check (R3 2.8.4). Australia prohibits deferred/retrospective consent
(NS 4.5.7, TGA annotation).

- Official text: English.
- Estimated pack: **~14–16 rules**, mostly Major/Minor severity (National Statement
  language is "should", HRECs enforce) — needs the softest severity calibration of
  the three.
- (**UNVERIFIED:** Medicines Australia compensation-guideline convention.)

Sources: nhmrc.gov.au NS 2025/2023 PDFs (diffed) · tga.gov.au E6(R3) adoption pages ·
database.ich.org E6(R2)/E6(R3) PDFs · austlii reg 12AD · TGA Clinical Trial Handbook.

---

## 4. Roadmap survey (one paragraph each)

- **EMA/EU — CTR 536/2014 Art. 29(2)(a)–(e)** + Annex I section L. ~9 checkable
  requirements, principles-based (layperson-comprehensibility is a legal test; EU
  trial number + results availability; mandatory prior interview). GDPR overlay
  (EDPB Opinion 3/2019: CTR consent ≠ GDPR legal basis → ICF needs GDPR Art. 13/14
  notice). 24 official languages. Hardest to make crisp; needs CTR core + GDPR
  sub-pack + per-country deltas.
- **MHRA/UK — SI 2004/1031 Schedule 1 Part 3 paras 1–5.** Thinnest statutory list
  (5 conditions, no content enumeration); detail lives in HRA/MHRA guidance. Amended
  (not replaced) by SI 2025/538, in force 28 Apr 2026 (new simplified/cluster-trial
  consent routes) — moving target, revisit after the dust settles.
- **PMDA/Japan — J-GCP (MHLW Ordinance No. 28/1997) Art. 51(1) items 1–17.**
  Exactly 17 crisp items — very machine-checkable. Distinctive: IRB identity/
  deliberation disclosure (item 15). Official text Japanese; PMDA English translation
  is unofficial.
- **Health Canada — FDR C.05.010(h)(i)–(ii)** (minimal) + **TCPS 2 (2022) Art. 3.2
  (a)–(l)** (12 elements, "as appropriate" flexibility → several rules can only be
  warnings). Distinctive: commercialization + conflicts of interest (e), withdrawal
  of data/biological materials (d). English + French official.
- **NMPA/China — GCP 2020 (Announcement No. 57) Art. 24 items (一)–(二十).**
  20 items, near-verbatim ICH E6(R2) mirror — conceptually the easiest superset of
  FDA, but official text Chinese only, and secondary sources report a 2026 E6(R3)
  revision (**UNVERIFIED** — confirm article numbering against NMPA before building).

---

## 5. Cross-cutting design implications

1. **ICH E6 is the convergence point.** Indonesia (full adoption), China (mirror),
   Singapore (statutory transposition), Japan (close), Australia/Canada (adopted as
   GCP layer). A shared internal element taxonomy keyed to ICH E6 4.8.10/2.8.10 —
   with per-jurisdiction citations and deltas — avoids re-authoring 20 rules five
   times. The YAML pack format already supports this: same rule content, different
   `citation`/`id` per pack. No engine change required.
2. **Engine gaps found (future work, not blockers):**
   - *Conditional rules* — "if tissue is collected" (SG (ta)), "where applicable"
     (HBRA/TCPS). v1 workaround: encode condition inside `evaluation_criteria`
     ("if the study collects tissue …; otherwise report satisfied") — the evaluator
     reads the protocol, so it can judge applicability. Longer term: an
     `applicability:` field.
   - *Dual citations* (TGA transition window) — `citation` is free text; emit
     "E6(R2) 4.8.10(m) / E6(R3) 2.8.10(l)". No change needed.
   - *Severity vocabulary* (critical/major/minor) suffices; TGA pack skews major/minor.
3. **Indonesian-language pipeline validation is the only real technical risk** —
   needs an Indonesian sample ICF+protocol pair and a check that Voyage embeddings +
   Claude evaluation hold quality in Bahasa Indonesia before BPOM ships.
4. **Registry corrections at implementation time:** HSA entry name (HBRA → HP(CT)
   Regs reg 19); TGA entry fine; BPOM name → "PerBPOM 8/2024 — CUKB (Pedoman Cara
   Uji Klinik yang Baik)".

## 6. Recommended order & effort

| Order | Pack | Rules | Why | Effort |
|---|---|---|---|---|
| 1 | **HSA Singapore** | ~14 | English, statutory enumerated list, cleanest mapping | S |
| 2 | **BPOM Indonesia** | 20+3 | ICH mirror, but Indonesian queries + sample docs + retrieval validation | M |
| 3 | **TGA Australia** | ~14–16 | Multi-layer (NS + GCP), dual-citation window, severity calibration | M |
| 4+ | PMDA → NMPA → Health Canada → EMA → MHRA | — | Japan is the crispest next; EU/UK need framework work | L each |

Each pack ships with: rule YAMLs + registry flip preview→available + a synthetic
sample study pair (per the VTZ-2201 pattern) + answer-key test with the scripted
evaluator extended for that pack's demo drift.

## 7. Open decisions (need product owner input)

1. **Scope v1 per jurisdiction = drug/IMP trials only?** (Recommended — matches the
   FDA pack; defers SG HBRA variant and AU devices/ISO 14155.)
2. **Rule granularity:** mirror FDA's 8 grouped rules per jurisdiction, or the
   statute's native granularity (SG 21 letters, ID 20 items)? Native granularity is
   more defensible on a compliance report; grouped is cheaper per review (fewer
   Claude calls). Recommended: native-but-grouped-like-FDA (~14 rules) for SG/AU,
   native 20 for ID (the statute is the list).
3. **Shared ICH base taxonomy now or later?** Later — build SG first standalone,
   extract the taxonomy when BPOM (the second ICH-derived pack) makes duplication
   visible.
4. **BPOM structural rules** (witness, copy-to-subject, insurance statement) in v1
   or follow-up?
