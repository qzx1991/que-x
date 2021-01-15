import { getOriginData, Processable, ProxyWatcher, State } from "que-proxyable";
import XFactory from "../Factory";
import { XTransformedPropsType, XTransformedPropsData } from "../interface";

export class PropsProcess {
  @State()
  prop: any = {};

  // 对外暴露的props 之所以再包一层是为了防止用户去设置props
  _prop = new Proxy(this.prop, {
    get(t, k) {
      return t[k];
    },
    set(t, v) {
      throw new Error("you can not define props");
    },
  });
  getProps() {
    return this._prop;
  }

  process?: Processable;

  restProcesses = new Map<number, Processable>();

  // 记录每个属性的位置和类型
  propMap = new Map<
    string,
    {
      value: () => any; // 获取值的方式
      position: number; // 位置
      type: XTransformedPropsType;
    }[]
  >();

  constructor(private factory: XFactory) {}
  start() {
    this.process = new Processable(() => {
      // 清空属性
      this.handler();
    });
  }

  stop() {
    this.process?.stop();
  }

  private handler() {
    const transformedProps: XTransformedPropsData[] = [
      {
        type: XTransformedPropsType.normal,
        property: "children",
        value: () => this.factory.transformedChildren,
      },
      ...this.factory.transformedProps,
    ];
    if (transformedProps && transformedProps.length > 0) {
      for (let i = 0; i < transformedProps?.length; i++) {
        const prop = transformedProps[i];
        // 有普通类型和rest类型 需要分别处理
        // 这里处理的是初始化的结果 对于更新的需要额外处理
        switch (prop.type) {
          case XTransformedPropsType.normal:
            this.handleNormal(i);
            break;
          case XTransformedPropsType.rest:
            this.handleRest(i);
            break;
        }
      }
      // 计算 children
    }
  }

  handleNormal(index: number) {
    const transformedProps = this.factory.transformedProps;
    const prop = transformedProps?.[index];
    if (prop && prop.type === XTransformedPropsType.normal) {
      if (!prop.property) return;
      // 由于是普通属性类型， 所以所有比自己小的都会被覆盖
      this.propMap.set(prop.property!, [
        {
          position: index,
          value: prop.value,
          type: XTransformedPropsType.normal,
        },
      ]);
      // 别忘了设置 this.prop  这个是要被外部用到的
      this.setProperty(prop.property);
    }
  }

  handleRest(index: number) {
    const transformedProps = this.factory.transformedProps;
    const prop = transformedProps?.[index];
    if (prop && prop.type === XTransformedPropsType.rest) {
      // 开启一个监听程序去监听依赖
      let cacheValue: any;
      this.restProcesses.set(
        index,
        new Processable(() => {
          // 获取这个rest的实际值
          const lastValue = cacheValue;
          cacheValue = prop.value();
          if (lastValue) {
            // 清空上一个值关联的属性
            this.deleteAllReliedProperties(lastValue, index);
          }
          // 得是个对象
          if (typeof cacheValue === "object" && !Array.isArray(cacheValue)) {
            for (let property in cacheValue) {
              // 存储属性的信息
              this.handleRestProperty(index, property, cacheValue);
            }
          }
        })
      );
    }
  }

  handleRestProperty(position: number, property: string, target: any) {
    const positions = this.propMap.get(property);
    if (!positions || positions.length <= 0) {
      this.propMap.set(property, [
        {
          position,
          value: () => target[property],
          type: XTransformedPropsType.rest,
        },
      ]);
      this.setProperty(property);
    } else {
      for (let i = positions.length - 1; i >= 0; i--) {
        const data = positions[i];
        // 位置比自己要靠后
        if (data.position > position) {
          if (data.type === XTransformedPropsType.normal) {
            // 是个普通的属性类型 不夸张的讲 这辈子他都会在 这个墙角挖不动
            return;
          } else {
            // 也是个rest类型的 有的玩  因为老大哥随时可能厌倦这个属性
            // 别着急插入，得找到比自己小的 不然前面还有个老大哥一拳头呼死你
            // 当然，没有老大哥了的话你可以插入了
            if (i === 0) {
              /**
               * 能够运行的奥这里 只能说说明一个问题：
               * 在座的各位都是老大哥
               */
              positions.splice(0, 0, {
                position,
                value: target[property],
                type: XTransformedPropsType.rest,
              });
            }
            continue;
          }
        } else if (data.position < position) {
          // 找到比自己小的了，很完美 插进去  等老大哥挂了在上位
          positions.splice(i + 1, 0, {
            position,
            value: () => target[property],
            type: XTransformedPropsType.rest,
          });
          // 也可能自己就是老大哥 该上位了
          if (i + 1 === positions.length - 1) {
            // setProperty 就是上位函数
            this.setProperty(property);
          }
          // 完美结束
          break;
        }
        // 等于 并不会存在 每次用这个方法都意味着propMap里没有自己的相关信息了： deleteAllReliedProperties
      }
    }
  }

  setProperty(property: string) {
    const positions = this.propMap.get(property);

    if (positions && positions.length > 0) {
      const position = positions[positions.length - 1];
      if (position) {
        const originProp = getOriginData(this.prop);
        const descripter = Object.getOwnPropertyDescriptor(
          originProp,
          property
        );
        if (!descripter) {
          originProp[property] = undefined;
          let value = position.value;
          Object.defineProperty(originProp, property, {
            get() {
              return value();
            },
            set(v) {
              value = v;
            },
          });
        } else {
          this.prop[property] = position.value;
        }
      }
    }
  }

  deleteAllReliedProperties(value: any, index: number) {
    // rest的对象有很多属性，属性可能分布在各个地方，因此这里要遍历一次属性
    if (value && typeof value === "object") {
      // this.deleteProperty()
      for (let key in value) {
        this.deleteProperty(key, index);
      }
    }
  }

  deleteProperty(key: string, position: number) {
    const values = this.propMap.get(key);
    if (!values || values.length <= 0) return;
    const res = values.filter((value) => value.position !== position);
    if (res.length <= 0) {
      this.propMap.delete(key);
      delete this.prop[key];
      // this.prop.delete(key);
    } else {
      this.propMap.set(key, res);
      // 有可能最后一个被过滤了
      if (res[res.length - 1] !== values[values.length - 1])
        this.setProperty(key);
    }
  }

  updateTransformedProps(props: XTransformedPropsData[]) {
    const originProps = this.factory.transformedProps;
    this.factory.transformedProps = props;
    // 逐个对比
  }
}
