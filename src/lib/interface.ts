export interface IQuexComponent {}

export type TFunctionalComponent<T = any> = (
  prop?: T,
  children?: TQuexChildrenResult[]
) => TQuexResult;
export interface IFactory {
  id: number | string;
  component: TQuexComponentTypes;
  rawprops: IQuexPropsData[] | undefined;
  rawChildren: (() => any)[] | undefined;
}

export interface IComponent {
  render: () => any; //TQuexResult;
}

export type TQuexComponentTypes =
  | IQuexComponent
  | TFunctionalComponent
  | string;

export enum EQuexPropType {
  normal = "normal",
  rest = "rest",
}

export interface IQuexPropsData {
  type: EQuexPropType;
  value: () => any;
  property?: string;
}

export type TQuexResult = string | boolean | number | IFactory;

export type TQuexFormattedResult = Text | IFactory;

export type TQuexChildrenResult = TQuexFormattedResult | TQuexFormattedResult[];
