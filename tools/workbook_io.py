# -*- coding: utf-8 -*-
"""One definition of the design workbook's columns and styling.

Used by prov_to_workbook.py to write provenance/Design Documentation.xlsx. The layout
outlives the workbook it was first written for: the hand-maintained
'OntoGSN Design Document.xlsx' was retired once the provenance graph became the source
of truth, and the sheet is now generated from that graph, keeping the same columns so a
reader who knew the old file still recognises this one.
"""
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

LIVE_SHEET = "All rows"
ARCHIVE_SHEET = "Archive"
ORPHAN_SHEET = "Undocumented in TTL"

TTL_COL = "Item in OntoGSN TTL"

CONTENT = ["Item in GSN Community Standard", "Page(s)",
           "Item in Natural Language", "Reason(s) for in-/exclusion"]
# uid is the stable identity (it becomes the provenance IRI); row_key is positional
# and may be renumbered when statements are inserted. match_status is derived, so it
# is reported by check_coverage rather than stored here.
LIVE_COLS = (["uid", "row_key", "part", "section", "language"] + CONTENT +
             [TTL_COL, "nl_checksum"])
ARCHIVE_COLS = LIVE_COLS + ["archived_because"]

WIDTH = {"uid": 10, "row_key": 12, "part": 13, "section": 20, "language": 10,
         "Item in GSN Community Standard": 46, "Page(s)": 8,
         "Item in Natural Language": 60, "Reason(s) for in-/exclusion": 40,
         "Item in OntoGSN TTL": 56, "nl_checksum": 11, "archived_because": 46,
         "kind": 12, "statement": 110}

HEADER_FONT = Font(color="FFFFFF", bold=True, size=10)
BODY_FONT = Font(size=9)


def _sheet(wb, title, rows, columns, header_colour):
    ws = wb.create_sheet(title)
    ws.append(columns)
    for r in rows:
        ws.append([r.get(c, "") for c in columns])

    for i, c in enumerate(columns, start=1):
        ws.column_dimensions[get_column_letter(i)].width = WIDTH.get(c, 20)
    for cell in ws[1]:
        cell.fill = PatternFill("solid", fgColor=header_colour)
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.font = BODY_FONT
            cell.alignment = Alignment(vertical="top", wrap_text=True)

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    return ws


def write(path, live, archived, orphans=None):
    wb = Workbook()
    wb.remove(wb.active)
    _sheet(wb, LIVE_SHEET, live, LIVE_COLS, "1F3864")
    _sheet(wb, ARCHIVE_SHEET, archived, ARCHIVE_COLS, "7F7F7F")
    if orphans is not None:
        rows = [{"kind": "statement", "statement": s["ttl"]}
                for s in sorted(orphans["statements"], key=lambda x: str(x["key"]))]
        rows += [{"kind": "rule", "statement": f"# {r['label']}\n{r['dl']}"}
                 for r in sorted(orphans["rules"], key=lambda x: x["label"])]
        _sheet(wb, ORPHAN_SHEET, rows, ["kind", "statement"], "7F7F7F")
    wb.save(path)
