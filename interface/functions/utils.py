import nbformat
import ipynbname
from rdflib import Namespace, Literal
from rdflib.namespace import RDF, RDFS

def setup_graph(filepath = "ontogsn.owl"):
    from rdflib import Graph
    g = Graph()
    
    if ".owl" in filepath:
        onto_format = "xml"
    elif ".ttl" in filepath:
        onto_format = "turtle"

    g.parse(filepath, format=onto_format)

    return g

def load_query(query_path = "queries/add_evidence.rq", replacements = "null"):
    with open(query_path, "r", encoding="utf-8") as f:
        query = f.read()

    if replacements != "null":
        for placeholder, value in replacements.items():
            query = query.replace(placeholder, value)

    return query
    
def add_node(g, label, node_type, parent_label=None, content=None, 
             GSN =Namespace("https://w3id.org/ontogsn/ontology#"),
             CASE = Namespace("https://w3id.org/ontogsn/my_assurance_case#")):

    g.bind("gsn", GSN)
    g.bind("case", CASE)
    local = label.replace(":", "_").replace(" ", "_")
    node = CASE[local]
    cls  = GSN[node_type]
    g.add((node, RDF.type, cls))
    g.add((node, RDFS.label, Literal(label)))
    if content:
        g.add((node, RDFS.comment, Literal(content)))
    if parent_label:
        p_local = parent_label.replace(":", "_").replace(" ", "_")
        parent = CASE[p_local]
        if node_type.lower() == "context":
            g.add((node, GSN.inContextOf, parent))
        else:
            g.add((parent, GSN.supportedBy, node))
    print(f"Added {node_type} '{label}'")

def parse_and_add(graph, notebook_path="argument_manager.ipynb"):
    nb = nbformat.read(notebook_path, as_version=4)
    for cell in nb.cells[1:]:                     # skip the very first cell
        if cell.cell_type != "code": continue
        lines = cell.source.splitlines()
        # metadata lives in the first few comment‐lines:
        meta = {}
        for i, L in enumerate(lines):
            if L.startswith("# Node label and statement:"):
                meta["label"] = L.split(":",1)[1].strip().strip('"')
            elif L.startswith("# Node type:"):
                meta["type"] = L.split(":",1)[1].strip().strip('"')
            elif L.startswith("# Parent node:"):
                p = L.split(":",1)[1].strip().strip('"')
                meta["parent"] = p if p else None
            elif L.startswith("# Content:"):
                # everything after this line is “content”
                content = "\n".join(lines[i+1:]).rstrip()
                # strip optional surrounding triple-quotes or quotes:
                if (content.startswith('"""') and content.endswith('"""')) or \
                   (content.startswith('"')   and content.endswith('"')):
                    content = content.strip('"')
                meta["content"] = content
                break
        # must have at least label & type
        if {"label","type"}.issubset(meta):
            add_node(
                g           = graph,
                label       = meta["label"],
                node_type   = meta["type"],
                parent_label= meta.get("parent"),
                content     = meta.get("content")
            )