import { FunctionalValue, PropertyType } from "./Element";
import { State } from "./Stateable";
import { Processable } from "./Processable";
export class Property {
  constructor(
    public _prop: PropertyType[],
    public _children: FunctionalValue[]
  ) {}
  @State()
  private prop: any = {};
  private processes: Processable[] = [];
  private properties = new Map<
    string,
    {
      index: number;
      value: FunctionalValue;
    }[]
  >();
  private addProp(property: string, value: Function) {}
  initProp() {
    for (let i in this._prop) {
      const p = this._prop[i];
      switch (p.type) {
        case "normal":
        case "rest":
      }
    }
  }
  initChildren() {}
  update(_prop: PropertyType[], _children: FunctionalValue[]) {}
  getProp() {
    return this.prop;
  }
}
