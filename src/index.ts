import * as Injectable from "./Injectable";
import * as Stateable from "./Stateable";
import * as _ from "./lib";

const output = {
  _,
  ...Injectable,
  ...Stateable,
};

export = {
  ...output,
  default: output,
};
