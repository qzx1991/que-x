import { IComponent, TQuexChildrenResult } from "./interface";

export class Component<T = any> implements IComponent {
  static isComponent = true;

  get children(): TQuexChildrenResult {
    return [];
  }

  get props(): T | undefined {
    return undefined;
  }

  render(): any {
    return "";
  }
}

export function isQuexComponent(component: any) {
  return component && component.isComponent;
}
