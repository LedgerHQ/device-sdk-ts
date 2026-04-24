import { aq as Utils, ar as Color } from "./index-DNJlf-L4.js";
const channel = (color, channel2) => {
  return Utils.lang.round(Color.parse(color)[channel2]);
};
export {
  channel as c
};
