import Component from "../Component";
import { IPropOption } from "../Prop";
import Prop from "../Prop";
import Children from "../Children";

export default class BaseElement {
  public prop?: Prop;
  public children?: Children;
  constructor(
    public id: number, // 这个Element的唯一ID 这个会在打包的时候自动加上
    public component: string | typeof Component | (() => any),
    public _props: IPropOption[] = [],
    // 可以是任意值
    public _children: (() => any)[] = [] // 孩子节点) {}.
  ) {}
  getRenderResult(): any {
    return undefined;
  }
  init() {
    // 初始化属性
    this.initProps();
    this.initChildren();
    this.prop?.setChildren(this.children);
    this.initComponent();
  }
  initProps() {
    this.prop = new Prop(this._props);
    this.prop.init();
  }
  initChildren() {
    this.children = new Children(this._children);
    this.children.init();
  }
  initComponent() {}

  update(props: IPropOption[], children: (() => any)[]) {
    this.prop?.update(props);
    this.children?.update(children);
  }
}
