import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-WL4C6EOR-OWLDPUnX.js";
import { _ as __name } from "./index-DNJlf-L4.js";
import "./chunk-FMBD7UC4-DdGXg2L3.js";
import "./chunk-JSJVCQXG-Cpx01NXe.js";
import "./chunk-55IACEB6-COugJWNF.js";
import "./chunk-KX2RTZJC-fm5fLbpF.js";
var diagram = {
  parser: classDiagram_default,
  get db() {
    return new ClassDB();
  },
  renderer: classRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.class) {
      cnf.class = {};
    }
    cnf.class.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
