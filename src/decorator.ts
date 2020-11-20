import { ERenderPosition, recordTempRunningPosition } from "./common";
export function RecordPosition(position: ERenderPosition) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const handler = descriptor.value;
    descriptor.value = function () {
      return recordTempRunningPosition(
        () => handler.apply(this, arguments),
        this,
        position,
        arguments[0]
      );
    };
  };
}
