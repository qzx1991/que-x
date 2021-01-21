import { isCompnent } from "./Component";
import { Prop } from "./Prop";
import {
  XComponent,
  XNode,
  XTransformedPropsData,
  XTransformedValue,
} from "./interface";
import { State, Processable, getOriginData } from "./proxyable";
import {
  XTransformedPropsType,
  XTransformedNode,
  XFunctionalComponent,
} from "./interface";
import Component from "./Component";
import { XChildResult } from "./interface";
import { appendElements } from "./helper";
import {
  isEventProperty,
  isClassProperty,
  getClassValue,
  isStyleProperty,
  getStyleValue,
} from "./helper";
import {
  insertElements,
  getDomPositionInfo,
  isPrivateProperty,
} from "./helper";

export type IXFactoryProcessType = "props" | "render" | "children";

const SELF_DEFINE_ELEMENT = new Map<
  string,
  typeof Component | XFunctionalComponent
>();

export default class XFactory {
  @State()
  // render的props结果 这时被转换过的 都是 () => any的格式
  transformedProps: XTransformedPropsData[] = [];
  @State()
  // render的children的结果
  transformedChildren: XTransformedValue<XChildResult>[] = [];

  // 存放process的地方
  processMap = new Map<IXFactoryProcessType, Processable>();

  // 属性处理类
  prop?: Prop;

  // 是否是类组件
  isComponent = false;

  // 是否是原生组件
  isNative = false;
  // 是否是函数组件
  isFunctional = false;
  // 是否是fragment组件: 类似<></>这样
  isFragment = false;

  // Component组件和Functional组件的渲染结果

  renderResult?: XTransformedNode;

  childrenResult: XTransformedNode[] | XTransformedNode[][] = [];
  // Component组件的实例

  componentInstance?: Component;
  // 原生组件的实例

  nativeElement?: HTMLElement;

  // 组件被销毁时所在的位置
  destroyPosition?: {
    nextSibling?: ChildNode | null;
    parent: any;
  };

  // 属性进程 主要是原生组件在渲染属性的时候会用到
  propProcess = new Map<string, Processable>();

  constructor(
    public id: number,
    public component: XComponent,
    public rawProps: XTransformedPropsData[],
    public rawChildren: XTransformedValue<XChildResult>[]
  ) {
    const me = this;
    // 支持自定义的组件
    if (typeof component === "string" && SELF_DEFINE_ELEMENT.has(component)) {
      this.component = SELF_DEFINE_ELEMENT.get(component)!;
      this.isComponent = isCompnent(this.component);
    } else {
      this.isFragment = this.component === "fragment";
      this.isNative = typeof this.component === "string" && !this.isFragment;
      this.isComponent = isCompnent(this.component);
      this.isFunctional =
        !this.isComponent && typeof this.component === "function";
    }

    this.transformedChildren = rawChildren;
    this.transformedProps = this.isComponentOrFunctional
      ? [
          {
            type: XTransformedPropsType.normal,
            value: () =>
              new Proxy(this.transformedChildren, {
                get(t, k) {
                  const v = t[k as number];
                  return typeof v === "function" ? me.transformResult(v()) : v;
                },
              }),
            property: "children",
          },
          ...rawProps,
        ]
      : rawProps;
  }

  get isComponentOrFunctional() {
    return this.isComponent || this.isFunctional;
  }

  // 执行
  exec() {
    // 先初始化props
    this.initProps();
    this.render();
  }

  render() {
    if (this.isComponent) {
      this.renderComponent();
    } else if (this.isFunctional) {
      this.renderFunction();
    } else if (this.isNative) {
      this.renderNative();
    } else if (this.isFragment) {
      this.renderFragment();
    }
  }

  renderComponent() {
    const Com = this.component as typeof Component;
    this.componentInstance = new Com(this.prop?.getProps());
    this.processMap.set(
      "render",
      new Processable(() => {
        const result = this.transformResult(this.componentInstance?.render());
        if (this.handleRenderResult(result, this.renderResult)) {
          // 两种结果类型不一样 这个时候肯定要替换原来的值了
          this.renderResult = result;
        }
        // 需要注意的是，子进程是先被干掉的 也就是子进程的事件移除实在之前的
        return () => this.unsubscribeRender();
      })
    );
  }

