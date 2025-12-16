# Static Structural Load Assurance for the OntoGSN Demo Hatchback

## 1. System overview

The system under consideration is the **OntoGSN Demo Hatchback**, a small 3-door hatchback used as a demonstration vehicle in knowledge-augmented assurance case visualizations. It is inspired by the Zastava 101, which was manufactured in the late-1970s in former Yugoslavia.

The car is front-wheel-drive with a 4-speed manual transmission and seating for up to **five occupants**. The assurance case focuses on **static structural loads**, particularly those acting on the **cabin** and the vehicle structure during planned demonstration drives.

### 1.1 Key static-load properties

| Property                          | Value     | Unit | Interpretation                                                     |
|-----------------------------------|-----------|------|--------------------------------------------------------------------|
| **Payload rating**                | 400       | kg   | Maximum allowed combined mass of occupants + in-cabin cargo        |
| **Roof-load rating**              | 50        | kg   | Maximum allowed static load on the [roof rack]($roofRack)          |
| **Total permitted mass**          | 1220      | kg   | Maximum allowed overall vehicle mass (curb + payload)              |
| **Seating capacity**              | 5         | –    | Maximum number of occupants                                        |
| **Cargo volume (cabin/luggage)**  | 320       | L    | Approximate usable cargo space                                     |

These parameters form the basis for the static load assurance arguments in this document.

---

## 2. Top-level claim and argument structure

### 2.1 Top-level claim (G1)

**G1 — Static structural load safety**

> For all planned demo drives, the OntoGSN Demo Hatchback operates within its static structural load limits.

This top-level claim concerns the **cabin** and the portions of the vehicle structure that bear the payload, roof load on top of the [roof rack]($roofRack), and overall mass during normal demo operation.

The claim is interpreted in the context of:

- **C1 – Static load properties**  
  The vehicle has a payload rating of 400 kg, a roof-load rating of 50 kg, a total permitted mass of 1220 kg, and seating capacity of 5.

- **C2 – Planned use**  
  The vehicle is only used for short, low-speed demonstration drives on a closed course, with at most five occupants and light personal luggage.

- **J1 – Scope justification**  
  The assurance case is explicitly restricted to **static structural loads** and normal loading configurations. Dynamic load phenomena (e.g. crash loads, pothole impacts), crashworthiness, and modern occupant protection features (such as airbags) are recognised but explicitly **out of scope**.

### 2.2 Argument by decomposition (S1)

**S1 — Decomposition over load types**

> The top-level claim is argued by decomposition over three load constraints: payload, roof load, and total vehicle mass.

If each of the following sub-claims can be shown to hold for all planned demo drives, the top-level claim G1 is considered supported:

- **G1.1:** In-cabin payload (occupants + cargo) respects the payload rating.  
- **G1.2:** Roof-mounted load respects the roof-load rating.  
- **G1.3:** The resulting overall vehicle mass stays within the total permitted mass.

Structure:

```text
G1  (Static load safety)
└─ S1  (Argument by decomposition over load types)
   ├─ G1.1  Payload within 400 kg rating
   ├─ G1.2  Roof load within 50 kg rating
   └─ G1.3  Total mass within 1220 kg limit
```

## 3. Payload safety (G1.1)

### 3.1 Claim

**G1.1 — Payload within rating**

> The combined mass of occupants and in-cabin cargo does not exceed the **400 kg payload rating**.

### 3.2 Context and assumptions

- **C1.1 — Payload rating:** max. 400 kg  
- **A1 — Occupant mass model:** average 80 kg  
- **A2 — Cargo discipline:** only light personal items allowed

### 3.3 Evidence and reasoning

- **Sn1 — Payload rating:** vehicle data specifies 400 kg maximum payload.

Given 5 × 80 kg = **400 kg**, the constraint is satisfied provided that:

- Occupant count does not exceed 5  
- No heavy cargo is brought in the cabin

Checklist:

- [x] Payload rating documented  
- [x] Occupant mass model defined  
- [x] Cargo restrictions defined  
- [ ] Optional: track exact occupant weights before demo

---

## 4. Roof load safety (G1.2)

### 4.1 Claim

**G1.2 — Roof load within rating**

