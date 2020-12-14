import { Processable, State } from "que-proxyable";
import { isQuexComponent, Component } from "./Component";
import {
  TFunctionalComponent,
  TQuexResult,
  IFactory,
  IQuexPropsData,
  TQuexComponentTypes,
  TQuexFormattedResult,
} from "./interface";
import Prop from "./common/Prop";
import { flatternDeep, replaceDom } from "./utils";

export class Factory implements IFactory {
  @State()
  props: any = {};
  isComponent = false;
  isNative = false;
  isFunctional = false;
  isFragment = false;

  myDom?: HTMLElement;

  result?: TQuexFormattedResult;

  renderProcess?: Processable;

  childrenProcess?: Processable;

  propProcess?: Processable;

  childrenResult: any[] = [];

  @State()
  rawprops: IQuexPropsData[] | undefined;

  constructor(
    public id: number | string,
    public component: TQuexComponentTypes,
    rawprops: IQuexPropsData[] | undefined,
    public rawChildren: (() => any)[] | undefined
  ) {
    this.rawprops = rawprops;
    // 初始化这个Factory的类型
    this.isFragment = this.component === "fragment";
    this.isNative = typeof this.component === "string" && !this.isFragment;
    this.isComponent = isQuexComponent(this.component);
    this.isFunctional =
      !this.isComponent && typeof this.component === "function";
  }

  exec() {
    this.initProps();
    if (this.isComponent) {
      this.renderAsComponent();
    } else if (this.isFunctional) {
      this.renderAsFunction();
    } else if (this.isFragment) {
      this.renderAsFragment();
    } else if (this.isNative) {
      this.renderAsNative();
    }
  }

  // 初始化props
  initProps() {
    this.propProcess = new Processable(() => {
      const prop = new Prop(this.rawprops);
      this.props = prop.getProperty();
    });
  }

  renderAsFragment() {
    if (!this.rawChildren) return;

    this.childrenProcess = new Processable(() => {
      this.rawChildren?.forEach((v, index) => {
        new Processable(() => {
          let child = v();
          if (Array.isArray(child)) {
            child.forEach(
              (item, index) => (child[index] = this.formatRenderResult(item))
            );
          } else {
            child = this.formatRenderResult(child);
          }
          this.diffChildResult(this.childrenResult[index], child, index);
        });
      });
    });
  }

  renderAsNative() {
    this.myDom = document.createElement(this.component as string);
    this.renderNativeProperties();
    // 设置属性 计算依赖对于rest
    this.renderAsFragment();
    this.getChildrenElements().forEach((ele) => this.myDom?.append(ele));
  }

  renderNativeProperties() {
    this.renderProcess = new Processable(() => {
      new Processable(() => {
        for (let property in this.props) {
          if (/^_+/gi.test(property)) {
            return;
          }
          if (property === "className") {
            // new Processable(() => {
            // 避免每次进来都比较property,避免不必要的计算
            new Processable(() => {
              const value = this.props[property];
              const classValue = this.getClassName(value);
              if (classValue) {
                this.myDom?.setAttribute("class", classValue);
              }
            });
          } else if (property === "style") {
            new Processable(
              () => {
                const value = this.props[property];
                const styleValue = this.getStyleValue(value);
                if (styleValue) {
                  this.myDom?.setAttribute("style", styleValue);
                }
              },
              {
                add: true,
                delete: true,
              }
            );
          } else if (/^on/gi.test(property)) {
            new Processable(() => {
              const value = this.props[property];
              const eventname = property.substr(2).toLowerCase();
              this.myDom?.addEventListener(eventname, value);
              return () => this.myDom?.removeEventListener(eventname, value);
            });
          } else {
            new Processable(() => {
              const value = this.props[property];
              this.myDom?.setAttribute(property, value);
            });
          }
          // });
        }
      });
    });
  }

  getClassName(value: any) {
    if (Array.isArray(value)) {
      return value.filter((i) => i).join(" ");
    }
    if (typeof value === "object") {
      return Object.keys(value)
        .filter((key) => value[key])
        .join(" ");
    }
    return `${value}`;
  }

