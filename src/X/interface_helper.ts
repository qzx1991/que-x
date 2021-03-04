export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

/**
 * 
type A = Exclude<'x' | 'a', 'x' | 'y' | 'z'>
相当于: type A = 'a'
 */
export type Exclude<T, U> = T extends U ? never : T;

// 同Lodash Omit
export type Omit<T, K extends any> = Pick<T, Exclude<keyof T, K>>;

// 对象类型
export interface Dictionary<T> {
  [index: string]: T;
}

// 数组类型
export interface NumericDictionary<T> {
  [index: number]: T;
}

// 获取函数的参数类型
export type ParamType<T> = T extends (...param: infer P) => any ? P : any;
// 获取函数的返回类型
export type ReturnType<T> = T extends (...param: any[]) => infer P ? P : any;

// 这是一个普通的构造函数的表示
export type Constructor = new (...args: any[]) => any;
// 获取一个普通构造函数的方法
export type ConstructorParam<T extends Constructor> = T extends new (
  ...args: infer P
) => any
  ? P
  : never;
// 获取实例类型
type InstanceType<T extends Constructor> = T extends new (
  ...args: any[]
) => infer R
  ? R
  : any;

/**
 * 
 class TestClass {
  constructor(
    public name: string,
    public string: number
  ) {}
}
type Params = ConstructorParameters<typeof TestClass>;  // [string, numbder]
type Instance = InstanceType<typeof TestClass>;   // TestClass
 */
