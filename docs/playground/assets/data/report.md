# Static Structural Load Report

## 1. System overview

Inspired by the Zastava 101 from the late-1970s Yugoslavia, the OntoGSN demo car (further: **OntoCar**) is a small 3-door hatchback used as a demonstration vehicle for load transport simulations. The car is front-wheel-drive with a 4-speed manual transmission and seating for up to five occupants. The assurance case focuses on static structural loads, particularly those acting on the roof of the vehicle during planned demonstration drives.

1973 Zastava 101. Source: Wikimedia Commons, 2016.             |  OntoCar model of Zastava 101. Own work.
:-------------------------:|:-------------------------:
![check out](../../working_files/zastava101_photo.jpg)  |  ![check out](../../working_files/zastava101_model.gif)

### 1.1 Key properties

| Property                          | Value     | Unit | Interpretation                                                     |
|-----------------------------------|-----------|------|--------------------------------------------------------------------|
| Payload rating                | 400       | kg   | Maximum allowed combined mass of occupants + in-cabin cargo        |
| Roof-load rating              | 50        | kg   | Maximum allowed static load on the [roof rack]($roofRack)          |
| Total permitted mass          | 1220      | kg   | Maximum allowed overall vehicle mass (curb + payload)              |
| Seating capacity              | 5         | –    | Maximum number of occupants                                        |
| Cargo volume (cabin/luggage)  | 320       | L    | Approximate usable cargo space                                     |

---
<!-- dl:start car_G1 -->
## 2. Argument Structure 

The assurance case is centered around a single operational question:

> *Can OntoCar transport heavy loads from point A to point B?*

The answer to this question depends on the existing configuration of the static load. Currently, it's estimated as X kg, for which the evaluation is **yes**.

[](#p:car_C1) OntoCar's static load capacity is assessed against the specifications present in the industry manual for Zastava 101. [](#p:car_C2) The intended operational domain for OntoCar are short, non-high-speed demonstration drives on an open course, with no more than two occupants (including the driver). Extreme or improvised loading scenarios are not foreseen. [](#p:car_J1) Crashworthiness, impact of road objects and conditions, or modern occupant-protection systems (e.g., airbags) are similarly not covered.

<!-- dl:start car_S1 -->

For the simulated drive to be approved, three separate checks need to be made. First, the combined mass of people and in-cabin items must stay within the payload allowance. Second, anything mounted on the [roof rack]($roofRack) above the vehicle must stay within the roof-load allowance. Third, the overall permitted mass must still not be exceeded.

`loadAllowed = true` 
**iff** `{payload <= 400kg, roofLoad <= 50kg, totalLoad <= 1220kg}`

<!-- dl:end car_S1 -->

<!-- dl:end car_G1 -->

## 2.1. [](#s:car_G1_1) Payload safety 

Before anything is placed on the roof, the system deployers need to ensure that the people in the vehicle and the items carried inside the [cabin]($Cabin) or the [trunk]($trunk) do not already consume the [](#p:car_C1_1) allowed payload margin of 400 kg. [](#p:car_Sn1) Based on existing evidence from calculations performed on $DATE, the total mass is **within limit**.

Two operating assumptions are made. [](#p:car_A1) First, because the occupants are not weighed before the simulation, we assume that each occupant weight as an average adult male of 80kg. [](#p:car_A2) Second, occupants are assumed to carry only light personal items in the cabin of negligible weight. If this is not the case, please inform the authors before proceeding with the simulation.

---

## 2.2. [](#s:car_G1_2) Roof-load safety

Before the simulated drive is approved, the system deployers also need to ensure that any load mounted on the [roof rack]($roofRack), including a roof box or other attached equipment, does not exceed the [](#p:car_C1_2) allowed roof-load margin of 50 kg. [](#p:car_A3) Because roof-mounted items are weighed before each demonstration run, the roof load is treated as a controlled quantity. [](#p:car_Sn2) Based on existing evidence from calculations performed on $DATE, the total roof-mounted mass is **within limit**.

If the measured roof load exceeds 50 kg, the configuration must not be used for the simulation.

`roofLoadAllowed = true`  
**iff** `{roofLoad <= 50kg}`

## 2.3. [](#s:car_G1_3) Total vehicle mass safety

After the payload and roof-load checks have been completed, the system deployers need to confirm that the resulting overall vehicle mass still remains within the [](#p:car_C1_3) total permitted mass of 1220 kg. This check combines the curb mass of the vehicle with the in-cabin payload and any roof-mounted load. [](#p:car_A1) [](#p:car_A2) [](#p:car_A3) All previously stated assumptions continue to apply. [](#p:car_Sn3) Based on the current configuration and the existing vehicle specification, the total mass is **within limit**.

Configurations exceeding the total permitted mass must be rejected during planning and not approved for the simulation.

`totalMass = curbMass + payload + roofLoad`  

`totalMassAllowed = true`  
**iff** `{totalMass <= 1220kg}`

---

## 3. Consolidated view

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

## 4. Module packaging and reuse

The assurance structure is packaged as module **M:Car**, containing:

- Goals, contexts, assumptions and solutions  
- Overall static-load argument  
- Evidence items for payload, roof load and total mass

---

## 5. Out-of-scope aspects and residual risk

The following aspects remain out of scope:

- Crashworthiness and collision energy absorption  
- Dynamic loads from potholes, harsh manoeuvres, or accidents  
- Corrosion, fatigue and long-term degradation  
- Airbags, advanced seatbelt systems or modern crash protection

Residual risks related to these aspects are not addressed here.
