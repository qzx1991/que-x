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
import {
  XChildResult,
  XTransformedChildResult,
  XDomPosition,
} from "./interface";
import { appendElements, insertElement, getNextSibling } from "./helper";
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
      let map: undefined | Map<number | string, XFactory>;
      new Processable(() => {
        const child = this.transformedChildren[i];
        const rawResult = child();
        const result =
          Array.isArray(rawResult) && this.id === -1
            ? rawResult.map(this.transformResult)
            : this.transformResult(rawResult);

        const originResult = this.childrenResult[i];
        /**
         * 亲 不要担心数组为空的情况 transformResult 为你保驾护航
         */
        if (
          // 有key才有意义
          map &&
          map.size > 0 &&
          Array.isArray(result) &&
          Array.isArray(originResult)
        ) {
          // 这是重点  数组的diff就靠你了  cursor 表示的是从0开始的第一个XFactory节点的位置
          // 不可能是空的，我保证！能走到这里肯定有数据的
          let cursor = this.getCursor(0, originResult)!;
          let cursorFactory = originResult[cursor] as XFactory;
          let cursorElements = this._getElements(cursorFactory);
          // 这是第一个dom开始的位置
          const position: XDomPosition = {
            nextSibling: cursorElements[0],
            parent:
              cursorElements[0].parentNode || cursorElements[0].parentElement,
          };
          const newMap = new Map<number | string, XFactory>();
          result.forEach((child, index) => {
            if (child instanceof XFactory) {
              if (cursor >= 0) {
                child.initProps();
                const key = child.prop?.getProps().key;

                if (map?.has(key)) {
                  // 有对应的key 先停止
                  child.stop();
                  // 更新原先的XFactory
                  const f = map.get(key);
                  f!.updateChildren(child.rawChildren);
                  f!.updateProps(child.rawProps);
                  newMap.set(key, f!);
                  map.delete(key); // 只能用一次 用完得删了
                  // 由于使用了之前的XFactory 得进行替换
                  result[index] = f!;
                  // 是否是当前游标？不是的话 得插到前面来
                  if (cursorFactory.prop?.getProps().key === key) {
                    // 是当前游标 那不用管 游标向后
                    cursor = this.getCursor(cursor + 1, originResult);
                    if (cursor < 0) {
                      position.nextSibling = getNextSibling(
                        cursorElements[cursorElements.length - 1] as any
                      );
                      return;
                    }
                    cursorFactory = originResult[cursor] as XFactory;
                    cursorElements = this._getElements(cursorFactory);
                    position.nextSibling = cursorElements[0];
                    position.parent =
                      cursorElements[0].parentNode ||
                      cursorElements[0].parentElement;
                  } else {
                    // 不是当前游标  这个数据要移过来
                    f?.insertBefore(position);
                  }
                  return;
                }
              }
              // 如果游标没了或者没找到对应的原始数据  都会走到这里
              child.render();
              child.insertBefore(position);
            } else {
              // 不是XFactory 直接插
              insertElement(child, position);
            }
          });
          // 旧结果中 没有用到的结果要移除掉
          for (let i = cursor; i < originResult.length; i++) {
            const ele = originResult[i];
            if (ele instanceof XFactory) {
              ele.stop();
            } else {
              ele.remove();
            }
          }
          // 新的map替换原来的map方便下次比较
          map = newMap;
        } else if (
          result instanceof XFactory &&
          originResult instanceof XFactory &&
          result.id === originResult.id
        ) {
          // 如果 这些属性都一样 那就简单了
          originResult.updateChildren(result.rawChildren);
          originResult.updateProps(result.rawProps);
        } else {
          if (Array.isArray(result)) {
            map = new Map();
            result.forEach((i) => {
              if (i instanceof XFactory) {
                i.exec();
                const key = i.prop?.getProps().key;
                if (map?.has(key)) {
                  console.warn("You flag the same key!!!");
                }
                key && map?.set(key, i);
              }
            });
          } else {
            map = undefined;
            result instanceof XFactory && result.exec();
          }
          this.childrenResult[i] = result;
          // 销毁旧数据
          const position = this._destroyChildNode(originResult);
          if (position) {
            insertElements(this._getElements(result), position);
          }
        }
      });
    }
  }

  _destroyChildNode(node?: XTransformedChildResult): XDomPosition | undefined {
    if (node instanceof XFactory) {
      return node.stop()!;
    } else if (Array.isArray(node)) {
      const res = node.map(this._destroyChildNode);
      if (res && res.length > 0) {
        return res[res.length - 1];
      }
    }
    return undefined;
    // return [];
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
      this.destroyPosition = getDomPositionInfo(
        [this.renderResult as any],
        true
      );
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
      if (result.length === 0) {
        return new Text("");
      }
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
      return this.renderResult ? this._getElements(this.renderResult) : [];
    }
  }

  // 在某个元素前插入
  insertBefore(position: XDomPosition) {
    const elements = this.getElements();
    elements.forEach((ele) => insertElement(ele, position));
    return elements;
  }

  getCursor(begin: number = 0, arr: XTransformedNode[]) {
    for (let i = begin; i < arr.length; i++) {
      const ele = arr[i];
      if (ele instanceof XFactory) {
        const key = ele.prop?.getProps().key;
        if (key) {
          return i;
        } else {
          ele.stop();
        }
      } else {
        ele.remove();
      }
    }
    return -1;
  }
}
