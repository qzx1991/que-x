import Component from "../Component";
import { IPropOption } from "../Prop";
import BaseElement from "./baseElement";
export default class ComponentElement extends BaseElement {
  private result: any;
  private instance?: Component<any>;

  getComponent() {
    return (this.component as any) as typeof Component;
  }
  getRenderResult() {}
  initComponent() {
    const props = this.prop?.getProp() || {};
    const Com = this.getComponent();
    this.instance = new Com(props);
  }
}
