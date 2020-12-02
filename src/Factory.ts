import { getOriginData, Processable, ProxyWatcher, State } from "que-proxyable";
import { isQuexComponent, Component } from "./Component";
import {
  TFunctionalComponent,
  TQuexResult,
  EQuexPropType,
  IFactory,
  IQuexPropsData,
  TQuexComponentTypes,
  TQuexFormattedResult,
} from "./interface";
import { flatternDeep, replaceDom } from "./utils";

const watcher = new ProxyWatcher();

const ADD_T_K_HANDLERS = new Map<
  any,
  ((t: any, key: string, v: any, oldV: any) => void)[]
>();

const DELETE_T_K_HANDLERS = new Map<any, ((t: any, k: string) => void)[]>();

function onTargetAddProperty(
  t: any,
  handler: (t: any, property: string) => void
) {
  if (t && typeof t === "object") {
    if (!ADD_T_K_HANDLERS.has(t)) {
      ADD_T_K_HANDLERS.set(t, []);
    }
    const arr = ADD_T_K_HANDLERS.get(t);
    arr?.push(handler);
    return () => {
      if (arr) {
        arr?.splice(arr.indexOf(handler));
        if (arr.length === 0) {
          ADD_T_K_HANDLERS.delete(t);
        }
      }
    };
  }
}

function onTargetDeleteProperty(
  t: any,
  handler: (t: any, property: string) => void
) {
  if (t && typeof t === "object") {
    if (!DELETE_T_K_HANDLERS.has(t)) {
      DELETE_T_K_HANDLERS.set(t, []);
    }
    const arr = DELETE_T_K_HANDLERS.get(t);
    arr?.push(handler);
    return () => {
      if (arr) {
        arr?.splice(arr.indexOf(handler));
        if (arr.length === 0) {
          DELETE_T_K_HANDLERS.delete(t);
        }
      }
    };
  }
}

// 避免创建过多的比较函数
watcher.onDelete((t, k) => {
  DELETE_T_K_HANDLERS.get(t)?.forEach((h) => h(t, k));
});
watcher.onSet((t, k, v, ov, isAdd) => {
  if (isAdd) {
    ADD_T_K_HANDLERS.get(t)?.forEach((h) => h(t, k, v, ov));
  }
});

export class Factory implements IFactory {
  @State()
  props: any = {};
  isComponent = false;
  isNative = false;
  isFunctional = false;
  isFragment = false;

  myDom?: HTMLElement;

  private didpropInited = false;

  normalpropMap = new Map<string, { position: number; prop: IQuexPropsData }>();

  restpropMap: { position: number; prop: IQuexPropsData }[] = [];

  result?: TQuexFormattedResult;

  renderProcess?: Processable;

  childrenProcess?: Processable;

  childrenResult: any[] = [];

