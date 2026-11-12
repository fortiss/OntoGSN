# Welcome to the OntoGSN Playground

The Playground shows a semantic assurance case: an assurance case whose goals, evidence and context are data in a graph, linked to a model of the system. The graph runs in your browser. You cannot break anything, and a reload starts again from the beginning.

The Playground loads the current version of the OntoGSN ontology. The [Tutorial](https://fortiss.github.io/OntoGSN/tutorial/) uses the same version.

## Try this

1. Open the menu at the top right and select **Model**. The right pane shows the car in 3D.
2. Below the car, select **Box** and **Luggage**. They go on the roof rack. The roof load is now 70 kg, and the limit is 50 kg.
3. Open the menu at the top right again and select **Tree**.
4. Next to **Rules**, select **Overloaded car**.
5. Below the graph, select **M:Car**.

The rule calculated that the roof load is above its limit. It added a challenge (the red node D1.2) to the goal G1.2, which claims that the roof load stays within its limit. The **Model** view now shows a warning and marks the parts of the car that carry the load.

## The screen

| Area | Contents |
| :--- | :--- |
| Top left | The switch for the dark mode, and the menu for the left pane |
| Top right | The menu for the right pane |
| Left pane | Text, data and tools |
| Right pane | The assurance case as a graph, or the car |
| Above the graph | The legend, the filters and the rules |
| Below the graph | The modules of the case |

## The right pane

| Control | What it does |
| :--- | :--- |
| **Tree** | Shows the argument in Goal Structuring Notation (GSN). Rectangles are goals, parallelograms are strategies, circles are solutions. Scroll to zoom. Drag to pan. |
| **Layer** | Sorts the elements into swimlanes, one for each defence layer |
| **Model** | Shows the car that one of the cases is about. Changes to the car change the case. |
| **context**, **defeater** | Show or hide context, assumptions, justifications and challenges |
| **valid**, **invalid**, **undeveloped** | Mark the elements with that status |
| **artefacts** | Show the artefacts that are linked to the elements |
| **Rules** | Run a rule on the case and mark the elements that it finds |
| **All**, **M1**, **M2**, **M:Car**, **M:SQL** | Show the whole graph or one module |

## The left pane

| Menu entry | What it does |
| :--- | :--- |
| **Settings** | Changes the files that the Playground loads |
| **Table** | Shows the triples in the graph |
| **Checklist** | Lists the goals and solutions, and records which ones are done |
| **Editor** | Adds a new element to the graph |
| **Document** | Shows the report on the car. A click on a marked term shows its data. |
| **Code** | Shows the code that is used as evidence |
| **Converter** | Converts an ASCE assurance case (`.axml`) to OntoGSN |
| **Chat** | Answers questions about the case through a language model. You need an OpenRouter API key. Try "What are the top-level goals?" |
