import XFactory from "./Factory";
import Component from "./Component";

export type XFunctionalComponent = () => XNode;

export type XNode = XFactory | string | number | boolean | undefined;

export type XTransformedNode = XFactory | Text;

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
