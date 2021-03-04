import Children from "./Children";
export interface IPropOption {
  type: "rest" | "normal";
  property: string; // 属性名称
  value: () => any;
}
export default class Prop {
  constructor(private props: IPropOption[] = []) {}
  init() {}
  update(props: IPropOption[] = []) {}
  getProp() {
    return {};
  }
  setChildren(children?: Children) {}
}