> Roof-mounted load does not exceed the **50 kg roof-load rating**.

### 4.2 Context and assumptions

- **C1.2 — Roof-load rating:** max. 50 kg  
- **A3 — Roof-load control:** roof load is weighed and controlled

### 4.3 Evidence and reasoning

- **Sn2 — Calculated roof load:** Sum of roof-mounted items is verified to be ≤ 50 kg.

Table:

| Aspect              | Content                                            |
|---------------------|----------------------------------------------------|
| Limit               | 50 kg                                              |
| Controlled items    | Roof box, rack, attached equipment                 |
| Control mechanism   | Weigh items before each demo                       |
| Evidence            | Roof-load calculation for configuration            |

---

## 5. Total vehicle mass safety (G1.3)

### 5.1 Claim

**G1.3 — Total mass within permitted limit**

> Overall vehicle mass does not exceed **1220 kg**.

### 5.2 Context and assumptions

- **C1.3 — Total permitted mass:** max. 1220 kg  
- **A1, A2, A3:** all previous assumptions apply  
- Payload ≤ 400 kg; Roof load ≤ 50 kg

### 5.3 Evidence and reasoning

- **Sn3 — Total permitted mass:** specified value of 1220 kg

Formula:

```text
total mass = curb mass + in-cabin payload + roof load
```

Demo configurations exceeding the limit are rejected during planning.

---

## 6. Consolidated view

| ID   | Type          | Role                                             | Content                                                          |
|------|---------------|--------------------------------------------------|------------------------------------------------------------------|
| G1   | Goal          | Top-level claim                                  | Car remains within static load limits                           |
| S1   | Strategy      | Decomposition                                    | Split into payload, roof-load, total mass                       |
| G1.1 | Goal          | Payload sub-claim                                | ≤ 400 kg                                                        |
| G1.2 | Goal          | Roof-load sub-claim                              | ≤ 50 kg                                                         |
| G1.3 | Goal          | Total mass sub-claim                             | ≤ 1220 kg                                                       |
| C1   | Context       | Vehicle properties                                | Payload, roof load, total mass, seats                           |
| C1.1 | Context       | Payload detail                                    | Max 400 kg                                                      |
| C1.2 | Context       | Roof-load detail                                  | Max 50 kg                                                       |
| C1.3 | Context       | Total mass detail                                 | Max 1220 kg                                                     |
| C2   | Context       | Planned use                                       | Short closed-course demo drives                                 |
| A1   | Assumption    | Occupant mass                                     | 80 kg average                                                   |
| A2   | Assumption    | In-cabin cargo discipline                         | Light personal items only                                       |
| A3   | Assumption    | Roof-mounted cargo control                        | Weighed and checked                                             |
| Sn1  | Solution      | Evidence: payload rating                          | 400 kg                                                          |
| Sn2  | Solution      | Evidence: roof load calculation                   | ≤ 50 kg                                                         |
| Sn3  | Solution      | Evidence: total mass specification                | 1220 kg                                                         |
| J1   | Justification | Scope restriction                                 | Only static loads in scope                                      |
| M:Car| Module        | Packaging                                         | Reusable static-load module                                     |

---

## 7. Module packaging and reuse

The assurance structure is packaged as module **M:Car**, containing:

- Goals, contexts, assumptions and solutions  
- Overall static-load argument  
- Evidence items for payload, roof load and total mass

This allows reuse in larger assurance cases—for example, broader safety, regulatory or AI-augmented driving cases where the car's structural integrity is a prerequisite.

---

## 8. Out-of-scope aspects and residual risk

The following aspects remain out of scope:

- Crashworthiness and collision energy absorption  
- Dynamic loads from potholes, harsh manoeuvres, or accidents  
- Corrosion, fatigue and long-term degradation  
- Airbags, advanced seatbelt systems or modern crash protection

Residual risks related to these aspects are not addressed here.

---

## 9. Summary

This document provides a **Markdown mirror** of a graph-structured assurance case for the static structural load safety of the OntoGSN Demo Hatchback.  

If:

- payload is controlled (G1.1),  
- roof load is controlled (G1.2),  
- total mass is within limits (G1.3),  

then the vehicle remains within its **static structural load limits** for all planned demo drives (G1).