import XFactory from "./Factory";
import { diffSet } from "./helper";
import { XTransformedPropsType } from "./interface";
import { Processable, State, getOriginData } from "./proxyable";
import Emitter from "./proxyable/emitter";
export interface ProcessStoreData {
  // value: XTransformedValue;
  process: Processable;
  position: number;
  type: XTransformedPropsType;
}
export class Prop {
  @State()
  private props: any = {};

  private _outProps: any = new Proxy(this.props, {
    get(t, k) {
      return t?.[k]?.();
    },
    set() {
      throw new Error("you can not define the property in props");
    },
  });

  private propStore = new Map<string, ProcessStoreData[]>();

  // 解构类型的数据的值
  private restValue = new Map<number, any>();

  // 解构类型的属性
  private restProperties = new Map<number, Set<string>>();

  emitter = new Emitter();
  getProps() {
    return this._outProps;
  }

  constructor(private factory: XFactory) {
    this.exec();
  }
  private exec() {
    for (let i = 0; i < this.factory.transformedProps.length; i++) {
      const prop = this.factory.transformedProps[i];
      switch (prop.type) {
        case XTransformedPropsType.normal:
          this.handlerNormal(i);
          break;
        case XTransformedPropsType.rest:
          this.handleRest(i);
          break;
      }
    }
  }

  private handlerNormal(position: number) {
    // this.propStore
    const item = this.factory.transformedProps?.[position];
    if (item) {
      this.handleProperty(item.property!, position, item.type);
    }
  }

  private handleProperty(
    property: string,
    position: number,
    type: XTransformedPropsType
  ) {
    if (!this.propStore.has(property)) {
      this.propStore.set(property, []);
    }
    // 获取这个属性有哪些属性列表
    const properties = this.propStore.get(property)!;
    // 找到要插入的位置
    const index = this.getIndexCanInsert(position, properties);
    // 插入这个进程 在需要的时候开启、关闭
    const process = new Processable(
      (p) => {
        switch (type) {
          case XTransformedPropsType.normal:
            if (p.count > 1) {
              // 表示发生了变化，这个时候要比较下看看是不是需要更新
              const value = this.factory.transformedProps?.[position].value;
              // 为了不触发事件
              const _value = getOriginData(this.props)[property];
              let p1 = new Processable(() => value());
              let p2 = new Processable(() => _value());
              if (
                p1.getValue() === p2.getValue() &&
                Processable.hasSameRely(p1.getRely()!, p2.getRely()!)
              ) {
                break;
              }
            }
            this.props[property] = this.factory.transformedProps?.[
              position
            ].value;
            break;
          case XTransformedPropsType.rest:
            const restValue = this.restValue.get(position);
            if (restValue) {
              this.props[property] = () => restValue[property];
            }
            break;
        }
      },
      { initOnRun: false }
    );
    properties.splice(index, 0, {
      position,
      process,
      type: type,
    });
    if (index === properties.length - 1) {
      properties[index].process.run();
    }
    if (index === 0) {
      this.emitter.emit("delete", property, "add");
    }
  }

  private handleRest(position: number) {
    new Processable(
      (opt) => {
        const object = this.factory.transformedProps?.[position]?.value();
        const originObject = this.restValue.get(position);
        if (originObject !== object) {
          this.restValue.set(position, object);
          if (opt.count !== 1) {
            const properties = this.restProperties.get(position);
            properties?.forEach((property) =>
              this.removeProperty(property, position)
            );
          }
          this.restProperties.set(position, new Set());
          const set = this.restProperties.get(position);
          for (let property in object) {
            set?.add(property);
            this.handleProperty(property, position, XTransformedPropsType.rest);
          }
        } else {
          // 是同一个object
          // const properties: [][] = []
          const set1 = this.restProperties.get(position);
          const set2: Set<string> = new Set(object.keys());
          const { added, deleted } = diffSet(new Set(set1), new Set(set2));
          deleted.forEach((i) => this.removeProperty(i, position));
          added.forEach((i) =>
            this.handleProperty(i, position, XTransformedPropsType.rest)
          );
          // this.restValue.set(position,)
          this.restProperties.set(position, set2);
        }
      },
      {
        add: true,
        delete: true,
      }
    );
  }

  private getIndexCanInsert(position: number, data: ProcessStoreData[]) {
    if (data.length <= 0 || data[0].position > position) {
      return 0;
    }
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i].position < position) {
        return i + 1;
      }
    }
    return 0;
  }

  private removeProperty(property: string, position: number) {
    const data = this.propStore.get(property);
    const index = this.getPropertyIndex(property, position);
    if (index >= 0) {
      data![index].process.stop();
      data?.splice(index, 1);
      if (index > 0) {
        data![data!.length - 1].process.reRun();
      } else {
        delete this.props[property];
        this.emitter.emit("change", property, "delete");
      }
    }
  }

  private getPropertyIndex(property: string, position: number) {
    const data = this.propStore.get(property);
    if (data) {
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].position === position) {
          return i;
        }
      }
    }
    return -1;
  }

  onPropChange(handle: (property: string, type: "add" | "delete") => void) {
    return this.emitter.on("change", handle);
  }
}
