import { XTransformedPropsData, XTransformedPropsType } from "./../interface";
import XFactory from "../Factory";
import { Processable, State } from "que-proxyable";
import { diffSet } from "../helper";
export interface ProcessStoreData {
  // value: XTransformedValue;
  process: Processable;
  position: number;
  type: XTransformedPropsType;
}
export class PropsProcess {
  @State()
  // 进过打包器打包的属性
  transformProps?: XTransformedPropsData[];

  @State()
  prop: any = {};

  outputProp = new Proxy(this.prop, {
    get(t, k) {
      return t[k]();
    },
    set(t, k, v) {
      throw new Error("you can not redefine the prop");
    },
  });

  getProp() {
    return this.outputProp;
  }

  propStore = new Map<string, ProcessStoreData[]>();

  // 解构类型的数据的值
  restValue = new Map<number, any>();

  // 解构类型的属性
  restProperties = new Map<number, Set<string>>();

  constructor(private factory: XFactory) {
    this.updateTransformProps(this.factory.transformedProps);
  }
  // 更新props数据
  updateTransformProps(props: XTransformedPropsData[]) {
    // 原则上，组件的结构是固定的 所以props的数据都是固定的
    if (!this.transformProps || this.transformProps.length <= 0) {
      this.initProps(props);
    } else {
      props.forEach((prop, index) => (this.transformProps![index] = prop));
    }
  }

  handleProperty(
    property: string,
    position: number,
    type: XTransformedPropsType
  ) {
    if (!this.propStore.has(property)) {
      this.propStore.set(property, []);
    }
    const properties = this.propStore.get(property)!;
    // 找到要插入的位置
    const index = this.getIndexCanInsert(position, properties);
    // 插入这个进程 在需要的时候开启、关闭
    properties.splice(index, 0, {
      position,
      process: new Processable(
        () => {
          switch (type) {
            case XTransformedPropsType.normal:
              this.prop[property] = this.transformProps?.[position].value;
              break;
            case XTransformedPropsType.rest:
              const restValue = this.restValue.get(position);
              if (restValue) {
                this.prop[property] = restValue[property];
              }
              break;
          }
        },
        { initOnRun: false }
      ),
      type: type,
    });
    if (index === properties.length - 1) {
      properties[index].process.run();
    }
  }

  getIndexCanInsert(position: number, data: ProcessStoreData[]) {
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

  initProps(props: XTransformedPropsData[]) {
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      switch (prop.type) {
        case XTransformedPropsType.normal:
          this.handlerNormal(i);
          break;
        case XTransformedPropsType.rest:
          this.handleRest(i);
          break;
      }
    }
    this.transformProps = props;
  }

  handlerNormal(position: number) {
    // this.propStore
    const item = this.transformProps?.[position];
    if (item) {
      this.handleProperty(item.property!, position, item.type);
    }
  }
  handleRest(position: number) {
    new Processable(
      (opt) => {
        const object = this.transformProps?.[position]?.value();
        const originObject = this.restValue.get(position);
        if (originObject !== object) {
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
          this.restValue.set(position, object);
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
  removeProperty(property: string, position: number) {
    const data = this.propStore.get(property);
    const index = this.getPropertyIndex(property, position);
    if (index >= 0) {
      data![index].process.stop();
      data?.splice(index, 1);
      if (index > 0) {
        data![data!.length - 1].process.reRun();
      }
    }
  }

  getPropertyIndex(property: string, position: number) {
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
}
