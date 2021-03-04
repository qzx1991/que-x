export default class Component<
  P extends {
    children?: any;
  }
> {
  static __$$ISCOMPONENT = true;
  constructor(public props: P) {}
  render() {}
}
export function IsComponent(v: any) {
  const type = typeof v;
  return type === "function"
    ? v["__$$ISCOMPONEN"] // 是函数的话，直接取static的值
    : type === "object"
    ? v.__proto__?.constructor?.["__$$ISCOMPONEN"] //有可能是不存在的
    : false;
}