  renderFunction() {
    const func = this.component as XFunctionalComponent;
    this.processMap.set(
      "render",
      new Processable(() => {
        const result = this.transformResult(func(this.prop?.getProps()));
        if (this.handleRenderResult(result, this.renderResult)) {
          this.renderResult = result;
        }
        return () => this.unsubscribeRender();
      })
    );
  }

  renderNative() {
    this.nativeElement = document.createElement(this.component as string);
    // 处理属性
    this.processMap.set(
      "render",
      new Processable(() => {
        // 属性的增减怎么办？
        const props = this.prop?.getProps();
        if (props) {
          for (let property in props) {
            this.handleNativeProperty(property, props);
          }
        }
        return this.prop?.onPropChange((property, type) => {
          switch (type) {
            case "delete":
              // 删除的话 要停用原先的进程
              const process = this.propProcess.get(property);
              process?.stop();
              // 同时还要删除存储的信息
              this.propProcess.delete(property);
              break;
            case "add":
              this.handleNativeProperty(property, props);
              break;
          }
        });
      })
    );
    const factory = new XFactory(-2, "fragment", [], this.transformedChildren);
    factory.exec();
    // 弄好了就可以插入了呀
    appendElements(this.nativeElement, factory.getElements() as any);
  }

  // 一切的一切都回归到了这里
  // 我们始终要明白一点：children的数量总是固定的 有什么办法可以避免比较呢
  renderFragment() {
    for (let i = 0; i < this.transformedChildren.length; i++) {
      new Processable(() => {
        const child = this.transformedChildren[i];
        const rawResult = child();
        const result =
          Array.isArray(rawResult) && this.id === -1
            ? rawResult.map(this.transformResult)
            : this.transformResult(rawResult);
        const originResult = this.childrenResult[i];
        // 这种情况只出现在虚拟的fragment下 也就是由transformResult生成的fragment下
        // 这种情况下 比较的就是单纯的数组
        if (Array.isArray(result)) {
          // 直接替换  不花里胡哨 如果想花里胡哨 那就用技巧
          // if (!originResult) {
          //   this.childrenResult[i] = result;
          //   result.forEach((i) => (i instanceof XFactory ? i.exec() : i));
          // } else if (Array.isArray(originResult)) {
          //   // 直接
          // } else {
          //   // ei~~~原住民竟然不是数组 那就别怪我不客气 只能直接替换了
          //   // 先找到要替换的位置
          //   let destroyPosition =
          //     originResult instanceof XFactory
          //       ? originResult.stop()
          //       : getDomPositionInfo([origin as any]);
          //   // 替换呗
          //   if (destroyPosition) {
          //     insertElements(this._getElements(result) as any, destroyPosition);
          //   }
          //   this.childrenResult[i] = result;
          // }
        }
        // this.handleRenderResult(result, originResult);
      });
    }
  }

  handleNativeProperty(property: string, props: any) {
    if (isPrivateProperty(property)) {
      return;
    } else if (isEventProperty(property)) {
      // 绑定事件
      this.propProcess.set(
        property,
        new Processable(() => {
          const handler = props[property];
          const eventname = property.substr(2).toLowerCase();
          this.nativeElement?.addEventListener(eventname, handler);
          return () =>
            this.nativeElement?.removeEventListener(eventname, handler);
        })
      );
    } else if (isClassProperty(property)) {
      this.propProcess.set(
        property,
        new Processable(() => {
          const classValue = getClassValue(props[property]);
          if (classValue) {
            this.nativeElement?.setAttribute("class", classValue);
          }
          return () => this.nativeElement?.removeAttribute("class");
        })
      );
      return;
    } else if (isStyleProperty(property)) {
      this.propProcess.set(
        property,
        new Processable(() => {
          const style = getStyleValue(props[property]);
          if (style) {
            this.nativeElement?.setAttribute("style", style);
          }
          return () => this.nativeElement?.removeAttribute("style");
        })
      );
    } else {
      this.propProcess.set(
        property,
        new Processable(() => {
          this.nativeElement?.setAttribute(property, props[property]);
          return () => this.nativeElement?.removeAttribute(property);
        })
      );
    }
  }

