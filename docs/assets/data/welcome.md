# Welcome to the OntoGSN Playground!

This interactive and experimental playground is designed to give you a hands-on feel for what a **semantic assurance case** looks like. Unlike static documents, this assurance case is a dynamic, living model where all the pieces—goals, evidence, context, and even 3D models—are interconnected in ontologies. The core users are assurance engineers working in safety or security.

## What Can You Do Here?

Explore! Click around, toggle the switches, and see how the assurance argument reacts. Nothing you do here can break anything permanently.

```
+-------------------------------------------------+
|                Buttons (Top)                    |
+----------------------+--------------------------+
| Textual (Left)       | Visualization (Right)    |
|                      |                          |
|                      |                          |
|                      |                          |
+----------------------+--------------------------+
|               Options (Bottom)                  |
+-------------------------------------------------+
```

In the future, we will be adding different experimental editors. Stay tuned!

---

### The Main Panes

The screen is split into two main areas:

*   **Left Pane:** This is your "data deep-dive" area. It's where you can see the raw data, read documents, inspect code, and more. You're reading this Welcome document in the left pane right now!
*   **Right Pane:** This is your primary "visualization" area. By default, it shows the assurance case as a graph, but you can switch to other views.

---

### Exploring the Assurance Argument (Right Pane)

The main view is the **Tree View**, which shows the Goal Structuring Notation (GSN) argument.

*   **Zoom and Pan:** Click and drag to move around, and use your mouse wheel to zoom in and out.
*   **Node Shapes:** The shapes represent standard GSN elements: rectangles are **Goals**, parallelograms are **Strategies**, and circles are **Solutions** (evidence).

You can change this view using the buttons at the top right:

*   **Layer View:** See the argument organized into swimlanes, which can represent different architectural layers or stages of reasoning.
*   **Model View:** This is a live, interactive 3D model of the system being assured—in this case, a car. You can interact with its parts, and see how your actions affect the assurance case.

Above the graph, you'll find several toggles to filter the view:
*   `Contextual` / `Dialectic`: Show or hide elements like assumptions, justifications, and challenges (defeaters).
*   `Undeveloped` / `Invalid` / `Valid`: Instantly see the status of different claims in the argument.
*   `Artefacts`: Show related evidential or contextual artefacts.

---

### The Semantic Assurance Case: Try This!

The real power of this model is its ability to automatically re-evaluate the argument when things change. Let's try an example:

1.  Click the **Model** button in the top-right to switch to the 3D car view.
2.  At the bottom of the model view, check the boxes for **Box** and **Luggage** to add them to the car's roof.
3.  Now, look at the **Rules** at the bottom-left of the screen. Check the box for **Overloaded car**.
4.  Switch back to the **Tree** view in the right pane.

You will see that the system has automatically:
*   Calculated that the car's roof is now overloaded.
*   Added a new "defeater" node (in red) to challenge the argument.
*   Propagated this failure up the argument, marking the affected goals as `invalid`.

---

### Digging into the Details (Left Pane)

The tabs on the left let you explore the data behind the visuals:

*   **Table:** See the raw data triples that make up the knowledge graph.
*   **Editor:** A simple form for developers to add new elements to the graph.
*   **Document & Code:** View supporting documents and code artefacts that act as evidence.
*   **Converter:** A tool for migrating legacy assurance cases (from `.axml` files) into the OntoGSN format.
*   **Chat:** Ask questions about the assurance case in plain English! Try asking, "What are the top-level goals?" or "show me all solutions".

Now, feel free to explore the different views and see what's possible.