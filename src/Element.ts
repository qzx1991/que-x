import { Component, isComponent } from "./Component";
import { Processable, IChangedData } from "./Processable";
import { StateWatcher } from "./Stateable";
import { Property } from "./Property";
import { formatResult } from "./utils/ElementUtil";
export class VirtualElement {
  isComponent = false;
  isFragment = false;
  isNative = false;
  isFunctional = false;
  componentInstance?: Component;
  processes: Processable[] = [];
  nativeElement?: HTMLElement;
  prop?: Property;
  result?: IRenderResult;
  constructor(
    public _component: ComponentType,
    public _props: PropertyType[],
    public _children: FunctionalValue[]
  ) {}
  // 开始执行
  mount() {
    const type = typeof this._component;
    this.initProp();
    const prop = this.getProp();
    if (isComponent(this._component)) {
      this.isComponent = true;
      this.componentInstance = new (this._component as typeof Component)(prop);
      this.processes.push(
        new Processable(() => {
          const result = this.result;
          this.result = formatResult(this.componentInstance?.render());
          VirtualElement.diffResult(this.result, result);
        })
      );
    } else if (type === "function") {
      this.isFunctional = true;
      this.processes.push(
        new Processable(() => {
          // this.diffResult((this._component as FComponentType)(prop));
        })
      );
    } else if (type === "string") {
      if (this._component === "fragment") {
        this.isFragment = true;
        this.renderChildren(prop.children);
      } else {
        this.isNative = true;
        this.nativeElement = document.createElement(this._component as string);
        this.processes.push(
          new Processable(() => {
            const watcher = new StateWatcher();
            // 存储子进程  原则上除非组件销毁 这个process永远都不会重新执行
            const subProcesses = new Map<string, Processable>();
            // for in 并不会触发proxy的get
            for (let i in prop) {
              subProcesses.set(
                i,
                // 处理属性
                new Processable((rely, isFirst) => {
                  return this.handleNativeProperty(
                    prop,
                    i,
                    isFirst ? undefined : rely // 要对比旧值的
                  );
                })
              );
            }
            // 当有新增属性的话 需要重新处理
            const setUnsubscribe = watcher.on("set", (d) => {
              // 是prop 并且是新增的属性
              if (d.target === prop && d.isAdd) {
                // 理论上不可能有 但是还是得以防万一
                if (subProcesses.has(d.key)) {
                  subProcesses.get(d.key)?.stop();
                }
                subProcesses.set(
                  d.key,
                  new Processable((rely, isFirst) => {
                    this.handleNativeProperty(
                      prop,
                      d.key,
                      isFirst ? undefined : rely // 要对比旧值的
                    );
                  })
                );
              }
            });
            // 有属性删除
            const deletedUnsubscribe = watcher.on("delete", (d) => {
              if (d.target === prop) {
                // 停止process
                subProcesses.get(d.key)?.stop();
                // 移除记录
                subProcesses.delete(d.key);
              }
            });
            // 组件卸载时会停止所有的process
            return () => {
              setUnsubscribe();
              deletedUnsubscribe();
            };
          })
        );
      }
    }
  }

  // 处理属性  返回结果是删除属性时调用
  handleNativeProperty(
    prop: IProp,
    property: string | number,
    rely?: IChangedData
  ) {}
  renderChildren(children: IProp["children"]) {}
  static diffResult(resultNew: IRenderResult, resultOld?: IRenderResult) {}
  // 更新
  update(_props: PropertyType[], _children: FunctionalValue[]) {}
  initProp() {
    this.prop = new Property(this._props, this._children);
  }
  getProp(): IProp {
    return this.prop?.getProp();
  }
}
export type VirtualNode = VirtualElement | Text | VirtualNode[];

export type IProp = {
  children?: VirtualNode[];
};
export type FComponentType<T extends IProp = {}> = (prop: T) => any;
export type ComponentType = typeof Component | string | FComponentType;

export type FunctionalValue = () => any;

export type PropertyType = {
  type: "rest" | "normal";
  value: FunctionalValue;
  property: string;
};

export type IRenderResult = VirtualElement | Text | any[];

export interface IElement {
  unmount: () => void;
  getElements: () => (HTMLElement | Text)[];
  exec: () => void;
}
