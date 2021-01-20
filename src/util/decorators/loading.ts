export function Loading(propertyname: string = "loading", instance?: any) {
  return (target: object, property: string, descriptor: PropertyDescriptor) => {
    const func = descriptor.value;
    descriptor.value = function temp() {
      (instance || this)[propertyname] = true;
      const promise = func.apply(this, arguments);
      if (promise && promise.finally) {
        promise.finally(() => {
          (instance || this)[propertyname] = false;
        });
      }
      return promise;
    };
    return descriptor;
  };
}
