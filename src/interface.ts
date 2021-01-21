import XFactory from "./Factory";
import Component from "./Component";

export type XFunctionalComponent<T = any> = (prop: T) => XNode;

export type XNode =
  | XFactory
  | string
  | number
  | boolean
  | undefined
  | Array<XNode>;

export type XTransformedNode = XFactory | Text | undefined;

export type XComponent = XFunctionalComponent | typeof Component | string;

export enum XTransformedPropsType {
  normal = "normal",
  rest = "rest",
}

export type XTransformedValue<T = any> = () => T;

export interface XTransformedPropsData {
  type: XTransformedPropsType;
  value: XTransformedValue;
  property?: string;
}

export type XProps<P = {}> = P & {
  children: XNode[];
};

export type XDomPosition = {
  parent: any;
  nextSibling?: ChildNode | null;
};

export type XClassType =
  | string
  | undefined
  | (string | undefined | { [prop: string]: boolean })[]
  | { [prop: string]: boolean };
export type XStyleType = string | { [prop: string]: number | string };

export type XChildResult = XNode | XNode[];
