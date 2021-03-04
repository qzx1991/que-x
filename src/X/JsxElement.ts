import { IPropOption } from "./Prop";
import { IRawChildType } from "./Children";
import Component from "./Component";
import { getDomsFromJsx } from "./JSXTool";
import { IsComponent } from "./Component";
import BaseElement from "./Elements/baseElement";
import FragmentElement from "./Elements/FragmentElement";
import NativeElement from "./Elements/NativeElement";
import ComponentElement from "./Elements/ComponentElement";
import FunctionalElement from "./Elements/FunctionalElement";

export default class JSXElement {
  element?: BaseElement;
  constructor(
    public id: number, // 这个Element的唯一ID 这个会在打包的时候自动加上
    public component: string | typeof Component | (() => any),
    public props: IPropOption[] = [],
    // 可以是任意值
    public children: (() => any)[] = [] // 孩子节点
  ) {
    if (typeof component === "string") {
      if (component === "fragment") {
        this.element = new FragmentElement(id, component, props, children);
      } else {
        this.element = new NativeElement(id, component, props, children);
      }
    } else if (IsComponent(component)) {
      this.element = new ComponentElement(
        id,
        component as typeof Component,
        props,
        children
      );
    } else if (typeof component === "function") {
      this.element = new FunctionalElement(id, component, props, children);
    }
  }
  getElements(): (HTMLElement | Text)[] {
    // 这三者都不是  调用分析方法
    return getDomsFromJsx(this.element?.getRenderResult());
  }

  // 初始化渲染这个JSXElement
  init() {
    // 正式开始渲染节点
    this.element?.init();
  }
  // 更新这个JSXElement
  update(props: IPropOption[], children: (() => any)[]) {
    this.update(props, children);
  }
}
