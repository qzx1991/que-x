import { IProp } from "./Element";
export class Component<P extends IProp = {}> {
  static IS_COMPONENT = true;
  constructor(public props: P) {}
  render() {
    return "";
  }
}
export function isComponent(com: any) {
  const type = typeof com;
  if (type === "function") {
    return com.IS_COMPONENT;
  }
  if (type === "object") {
    return com.__proto__.constructor.IS_COMPONENT;
  }
  return false;
}
