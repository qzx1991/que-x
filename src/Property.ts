import { FunctionalValue, PropertyType, VirtualElement } from "./Element";
import { State, StateWatcher, getStateOriginData } from "./Stateable";
import { Processable } from "./Processable";
export class Property {
  constructor(
    public _prop: PropertyType[],
    public _children: FunctionalValue[]
  ) {}
  @State()
  prop: any = {};
  processes: Processable[] = [];
  properties = new Map<
    string,
    {
      index: number;
      process: Processable;
    }[]
  >();
  childrenList: {
    process: Processable;
  }[] = [];
  private addProp(property: string, value: FunctionalValue, index: number) {
    if (!this.properties.get(property)) {
      this.properties.set(property, []);
    }
    const arr = this.properties.get(property)!;
    for (let i = arr?.length - 1; i >= 0; i--) {
      const item = arr[i];
      // 已有的这个时间比要插入的
      if (item.index < index) {
        const isLastOne = i === arr.length - 1;
        if (isLastOne) {
          arr[i].process.stop();
        }
        // 插入
        arr.splice(i + 1, 0, {
          index,
          process: new Processable(
            () => {
              const originProp = getStateOriginData(this.prop);
              const originValue = originProp[property];
              const newValue = value();
              if (newValue !== originValue) {
                this.prop[property] = newValue;
              }
            },
            {
              runOnInit: isLastOne,
            }
          ),
        });
        return;
      }
    }
    arr.unshift({
      index,
      process: new Processable(
        () => {
          const originProp = getStateOriginData(this.prop);
          const originValue = originProp[property];
          const newValue = value();
          if (newValue !== originValue) {
            this.prop[property] = newValue;
          }
        },
        {
          runOnInit: true,
        }
      ),
    });
    // if (arr.length )
    // if (arr[arr.])
  }
  private removeProp(index: number, property?: string) {
    if (!property) {
      this.properties.forEach((propertys, key) => {
        this.removeProp(index, key);
      });
    } else {
      const arr = this.properties.get(property);
      if (arr?.[arr.length - 1]?.index === index) {
        arr[arr.length - 1]?.process.stop();
      }
      const arr2 = arr?.filter((i) => i.index === index) || [];
      this.properties.set(property, arr2);
      if (arr2.length > 0) {
        arr2[arr2.length - 1].process.run();
      }
    }
  }
  initProp() {
    for (let i = 0; i < this._prop.length; i++) {
      const p = this._prop[i];
      switch (p.type) {
        case "normal":
          this.addProp(p.property, p.value, i);
          break;
        case "rest":
          let originData: any = undefined;
          this.processes.push(
            new Processable(() => {
              const data = p.value();
              // 相等的话就不用重复计算了
              if (data !== originData) {
                // 先移除所有的数据
                this.removeProp(i);
                //重新添加
                for (let k in data) {
                  this.addProp(k, () => data[k], i);
                }
                originData = data;
              }

              const watcher = new StateWatcher();
              // 需要注意的是这里只是记录用到的数据，对于新增/删除却是没有的因此需要额外的监听
              const addUnsubscribe = watcher.on("set", (d) => {
                if (d.target === data && d.isAdd) {
                  this.addProp(d.key, () => data[d.key], i);
                }
              });
              const deleteUnsubscribe = watcher.on("delete", (d) => {
                if (d.target === data) {
                  this.removeProp(i, d.key);
                }
              });
              return () => {
                // 别忘了取消监听
                addUnsubscribe();
                deleteUnsubscribe();
              };
            })
          );
      }
    }
  }
  // 初始化孩子节点
  initChildren() {
    if (this._children.length > 0) {
      const originProp = getStateOriginData(this.prop);
      originProp.children = [];
      this.childrenList = this._children.map((child, index) => ({
        process: new Processable(() => {
          // diff Result 返回的是最终的徐然结果
          this.prop.children![index] = VirtualElement.diffResult(
            child(),
            originProp.children[index]
          );
        }),
      }));
    }
  }
  // 更新属性和子节点
  update(_prop: PropertyType[], _children: FunctionalValue[]) {
    // 凡事并不完美 prop和children并不是一成不变的
    const p = new Property(_prop, _children);
    const selfProp = this.getProp();
    const selfOriginProp = getStateOriginData(selfProp);
    const newProp = p.getProp();
    const newOriginProp = getStateOriginData(newProp);
    const oKeys = new Set(Object.keys(selfOriginProp));
    const nKeys = new Set(Object.keys(newOriginProp));
    nKeys.forEach((key) => {
      // 只要不相等 就重新赋值
      if (selfOriginProp[key] !== newOriginProp[key]) {
        selfProp[key] = newOriginProp[key];
      }
      oKeys.delete(key);
    });
    // 剩下的都是要删除的
    oKeys.forEach((key) => delete selfProp[key]);
    // 把这个属性赋值给新的这个prop
    p.prop = selfProp;
    // 取消监听 因为我不需要了 我所有的经理都子啊下面这个property
    this.unmount();
    // 绑定新的这个卸载
    this.unmount = p.unmount.bind(p);
  }
  getProp() {
    return this.prop;
  }
  unmount() {
    this.properties.forEach((list) => list.forEach((i) => i.process.stop()));
    this.childrenList.forEach((i) => i.process.stop());
    this.processes.forEach((p) => p.stop());
  }
}
