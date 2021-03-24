import { Component, isComponent } from "./Component";
import { Processable, IChangedData } from "./Processable";
import { StateWatcher } from "./Stateable";
export class VirtualElement {
  isComponent = false;
  isFragment = false;
  isNative = false;
  isFunctional = false;
  componentInstance?: Component;
  processes: Processable[] = [];
  result?: VirtualNode;
  nativeElement?: HTMLElement;
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
          this.diffResult(this.componentInstance?.render());
        })
      );
    } else if (type === "function") {
      this.isFunctional = true;
      this.processes.push(
        new Processable(() => {
          this.diffResult((this._component as FComponentType)(prop));
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
  diffResult(result: any) {}
  // 更新
  update(_props: PropertyType[], _children: FunctionalValue[]) {}
  initProp() {}
  getProp(): IProp {
    return {};
  }
}
export type VirtualNode = VirtualElement | Text | VirtualNode[];

export type IProp = {
  children?: VirtualNode[];
};
export type FComponentType<T extends IProp = {}> = (prop: T) => VirtualNode;
export type ComponentType = typeof Component | string | FComponentType;

export type FunctionalValue = () => VirtualNode;

export type PropertyType = {
  type: "rest" | "normal";
  value: FunctionalValue;
};
