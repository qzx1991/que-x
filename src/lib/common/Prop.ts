import { ProxyWatcher } from "que-proxyable";
import { getOriginData, Processable, State } from "que-proxyable";
import { EQuexPropType, IQuexPropsData } from "../interface";

const watcher = new ProxyWatcher();

// 新增属性的监听
const ADD_T_K_HANDLERS = new Map<
  any,
  ((t: any, key: string, v: any, oldV: any) => void)[]
>();

// 删除属性的监听
const DELETE_T_K_HANDLERS = new Map<any, ((t: any, k: string) => void)[]>();

function onTargetAddProperty(
  t: any,
  handler: (t: any, property: string, v: any) => void
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

export default class Prop {
  // 这里不需要@State避免不必要的监听 主要在最后阶段，在nativeDOM阶段，要能够监听到属性的增删以自动的增删dom的属性
  @State()
  prop: any = {};

  propMap = new Map<
    string,
    {
      value: () => any; // 获取值的方式
      position: number; // 位置
      type: EQuexPropType;
    }[]
  >();

  constructor(private rawprops: IQuexPropsData[] | undefined) {
    this.init();
  }
  getProperty(): any {
    return this.prop;
  }

  init() {
    if (this.rawprops && this.rawprops.length > 0) {
      for (let i = 0; i < this.rawprops?.length; i++) {
        const prop = this.rawprops[i];
        switch (prop.type) {
          case EQuexPropType.normal:
            this.handleNormal(i);
            break;
          case EQuexPropType.rest:
            this.handleRest(i);
            break;
        }
      }
    }
  }

  handleNormal(index: number) {
    const prop = this.rawprops?.[index];
    if (prop && prop.type === EQuexPropType.normal) {
      if (!prop.property) return;
      // 由于是普通属性类型， 所以所有比自己小的都会被覆盖
      this.propMap.set(prop.property!, [
        {
          position: index,
          value: prop.value,
          type: EQuexPropType.normal,
        },
      ]);
      // 别忘了设置 this.prop  这个是要被外部用到的
      this.setProperty(prop.property);
    }
  }

  handleRest(index: number) {
    const prop = this.rawprops?.[index];
    if (prop && prop.type === EQuexPropType.rest) {
      new Processable((info) => {
        const value = prop.value();
        if (info.count !== 1) {
          this.deleteAllReliedProperties(index);
        }
        // 得是个对象
        if (typeof value === "object" && !Array.isArray(value)) {
          for (let property in value) {
            this.handleRestProperty(index, property, value);
          }
          const unsubscribe = this.watchRestProperty(value, index);
          return () => unsubscribe();
        }
        // 首先要删除map中所有和自己相关的属性

        // 移除监听
      });
    }
  }

  handleRestProperty(position: number, property: string, target: any) {
    const positions = this.propMap.get(property);
    if (!positions || positions.length <= 0) {
      this.propMap.set(property, [
        {
          position,
          value: () => target[property],
          type: EQuexPropType.rest,
        },
      ]);
      this.setProperty(property);
    } else {
      // 不能直接覆盖了，要插入
      for (let i = positions.length - 1; i >= 0; i--) {
        const data = positions[i];
        // 比自己大
        if (data.position > position) {
          if (data.type === EQuexPropType.normal) {
            // 没得玩了，rest又不会变
            return;
          } else {
            // 还有的玩，毕竟后面的老大哥可能会挂
            continue;
          }
          // 等于 ?那是不存在的
        } else if (data.position < position) {
          positions.splice(i + 1, 0, {
            position,
            value: () => target[property],
            type: EQuexPropType.rest,
          });
          // 不小心加到了最后 ？ 覆盖
          if (i + 1 === positions.length - 1) {
            this.setProperty(property);
          }
          // 完美结束
          break;
        }
      }
      // 都到这里了，直接插在第一条吧
      positions.splice(0, 0, {
        position,
        value: target[property],
        type: EQuexPropType.rest,
      });
    }
  }

  watchRestProperty(target: any, position: number) {
    const originValue = getOriginData(target);
    const unadd = onTargetAddProperty(originValue, (t, k) => {
      // 新增了一个属性
      this.handleRestProperty(position, k, target);
    });
    const undelete = onTargetDeleteProperty(originValue, (t, k) => {
      this.deleteProperty(k, position);
    });
    return () => {
      unadd?.();
      undelete?.();
    };
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
          originProp[property] = position.value;
        }
      }
    }
  }

  deleteAllReliedProperties(index: number) {
    this.propMap.forEach((values, key) => this.deleteProperty(key, index));
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
      if (res[res.length - 1] !== values[values.length - 1])
        this.setProperty(key);
    }
  }
}
