import { Factory } from "./Factory";
import { TQuexComponentTypes, IQuexPropsData } from "./interface";
import { replaceDom } from "./utils";
export * from "./Component";
export * from "./Factory";
export * from "./interface";
export * from "./utils";

class Quex {
  render(factory: Factory, dom?: HTMLElement | null) {
    if (!dom) {
      throw new Error("您选取的节点无效");
    }
    // 执行
    factory.exec();
    const elements = factory.getElements();
    replaceDom([dom], elements);
  }

  createElement(
    id: number,
    component: TQuexComponentTypes,
    props?: IQuexPropsData[],
    ...children: (() => any)[]
  ) {
    return new Factory(id, component, props, children);
  }
}

export default new Quex();