  getStyleValue(value: any) {
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      return Object.keys(value)
        .map((key) => `${key}:${value[key]}`)
        .join(";");
    }
    return null;
  }

  renderAsComponent() {
    // 定义这个组件的prop的获取方式
    const me = this;
    const component = me.component as typeof Component;
    const instance = new component();
    Object.defineProperty(instance, "props", {
      get() {
        return me.props;
      },
    });
    this.renderProcess = new Processable(() => {
      me.diffResult(me.formatRenderResult(instance.render()));
    });
  }

  renderAsFunction() {
    const me = this;
    const component = me.component as TFunctionalComponent;
    this.renderProcess = new Processable(() => {
      me.diffResult(me.formatRenderResult(component(this.props)));
    });
  }

  formatRenderResult(result: TQuexResult) {
    if (result instanceof Factory) {
      return result;
    }
    if (typeof result === "object") {
      return new Text(JSON.stringify(result));
    }
    return new Text(`${result}`);
  }

  diffResult(result: TQuexFormattedResult) {
    const me = this;
    // 这表示是同一个渲染结果
    if (
      me.result instanceof Factory &&
      result instanceof Factory &&
      me.result.id === result.id
    ) {
      // me.result.didpropInited = false;
      me.result.rawprops = result.rawprops;
      me.result.rawChildren = result.rawChildren;
      if (me.result.isFragment || me.result.isNative) {
        me.result.childrenProcess?.run();
      }
    } else if (
      me.result instanceof Text &&
      result instanceof Text &&
      me.result.data === result.data
    ) {
      return;
    } else {
      if (result instanceof Factory) {
        result.exec();
      }
      if (this.result) {
        // 之前有渲染结果 这个时候需要替换
        this.replaceResult([this.result], [result]);
      }
      this.result = result;
    }
  }

  replaceResult(
    originResults: TQuexFormattedResult[],
    results: TQuexFormattedResult[]
  ) {
    originResults.forEach((originResult) => {
      // 停止渲染进程
      if (originResult instanceof Factory) {
        originResult.destroyProcess(); // 停止进程
      }
    });
    const elements = flatternDeep(
      results.map((result) =>
        result instanceof Factory ? result.getElements() : [result as Text]
      )
    );
    // 获取DOM节点
    const originElements = flatternDeep(
      originResults.map((originResult) =>
        originResult instanceof Factory
          ? originResult.getElements()
          : [originResult as Text]
      )
    );
    replaceDom(originElements, elements);
  }

  diffChildResult(originChild: any, child: any, i: number) {
    if (
      child instanceof Factory &&
      originChild instanceof Factory &&
      child.id === originChild.id
    ) {
      // originChild.didpropInited = false;
      originChild.rawprops = child.rawprops;
      originChild.rawChildren = child.rawChildren;
      if (originChild.isFragment || originChild.isNative) {
        originChild.childrenProcess?.run();
      }
    } else if (
      // 值没变不用动
      child instanceof Text &&
      originChild instanceof Text &&
      child.data === originChild.data
    ) {
      return;
    } else {
      if (child instanceof Factory) {
        child.exec();
      }
      if (Array.isArray(child)) {
        child.forEach((i) => {
          if (i instanceof Factory) {
            i.exec();
          }
        });
      }
      if (originChild) {
        this.replaceResult(
          Array.isArray(originChild) ? originChild : [originChild],
          Array.isArray(child) ? child : [child]
        );
      } else {
        // this.myDom?.append
      }
      this.childrenResult![i] = child;
    }
  }

  getChildrenElements() {
    return flatternDeep(
      this.childrenResult.map((child) => {
        if (child instanceof Factory) {
          return child.getElements();
        }
        if (Array.isArray(child)) {
          return child.map((item) => {
            if (item instanceof Factory) {
              return item.getElements();
            }
            return item;
          });
        }
        return [child];
      })
    );
  }

  getElements(): HTMLElement[] {
    if (this.isNative) {
      return [this.myDom!];
    }
    if (this.isFragment) {
      return this.getChildrenElements();
    } else {
      if (this.result instanceof Factory) {
        return this.result.getElements();
      }
      return [this.result as any];
    }
  }

  // 将这个factory的结果添加到dom上
  appendTo(dom: HTMLElement) {
    const elements = this.getElements();
    if (elements && elements.length > 0) {
      elements.forEach((ele) => dom.append(ele));
    }
  }

  destroyProcess() {
    this.renderProcess?.stop();
    this.childrenProcess?.stop();
    this.propProcess?.stop();
  }
}
