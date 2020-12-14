import { Proxyable } from "que-proxyable";
import B from "./components/Help";
import quex from "./lib";

const C = B as any;

quex.render((<C />) as any, document.getElementById("root"));
