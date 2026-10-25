import { Component, ViewEncapsulation } from "@angular/core";

/**
 * The complete guide to auditing the store: what is checked and how often, who does it, how to count step by step, what to do with differences,
 * the paperwork to keep, and the other regular checks. A plain page, written to be printed and kept at the store.
 */
@Component({
  selector: "app-audit-guide",
  templateUrl: "./audit-guide.component.html",
  encapsulation: ViewEncapsulation.None,
  styles: [`
    .audit-guide h2 { font-size: 1.15rem; margin-top: 2rem; color: #1d4ed8; }
    .audit-guide h3 { font-size: 1rem; margin-top: 1.2rem; }
    .audit-guide li { margin-bottom: .25rem; }
    .audit-guide .toc a { cursor: pointer; }
    .audit-guide .g-svg { width: 100%; height: auto; max-width: 900px; display: block; margin: .5rem 0 1rem; }
    .audit-guide .g-t { font: 700 12.5px system-ui, sans-serif; fill: #0f172a; }
    .audit-guide .g-s { font: 11.5px system-ui, sans-serif; fill: #1e293b; }
    .audit-guide .g-w { font: italic 11px system-ui, sans-serif; fill: #64748b; }
    .audit-guide .g-r { font: 700 11px system-ui, sans-serif; fill: #b91c1c; }
    .audit-guide .g-n { font: 700 11px system-ui, sans-serif; fill: #fff; }
    .audit-guide .g-figure { display: block; width: 100%; break-inside: avoid; }
    @media print {
      #header, #sidebar, .no-print { display: none !important; }
      #main, main { margin: 0 !important; padding: 0 !important; }
      .audit-guide h2 { break-after: avoid; }
      .audit-guide table, .audit-guide .box { break-inside: avoid; }
    }
  `],
})
export class AuditGuideComponent {
  readonly sections = [
    ["glance", "The process at a glance"],
    ["why", "What auditing is for"],
    ["who", "Who does what"],
    ["calendar", "The audit calendar"],
    ["before", "Before you count"],
    ["count", "Counting, step by step"],
    ["differences", "When the count differs from the book"],
    ["during", "Sales and changes while you count"],
    ["each", "Each audit in detail"],
    ["paper", "The paperwork to keep"],
    ["others", "The other regular checks"],
    ["wrong", "When something goes wrong"],
    ["yearend", "Year-end checklist"],
    ["words", "Words used"],
  ];

  go(id: string) { document.getElementById("guide-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  print() { window.print(); }
}
