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

  prop?: Prop;

  isComponent = false;
  isNative = false;
  isFunctional = false;
  isFragment = false;

  renderResult?: XTransformedNode;

  childrenResult?: XChildResult[];

  componentInstance?: Component;

  nativeElement?: HTMLElement;

  destroyPosition?: {
    nextSibling?: ChildNode | null;
    parent: any;
  };

  propProcess = new Map<string, Processable>();

  constructor(
    public id: number,
    public component: XComponent,
    public rawProps: XTransformedPropsData[],
    public rawChildren: XTransformedValue<XChildResult>[]
  ) {
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
    this.transformedProps = [
      {
        type: XTransformedPropsType.normal,
        value: () => this.transformedChildren,
        property: "children",
      },
      ...rawProps,
    ];
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
    }
  }

  renderComponent() {
    const Com = this.component as typeof Component;
    this.componentInstance = new Com(this.prop?.getProps());
    this.processMap.set(
      "render",
      new Processable(() => {
        this.handleRenderResult(
          this.transformResult(this.componentInstance?.render()),
          this.renderResult
        );
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
        this.handleRenderResult(
          this.transformResult(func(this.prop?.getProps())),
          this.renderResult
        );
        return () => this.unsubscribeRender();
      })
    );
  }

  renderNative() {
    this.nativeElement = document.createElement(this.component as string);
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
              const process = this.propProcess.get(property);
              process?.stop();
              break;
            case "add":
              this.handleNativeProperty(property, props);
              break;
          }
        });
      })
    );
  }

  renderFragment() {}

  handleNativeProperty(property: string, props: any) {
    if (isPrivateProperty(property)) {
      return;
    } else if (property === "children") {
      this.propProcess.set(
        property,
        new Processable(() => {
          // this.handleChildren(props[property]);
          // const children = t
        })
      );
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
      return;
    }

    // 两种结果类型不一样 这个时候肯定要替换原来的值了
    this.renderResult = result;
    if (result instanceof XFactory) {
      result.exec();
    }
    const destroyPosition =
      origin instanceof XFactory
        ? origin.stop()
        : getDomPositionInfo([origin as any]);
    insertElements(
      result instanceof XFactory ? result.getElements() : ([result] as any),
      destroyPosition!
    );
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
    props.forEach((prop, index) => (this.transformedProps[index + 1] = prop));
  }

  stop() {
    this.processMap.forEach((process) => process.stop());
    return this.destroyPosition;
  }

  // 获取这个Xnode包含的所有DOM节点
  getElements(): (HTMLElement | Text)[] {
    if (this.isNative) return [this.nativeElement!];
    if (this.isFragment) {
    } else {
      if (this.renderResult instanceof XFactory) {
        return this.renderResult.getElements();
      }
      if (this.renderResult instanceof Text) {
        return [this.renderResult];
      }
    }
    return [];
  }
}