  constructor(
    public id: number,
    public component: TQuexComponentTypes,
    public rawprops: IQuexPropsData[] | undefined,
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

  initProps() {
    if (!this.rawprops) return;
    this.normalpropMap.clear();
    this.restpropMap = [];
    for (let i = 0; i < this.rawprops.length; i++) {
      const prop: any = this.rawprops[i];
      switch (prop.type) {
        case EQuexPropType.normal:
          this.normalpropMap.set(prop.property!, {
            position: i,
            prop,
          });
          break;
        case EQuexPropType.rest:
          this.restpropMap.push({
            position: i,
            prop,
          });
      }
    }
  }

  getPropValue(k: string) {
    const me = this;
    if (!me.didpropInited) {
      me.initProps();
    }
    if (!me.normalpropMap.has(k)) {
      for (let i = me.restpropMap.length - 1; i >= 0; i--) {
        const rest = me.restpropMap[i];
        if (rest.prop.property === k) {
          return rest.prop.value();
        }
      }
    } else {
      const normal = me.normalpropMap.get(k);
      for (let i = me.restpropMap.length - 1; i >= 0; i--) {
        const rest = me.restpropMap[i];
        if (rest.position < normal!.position) {
          break;
        }
        return rest.prop.value();
      }
      return normal?.prop.value();
    }
  }

  getChildren() {
    if (!this.rawChildren || this.rawChildren.length <= 0) {
      return this.getPropValue("children") || [];
    }
    return this.rawChildren.map((r) => r());
  }

  getPropsProxy() {
    const me = this;
    return new Proxy(
      {},
      {
        get(t, k: string) {
          if (k === "children") {
            return me.getChildren();
          }
          return me.getPropValue(k);
        },
      }
    );
  }

  renderAsFragment() {
    if (!this.rawChildren) return;
    this.childrenProcess = new Processable(() => {
      this.rawChildren?.map((v, index) => {
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
      const propertyProcessMap = new Map<
        string,
        { process: Processable; position: number }[]
      >();
      this.rawprops?.forEach((prop, index) =>
        // 这里有用到子进程 所以外面要套上方便一起移除
        this.analyseRawProp(prop, index, propertyProcessMap)
      );
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
            new Processable(() => {
              const value = this.props[property];
              const styleValue = this.getStyleValue(value);
              if (styleValue) {
                this.myDom?.setAttribute("style", styleValue);
              }
            });
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

  private analyseRawProp(
    prop: IQuexPropsData,
    index: number,
    propertyProcessMap: Map<
      string,
      { process: Processable; position: number }[]
    >
  ) {
    switch (prop.type) {
      case EQuexPropType.normal:
        if (prop.property) {
          this.setProperty(
            prop.property,
            (init) =>
              new Processable(() => {
                // prop的value发生了变化会引起这里重新计算
                const newValue = prop.value();
                // 新的值和旧值一样的话不需要做什么事情 否则更新
                if (newValue !== this.props[prop.property!]) {
                  this.props[prop.property!] = newValue;
                }
              }, init),
            index,
            propertyProcessMap
          );
        }
        break;
      case EQuexPropType.rest:
        this.setRestProperty(prop, index, propertyProcessMap);
        break;
    }
  }

  private setRestProperty(
    prop: IQuexPropsData,
    // newprocess: (runOnInit: boolean) => Processable,
    position: number,
    propertyProcessMap: Map<
      string,
      { process: Processable; position: number }[]
    >
  ) {
    new Processable(() => {
      // 计算这个rest的值
      const data = prop.value();
      // 这里需要监听
      const unsubscribeAddListener = onTargetAddProperty(
        getOriginData(data),
        (t, k) => {
          this.setProperty(
            k,
            (b) =>
              new Processable(() => {
                this.props[k] = data[k];
              }, b),
            position,
            propertyProcessMap
          );
        }
      );

      const unsubscribeDeleteListener = onTargetDeleteProperty(
        getOriginData(data),
        (t, k) => {
          this.deleteProperty(k, position, propertyProcessMap);
        }
      );

      for (let i in data) {
        this.setProperty(
          i,
          (b) =>
            new Processable(() => {
              this.props[i] = data[i];
            }, b),
          position,
          propertyProcessMap
        );
      }
      return () => {
        unsubscribeAddListener?.();
        unsubscribeDeleteListener?.();
      };
    });
  }

  // 删除某个位置的属性
  private deleteProperty(
    property: string,
    position: number,
    propertyProcessMap: Map<
      string,
      { process: Processable; position: number }[]
    >
  ) {
    const arr = propertyProcessMap.get(property);
    if (arr) {
      if (arr[arr.length - 1].position === position) {
        arr[arr.length - 1].process.stop();
        arr[arr.length - 2]?.process.run();
      } else {
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].position === position) {
            for (let j = i; j < arr.length - 1; j++) {
              arr[j] = arr[j + 1];
            }
            arr.pop();
            break;
          }
        }
        // propertyProcessMap.set(property, arr.fi)
      }
    }
  }

  private setProperty(
    property: string,
    newprocess: (runOnInit: boolean) => Processable,
    position: number,
    propertyProcessMap: Map<
      string,
      { process: Processable; position: number }[]
    >
  ) {
    if (!propertyProcessMap.get(property)) {
      propertyProcessMap.set(property, []);
      const arr = propertyProcessMap.get(property);
      arr?.push({
        process: newprocess(true),
        position,
      });
    } else {
      const processes = propertyProcessMap.get(property);
      if (processes && processes.length > 0) {
        for (let i = processes.length - 1; i >= 0; i--) {
          const isLastOne = i === processes.length - 1;
          const processInfo = processes[i];
          if (position === processInfo.position) {
            processInfo.process.stop();
            processes[i] = {
              position,
              process: newprocess(isLastOne),
            };
            return;
          } else if (position > processInfo.position) {
            // if (position === processes.length - 1)
            processInfo.process.stop();
            processes.push({
              position,
              process: newprocess(isLastOne),
            });
            return;
          }
        }
        //能走到这里，说明还没添加
        processes.unshift({
          position,
          process: newprocess(false),
        });
      }
    }
  }

  renderAsComponent() {
    // 定义这个组件的prop的获取方式
    const me = this;
    const component = me.component as typeof Component;
    const instance = new component();
    const propsProxy = me.getPropsProxy();
    Object.defineProperty(instance, "props", {
      get() {
        return propsProxy;
      },
    });
    this.renderProcess = new Processable(() => {
      me.diffResult(me.formatRenderResult(instance.render()));
    });
  }

  renderAsFunction() {
    const me = this;
    const component = me.component as TFunctionalComponent;
    const propsProxy = me.getPropsProxy();
    this.renderProcess = new Processable(() => {
      me.diffResult(me.formatRenderResult(component(propsProxy)));
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
      me.result.didpropInited = false;
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
      originChild.didpropInited = false;
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
  }
}