  unsubscribeRender() {
    this.componentInstance?.willUnmount();
    if (!(this.renderResult instanceof XFactory)) {
      this.destroyPosition = {
        nextSibling:
          this.renderResult?.nextSibling ||
          this.renderResult?.nextElementSibling,
        parent:
          (this.renderResult as any).parent ||
          this.renderResult?.parentNode ||
          this.renderResult?.parentElement,
      };
      this.renderResult?.remove();
      this.componentInstance?.unmounted();
      return;
    }
    return () => {
      // 这里呢是处理有子进程的逻辑
      // destroyPosition的逻辑在其他类型的渲染处理里面
      this.destroyPosition = (this.renderResult as XFactory).destroyPosition;
      this.componentInstance?.unmounted();
    };
  }

  transformResult(result: XNode): XTransformedNode {
    if (result instanceof XFactory) return result;
    if (Array.isArray(result)) {
      // 虚拟出一个XFactory 统一的ID为-1最终将数组类都转到了XFragment下
      return new XFactory(-1, "fragment", [], [() => result]);
    }
    if (typeof result === "object") {
      try {
        return new Text(JSON.stringify(result));
      } catch (e) {
        return new Text("please input the right value");
      }
    }
    return new Text(`${result}`);
  }

  handleRenderResult(result: XTransformedNode, origin?: XTransformedNode) {
    if (
      result instanceof XFactory &&
      origin instanceof XFactory &&
      result.id === origin.id
    ) {
      // ID 一样 表示基因一样 那好了，后面的解构基本就是一样的 唯一不同的可能就是数据了 更新数据让后面的基因自动更新就行
      origin.updateChildren(result.rawChildren);
      origin.updateProps(result.rawProps);
      return false;
    }

    if (result instanceof XFactory) {
      result.exec();
    }
    const destroyPosition =
      origin instanceof XFactory
        ? origin.stop()
        : getDomPositionInfo([origin as any]);
    if (destroyPosition) {
      insertElements(
        result instanceof XFactory ? result.getElements() : ([result] as any),
        destroyPosition
      );
    }
    return true;
  }

  initProps() {
    this.processMap.set(
      "props",
      new Processable(() =>
        Processable.withoutRecording(() => {
          // 为何多此一举？只是为了能够方便的停止props的进程
          this.prop = new Prop(this);
        })
      )
    );
  }
  stopProps() {
    const process = this.processMap.get("props");
    if (process) {
      process.stop();
    }
    this.processMap.delete("props");
  }

  // 一个组件的解构就像基因一样，自出生之日就确定了
  updateChildren(children: XTransformedValue<XChildResult>[]) {
    // this.transformedChildren = children;
    children.forEach(
      (child, index) => (this.transformedChildren[index] = child)
    );
  }

  // 同children一样 props的格式在出生之日就固定了
  updateProps(props: XTransformedPropsData[]) {
    // 如此一来，所有的属性都被重新计算了一下 怎么去
    props.forEach(
      (prop, index) =>
        (this.transformedProps[
          index + (this.isComponentOrFunctional ? 1 : 0)
        ] = prop)
    );
  }

  stop() {
    this.processMap.forEach((process) => process.stop());
    return this.destroyPosition;
  }

  private _getElements(
    node: XTransformedNode | XTransformedNode[]
  ): (HTMLElement | Text)[] {
    if (Array.isArray(node)) {
      let arr: (HTMLElement | Text)[] = [];
      node.forEach((i) => this._getElements(i).forEach((j) => arr.push(j)));
      return arr;
    } else if (node instanceof XFactory) {
      return node.getElements();
    } else {
      return node ? [node] : [];
    }
  }

  // 获取这个Xnode包含的所有DOM节点
  getElements(): (HTMLElement | Text)[] {
    if (this.isNative) return [this.nativeElement!];
    if (this.isFragment) {
      const arr: (HTMLElement | Text)[] = [];
      for (let i in this.childrenResult) {
        const child = this.childrenResult[i];
        this._getElements(child).forEach((j) => arr.push(j));
      }
      return arr;
    } else {
      return this._getElements(this.renderResult);
    }
  }
}
