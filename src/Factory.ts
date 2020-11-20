import { State } from "que-proxyable";
import { DeocratorOfDebounceTime } from "que-utils";
import Component, {
  ERenderPosition,
  IFactory,
  isQuexComponent,
  QuexableData,
  QuexComponent,
} from "./common";
import { RecordPosition } from "./decorator";
import { IComponent, QuexRenderResult } from "./common";

export default class Factory implements IFactory {
  originProps: any;

  @State()
  myProps: any = {};

  // 目前大致四种

  isComponent = false;
  isNative = false;
  isFunctional = false;
  isFragment = false;

  // 渲染结果
  result: QuexRenderResult | undefined;

  // 实例

  componentInstance: IComponent | undefined;

  // 这个factory包含的dom
  elements: HTMLElement[] = [];

  constructor(
    public component: QuexComponent,
    public props: QuexableData, // () => props
    public children: QuexableData[] // () => [children]
  ) {
    this.isFragment = this.component === "fragment";
    this.isNative = typeof this.component === "string" && !this.isFragment;
    this.isComponent = isQuexComponent(this.component);
    this.isFunctional =
      !this.isComponent && typeof this.component === "function";
  } // public component:
  // 初始化属性

  @RecordPosition(ERenderPosition.props)
  initProps() {
    this.myProps = this.props();
  }

  @DeocratorOfDebounceTime(5)
  reInitProps() {
    this.originProps = this.myProps;
    // 重置props 引用props对象的对方会自动更新
    this.initProps();
  }

  // 执行
  @RecordPosition(ERenderPosition.render)
  exec(shouldHandleResult: boolean = true) {
    if (this.isComponent) {
      this.renderAsComponent();
    } else if (this.isFunctional) {
      this.renderAsFunctional();
    } else if (this.isFragment) {
      this.renderAsFragment();
    } else if (this.isNative) {
      this.renderAsNative();
    }
    if (shouldHandleResult && this.result) {
      this.handleResult(this.result);
    }
  }

  // 重新执行
  @DeocratorOfDebounceTime(5)
  reExec() {
    // 存储旧的结果
    const originResult = this.result;
    // 计算新的结果
    this.exec(false);
    if (originResult instanceof Factory && this.result instanceof Factory) {
      // 新的结果也是个Factory 那么就去看这个Factory是不是同一个
      if (this.result.component !== originResult.component) {
        // 不是同一个
        this.handleResult(this.result);
        this.replaceDom();
      } else {
        // this.originProps = this.myProps;
        originResult.props = this.result.props;
        originResult.children = this.result.children;
        originResult.myProps = this.result.myProps;
        // result重新赋值了 原Factory会自动渲染
        this.result = originResult;
      }
    } else {
      // 旧的结果是一个普通的值 按道理都已经转成了Text节点 这里就去替换这个节点
      this.replaceDom();
    }
  }

  // 根据elements去替换DOM
  replaceDom() {}

  renderAsComponent() {
    const component = this.component as typeof Component;
    this.componentInstance = new component();
    this.componentInstance?.onInited?.();
    this.result = this.transformResult(this.componentInstance.render());
    // this.handleResult(this.result);
  }

  transformResult(result: QuexRenderResult): QuexRenderResult {
    if (this.result instanceof Factory || this.result instanceof Text) {
      return result;
    }
    return document.createTextNode(
      typeof result === "object" ? JSON.stringify(result) : result
    );
  }

  // 处理渲染救国
  handleResult(result: QuexRenderResult) {
    // 这是一个Factory 直接过~
    if (result instanceof Factory) {
      result.exec();
    }
  }

  renderAsNative() {}

  renderAsFunctional() {}

  renderAsFragment() {}

  renderChildren() {}

  @DeocratorOfDebounceTime(5)
  reRenderChildren() {}

  renderChild(index: number) {}

  @DeocratorOfDebounceTime(5)
  reRenderChild(index: number) {}

  getElement() {}

  appendTo(dom: HTMLElement) {}
}
