import { isCompnent } from "./Component";
import {
  XComponent,
  XNode,
  XTransformedPropsData,
  XTransformedValue,
} from "./interface";
import { PropsProcess } from "./process/propsProcess";
import { RenderProcess } from "./process/renderProcess";
import { ChildProcess } from "./process/childProcess";
export default class XFactory {
  isComponent = false;
  isNative = false;
  isFunctional = false;
  isFragment = false;
  propsProcess = new PropsProcess(this);
  renderProcess = new RenderProcess(this);
  childProcess = new ChildProcess(this);
  constructor(
    public id: number,
    public component: XComponent,
    public transformedProps: XTransformedPropsData[],
    public transformedChildren: XTransformedValue<XNode | XNode[]>[]
  ) {
    this.isFragment = this.component === "fragment";
    this.isNative = typeof this.component === "string" && !this.isFragment;
    this.isComponent = isCompnent(this.component);
    this.isFunctional =
      !this.isComponent && typeof this.component === "function";
  }
  // 执行
  exec() {
    this.propsProcess.start();
    this.renderProcess.start();
    this.childProcess.start();
  }

  destroy() {
    this.propsProcess.stop();
    this.renderProcess.stop();
    this.childProcess.stop();
  }

  // 获取这个Xnode包含的所有DOM节点
  getElements(): HTMLElement[] {
    return [];
  }
}
