/// <reference path="global.d.ts" />
import * as CSS from "csstype";
import * as PropTypes from "prop-types";

import XFactory from "./Factory";
import Component from "./Component";

type NativeAnimationEvent = AnimationEvent;
type NativeClipboardEvent = ClipboardEvent;
type NativeCompositionEvent = CompositionEvent;
type NativeDragEvent = DragEvent;
type NativeFocusEvent = FocusEvent;
type NativeKeyboardEvent = KeyboardEvent;
type NativeMouseEvent = MouseEvent;
type NativeTouchEvent = TouchEvent;
type NativePointerEvent = PointerEvent;
type NativeTransitionEvent = TransitionEvent;
type NativeUIEvent = UIEvent;
type NativeWheelEvent = WheelEvent;
type Booleanish = boolean | "true" | "false";

/**
 * defined in scheduler/tracing
 */
interface SchedulerInteraction {
  id: number;
  name: string;
  timestamp: number;
}

type Key = string | number;

interface Attributes {
  key?: Key | null;
}
interface RefAttributes<T> extends Attributes {
  // ref?: Ref<T>;
}
interface ClassAttributes<T> extends Attributes {
  // ref?: LegacyRef<T>;
}

declare global {
  namespace JSX {
    // React.createElement的结果
    interface Element extends XFactory {}
    // 类组件4
    interface ElementClass extends Component {}

    // props属性
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }

    interface IntrinsicAttributes {
      key?: string | number;
    }

    interface IntrinsicClassAttributes<T> extends ClassAttributes<T> {}

    interface IntrinsicElements {}
  }
}
