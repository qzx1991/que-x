import { XNode, XProps } from "./interface";
export default class Component<P = {}> {
  _$$_$$_IS_COMPONENT = true;
  constructor(public props: XProps<P>) {}
  render(): XNode {
    // this.props.children.map();
    return "";
  }
}

export function isCompnent(v: any): boolean {
  return v && v.prototype && v.prototype._IS_COMPONENT;
}
