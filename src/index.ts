import XFactory from "./Factory";
import { flatternDeep } from "./helper";
import Component, { isCompnent } from "./Component";
import {
  XComponent,
  XTransformedPropsData,
  XNode,
  XTransformedValue,
} from "./interface";
export * from "./proxyable";
export * from "./interface";
export * from "./Component";
export * from "./util";
export * from "./proxyable";

/**
 * 对外暴露的对象
 */
class X {
  flatternDeep = flatternDeep;

  Component = Component;

  isCompnent = isCompnent;

  renderDom(xnode: XFactory, dom: string | HTMLElement) {
    const element =
      typeof dom === "string" ? document.getElementById(dom) : dom;
    if (!element) {
      throw new Error("请指定正确的DOM节点");
    }
    xnode.exec();
    // xnode.renderProcess.replaceDoms([element]);
  }

  // 新建组件
  createElement(
    id: number,
    component: XComponent,
    props: XTransformedPropsData[],
    ...children: XTransformedValue<XNode | XNode[]>[]
  ) {
    return new XFactory(id, component, props, children);
  }
}

export default new X();
