import { Processable } from "que-proxyable";
import XFactory from "../Factory";
import { replaceDoms } from "../helper";
import Component from "../Component";
import { XNode, XTransformedNode } from "../interface";
export class RenderProcess {
  process?: Processable;

  renderResult?: XFactory | Text;
  constructor(private factory: XFactory) {}
  start() {
    if (this.factory.isComponent) {
      this.renderAsComponent();
    } else if (this.factory.isFunctional) {
      this.renderAsFunctional();
    } else if (this.factory.isFragment) {
      this.renderAsFragment();
    } else if (this.factory.isNative) {
      this.renderAsNative();
    } else {
      throw new Error(
        `!!not support the type of your component: ${this.factory.component}`
      );
    }
  }

  stop() {
    this.process?.stop();
  }

  getElements(): HTMLElement[] {
    return [];
  }

  renderAsComponent() {
    const Com = this.factory.component as typeof Component;
    const instance = new Com(this.factory.propsProcess.getProps());
    this.process = new Processable(() =>
      this.patchResult(this.formatResult(instance.render()))
    );
  }

  renderAsFunctional() {}

  renderAsFragment() {}
  renderAsNative() {}

  // 这里为何多次一举？主要是方便未来逻辑解耦 不局限网页
  replaceDoms(doms: HTMLElement[]) {
    replaceDoms(doms, this.getElements());
  }

  patchResult(result: XTransformedNode) {
    const r1 = this.renderResult;
    const r2 = result;
    const isR1Factory = this.isFactory(r1);
    const isR2Factory = this.isFactory(r2);
    // 这表示 两次渲染的结果一样
    if (
      isR1Factory &&
      isR2Factory &&
      (r1 as XFactory).id === (r2 as XFactory).id
    ) {
      this.factory.propsProcess.updateTransformedProps(
        (r2 as XFactory).transformedProps
      );
      // 结果一样不能说明什么 children 和 props可能完全不一样
      // 要重新赋值
      // (r1 as XFactory).transformedProps = (r2 as XFactory).transformedProps;
      // (r1 as XFactory).transformedChildren = (r2 as XFactory).transformedChildren;
      // // prop可能已经发生变化了 重新算 这种其实是浪费的 没必要的 最终尽量的是函数组件 类组件不会更新
      // (r1 as XFactory).propsProcess.process?.update();
    }
  }

  isFactory(r?: XTransformedNode) {
    return r instanceof XFactory;
  }

  isText(r?: XTransformedNode) {
    return r instanceof Text;
  }

  // 返回结果是数组的话 转为字符串
  formatResult(result: XNode | XNode[]) {
    if (result instanceof XFactory) return result as XFactory;
    if (Array.isArray(result)) {
      return new Text(Array.toString.apply(result));
    }
    if (typeof result === "boolean" || typeof result === "object") {
      return new Text(JSON.stringify(result));
    }
    return new Text(`${result}`);
  }
}
