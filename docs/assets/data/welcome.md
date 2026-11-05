# Welcome to the OntoGSN Playground

The Playground shows a semantic assurance case: an assurance case whose goals, evidence and context are data in a graph, linked to a model of the system. The graph runs in your browser. You cannot break anything, and a reload starts again from the beginning.

The Playground uses a reduced copy of OntoGSN 1.2. The [Tutorial](https://fortiss.github.io/OntoGSN/tutorial/) uses the current version.

## Try this

1. Click **Model** at the top right. The right pane shows the car in 3D.
2. Below the car, select **Box** and **Luggage**. They go on the roof rack.
3. At the bottom left, under **Rules**, select **Overloaded car**.
4. Click **Tree** at the top right.

The rule calculated that the roof load is above its limit. It added a defeater (a red node) that challenges the argument. The affected goals are now marked invalid.

## The screen

| Area | Contents |
| :--- | :--- |
| Top left | Tabs for the left pane |
| Top right | Views and filters for the right pane |
| Left pane | Text, data and tools |
| Right pane | The assurance case as a graph |
| Bottom left | Rules that you can switch on |
| Bottom right | The modules of the case |

## The right pane

| Control | What it does |
| :--- | :--- |
| **Tree** | Shows the argument in Goal Structuring Notation (GSN). Rectangles are goals, parallelograms are strategies, circles are solutions. Scroll to zoom. Drag to pan. |
| **Layer** | Sorts the elements into swimlanes, one for each defence layer |
| **Model** | Shows the car that the case is about. Changes to the car change the case. |
| **Contextual**, **Dialectic** | Show or hide context, assumptions, justifications and challenges |
| **Undeveloped**, **Invalid**, **Valid** | Mark the elements with that status |
| **Artefacts** | Show the artefacts that are linked to the elements |

## The left pane

| Tab | What it does |
| :--- | :--- |
| **Table** | Shows the triples in the graph |
| **Editor** | Adds a new element to the graph |
| **Document** | Shows the report on the car that the case is about |
| **Code** | Shows the code that is used as evidence |
| **Converter** | Converts an ASCE assurance case (`.axml`) to OntoGSN |
| **Chat** | Answers questions about the case through a language model. You need an OpenRouter API key. Try "What are the top-level goals?" |
