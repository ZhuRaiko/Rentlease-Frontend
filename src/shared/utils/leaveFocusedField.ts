import {Keyboard,TextInput} from 'react-native';

/**
 * Runs `then` AFTER the focused text field has been blurred and the keyboard dismissed, on a later frame.
 * Why: swapping a whole screen while a multiline field still has focus unmounts that field and mounts the next screen in ONE native commit. On the Android
 * Fabric renderer that can abort in Yoga layout ("YGNodeGetOwner(childYogaNode) == &yogaNode_", then a dropped topBlur event). Blurring first lets the field
 * lose focus in its own commit, so the screen change that follows only has to unmount a quiet view.
 */
export function leaveFocusedField(then:()=>void):void{
  const input=TextInput.State.currentlyFocusedInput();
  if(input&&typeof input.blur==='function')input.blur();
  Keyboard.dismiss();
  // Two frames: one for the blur commit, one for the keyboard to start closing; the screen change then runs in a clean commit.
  requestAnimationFrame(()=>requestAnimationFrame(()=>then()));
}
